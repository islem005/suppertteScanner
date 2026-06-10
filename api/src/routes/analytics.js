import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid, upsertClientDevice } from '../db.js'
import { authenticate, adminOnly } from '../middleware.js'

const router = new Hono()

function detectDeviceType(ua) {
  if (!ua) return null
  const u = ua.toLowerCase()
  if (/mobile|iphone|ipad|ipod|android/.test(u)) return 'mobile'
  if (/tablet|ipad/.test(u)) return 'tablet'
  return 'desktop'
}

// ─── Admin Analytics (platform-wide, admin only) ────────────────────────

router.get('/admin', authenticate, adminOnly, async (c) => {
  return getAnalyticsResponse(c, null)
})

router.get('/admin/export', authenticate, adminOnly, async (c) => {
  const storeId = c.req.query('store_id') || null
  const days = parseInt(c.req.query('days')) || 30
  return exportAnalyticsCSV(c, storeId, days)
})

// ─── Store Analytics (authenticated, scoped to user's store) ────────────

router.get('/store', authenticate, async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)
  return getAnalyticsResponse(c, user.store_id)
})

router.get('/store/export', authenticate, async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Authentication required' }, 401)
  const days = parseInt(c.req.query('days')) || 30
  return exportAnalyticsCSV(c, user.store_id, days)
})

// ─── Shared Logic ───────────────────────────────────────────────────────

async function getAnalyticsResponse(c, storeId) {
  const db = c.env.DB
  const days = parseInt(c.req.query('days')) || 30
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayStr = todayStart.toISOString()

  const storeClause = storeId ? 'WHERE store_id = ?' : ''
  const storeParam = storeId ? [storeId] : []
  const storeClauseAnd = storeId ? 'AND store_id = ?' : ''
  const storeParam2 = storeId ? [storeId] : []

  // Platform / Store totals
  const deviceCount = await queryOne(db,
    `SELECT COUNT(*) as c FROM client_device ${storeClause}`,
    storeParam
  )
  const devicesToday = await queryOne(db,
    storeId
      ? `SELECT COUNT(*) as c FROM client_device WHERE store_id = ? AND last_seen_at >= ?`
      : `SELECT COUNT(*) as c FROM client_device WHERE last_seen_at >= ?`,
    storeId ? [storeId, todayStr] : [todayStr]
  )
  const visitCount = await queryOne(db,
    `SELECT COUNT(*) as c FROM page_view ${storeClause}`,
    storeParam
  )
  const visitsToday = await queryOne(db,
    storeId
      ? `SELECT COUNT(*) as c FROM page_view WHERE store_id = ? AND viewed_at >= ?`
      : `SELECT COUNT(*) as c FROM page_view WHERE viewed_at >= ?`,
    storeId ? [storeId, todayStr] : [todayStr]
  )
  const scanCount = await queryOne(db,
    `SELECT COUNT(*) as c FROM scan_event ${storeClause}`,
    storeParam
  )
  const scansToday = await queryOne(db,
    storeId
      ? `SELECT COUNT(*) as c FROM scan_event WHERE store_id = ? AND scanned_at >= ?`
      : `SELECT COUNT(*) as c FROM scan_event WHERE scanned_at >= ?`,
    storeId ? [storeId, todayStr] : [todayStr]
  )
  const hitCount = await queryOne(db,
    storeId
      ? `SELECT COUNT(*) as c FROM scan_event WHERE store_id = ? AND product_id IS NOT NULL`
      : `SELECT COUNT(*) as c FROM scan_event WHERE product_id IS NOT NULL`,
    storeId ? [storeId] : []
  )

  // Daily trend
  const dailyVisits = await queryAll(db,
    storeId
      ? `SELECT date(viewed_at) as day, COUNT(*) as visits, COUNT(DISTINCT client_id) as devices
         FROM page_view WHERE store_id = ? AND viewed_at >= ?
         GROUP BY day ORDER BY day`
      : `SELECT date(viewed_at) as day, COUNT(*) as visits, COUNT(DISTINCT client_id) as devices
         FROM page_view WHERE viewed_at >= ?
         GROUP BY day ORDER BY day`,
    storeId ? [storeId, since] : [since]
  )
  const dailyScans = await queryAll(db,
    storeId
      ? `SELECT date(scanned_at) as day, COUNT(*) as scans,
         SUM(CASE WHEN product_id IS NOT NULL THEN 1 ELSE 0 END) as hits
         FROM scan_event WHERE store_id = ? AND scanned_at >= ?
         GROUP BY day ORDER BY day`
      : `SELECT date(scanned_at) as day, COUNT(*) as scans,
         SUM(CASE WHEN product_id IS NOT NULL THEN 1 ELSE 0 END) as hits
         FROM scan_event WHERE scanned_at >= ?
         GROUP BY day ORDER BY day`,
    storeId ? [storeId, since] : [since]
  )

  // Merge daily trend
  const scanMap = {}
  for (const s of dailyScans) scanMap[s.day] = { scans: s.scans, hits: s.hits }
  const dailyTrend = dailyVisits.map(v => ({
    date: v.day,
    visits: v.visits,
    devices: v.devices,
    scans: (scanMap[v.day] && scanMap[v.day].scans) || 0,
    hits: (scanMap[v.day] && scanMap[v.day].hits) || 0
  }))
  // Add dates with scans but no page_views (edge case)
  for (const s of dailyScans) {
    if (!dailyTrend.find(d => d.date === s.day)) {
      dailyTrend.push({ date: s.day, visits: 0, devices: 0, scans: s.scans, hits: s.hits })
    }
  }
  dailyTrend.sort((a, b) => a.date.localeCompare(b.date))

  // Device breakdown
  const deviceBreakdown = await queryAll(db,
    `SELECT last_device_type as type, COUNT(*) as count
     FROM client_device ${storeClause}
     GROUP BY last_device_type ORDER BY count DESC`,
    storeParam
  )

  // Top products (limited to 10)
  let topProducts = []
  if (storeId) {
    topProducts = await queryAll(db,
      `SELECT s.barcode, p.name, COUNT(*) as count
       FROM scan_event s LEFT JOIN product p ON s.product_id = p.id
       WHERE s.store_id = ? AND s.product_id IS NOT NULL
       GROUP BY s.barcode ORDER BY count DESC LIMIT 10`,
      [storeId]
    )
  } else {
    topProducts = await queryAll(db,
      `SELECT s.barcode, p.name, COUNT(*) as count
       FROM scan_event s LEFT JOIN product p ON s.product_id = p.id
       WHERE s.product_id IS NOT NULL
       GROUP BY s.barcode ORDER BY count DESC LIMIT 10`,
      []
    )
  }

  // Per-store breakdown (admin only, all stores)
  let perStore = []
  if (!storeId) {
    const stores = await queryAll(db, 'SELECT id, name, slug FROM organization ORDER BY name')
    for (const st of stores) {
      const [sv, sd, ss, sh] = await Promise.all([
        queryOne(db, 'SELECT COUNT(*) as c FROM page_view WHERE store_id = ?', [st.id]),
        queryOne(db, 'SELECT COUNT(DISTINCT client_id) as c FROM page_view WHERE store_id = ? AND client_id IS NOT NULL', [st.id]),
        queryOne(db, 'SELECT COUNT(*) as c FROM scan_event WHERE store_id = ?', [st.id]),
        queryOne(db, "SELECT COUNT(*) as c FROM scan_event WHERE store_id = ? AND product_id IS NOT NULL", [st.id])
      ])
      const totalScans = ss?.c || 0
      const totalHits = sh?.c || 0
      perStore.push({
        store_id: st.id,
        name: st.name,
        slug: st.slug,
        visits: sv?.c || 0,
        devices: sd?.c || 0,
        scans: totalScans,
        hitRate: totalScans > 0 ? Math.round((totalHits / totalScans) * 100) : 0
      })
    }
  }

  const totalAllScans = scanCount?.c || 0
  const totalHitsAll = hitCount?.c || 0

  return c.json({
    platform: {
      totalDevices: deviceCount?.c || 0,
      devicesToday: devicesToday?.c || 0,
      totalVisits: visitCount?.c || 0,
      visitsToday: visitsToday?.c || 0,
      totalScans: totalAllScans,
      scansToday: scansToday?.c || 0,
      hitRate: totalAllScans > 0 ? Math.round((totalHitsAll / totalAllScans) * 100) : 0,
      avgScansPerVisit: (visitCount?.c || 0) > 0 ? parseFloat(((totalAllScans) / (visitCount?.c || 1)).toFixed(1)) : 0
    },
    dailyTrend,
    deviceBreakdown,
    topProducts,
    perStore
  })
}

async function exportAnalyticsCSV(c, storeId, days) {
  const db = c.env.DB
  const since = new Date(Date.now() - days * 86400000).toISOString()

  let rows
  if (storeId) {
    rows = await queryAll(db,
      `SELECT date(s.scanned_at) as date, 'store-scoped' as store_name,
         COUNT(*) as scans,
         COUNT(DISTINCT s.client_id) as devices,
         SUM(CASE WHEN s.product_id IS NOT NULL THEN 1 ELSE 0 END) as hits
       FROM scan_event s
       WHERE s.store_id = ? AND s.scanned_at >= ?
       GROUP BY date(s.scanned_at) ORDER BY date`,
      [storeId, since]
    )
  } else {
    rows = await queryAll(db,
      `SELECT date(s.scanned_at) as date, o.name as store_name,
         COUNT(*) as scans,
         COUNT(DISTINCT s.client_id) as devices,
         SUM(CASE WHEN s.product_id IS NOT NULL THEN 1 ELSE 0 END) as hits
       FROM scan_event s JOIN organization o ON s.store_id = o.id
       WHERE s.scanned_at >= ?
       GROUP BY date(s.scanned_at), o.name ORDER BY date`,
      [since]
    )
  }

  let csv = 'Date,Store,Scans,Devices,Catalog Hits,Catalog Misses,Hit Rate\n'
  for (const r of rows) {
    const misses = (r.scans || 0) - (r.hits || 0)
    const hitRate = r.scans > 0 ? Math.round(((r.hits || 0) / r.scans) * 100) + '%' : '0%'
    csv += `${r.date},${r.store_name},${r.scans},${r.devices},${r.hits},${misses},${hitRate}\n`
  }

  c.header('Content-Type', 'text/csv')
  c.header('Content-Disposition', `attachment; filename="analytics-${storeId || 'all'}-${days}d.csv"`)
  return c.body(csv)
}

export { router as analyticsRouter }
