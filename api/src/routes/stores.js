// ─── Store Routes (Organizations) ────────────────────────────────────
// Uses Better Auth's organization plugin for multi-tenant stores.
// Each store is an organization in Better Auth.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate } from '../middleware.js'
import { validateBody, validateName, validateSlug } from '../validate.js'
import { getStoreLimits, countAlwaysShowOffers, countActiveOffers, countFeaturedDiscounts, countActiveDiscounts } from '../limits.js'
import { generateStoreQR, deleteStoreQR } from '../qr.js'

// ─── Auto-register store subdomain as Pages custom domain ──────────
// Called after store creation — fires and forgets.
async function registerStoreSubdomain(c, slug) {
  const token = c.env.CLOUDFLARE_PAGES_TOKEN
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !accountId) {
    console.warn('Missing CLOUDFLARE_PAGES_TOKEN or CLOUDFLARE_ACCOUNT_ID — skipping subdomain registration')
    return
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/shelf-scanner/domains`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${slug}.ivond.com` })
      }
    )
    const data = await res.json()
    if (!data.success) {
      console.warn('Subdomain registration returned errors:', JSON.stringify(data.errors))
    }
  } catch (err) {
    console.warn('Subdomain registration failed:', err.message)
  }
}

const router = new Hono()

// Public routes (before auth middleware)
router.get('/slug/:slug', async (c) => {
  const store = await queryOne(c.env.DB,
    'SELECT id, name, slug FROM organization WHERE slug = ?',
    [c.req.param('slug')]
  )
  if (!store) return c.json({ error: 'Store not found' }, 404)
  return c.json(store)
})

// Store routes require authentication
router.use('*', authenticate)

router.get('/', async (c) => {
  const user = c.get('user')

  if (user.role === 'admin') {
    const db = c.env.DB
    const page = parseInt(c.req.query('page')) || null
    const perPage = parseInt(c.req.query('per_page')) || 20

    if (page) {
      const offset = (page - 1) * perPage
      const total = (await queryOne(db, 'SELECT COUNT(*) as total FROM organization')).total
      const stores = await queryAll(db,
        'SELECT id, name, slug, createdAt as created_at FROM organization ORDER BY name LIMIT ? OFFSET ?',
        [perPage, offset]
      )
      return c.json({ data: stores, total, page, perPage })
    }

    const stores = await queryAll(db,
      'SELECT id, name, slug, createdAt as created_at FROM organization ORDER BY name'
    )
    return c.json(stores)
  }

  // Non-admin sees their own store
  const store = await queryOne(c.env.DB,
    'SELECT id, name, slug, createdAt as created_at FROM organization WHERE id = ?',
    [user.store_id]
  )
  return c.json(store ? [store] : [])
})

router.post('/', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Admin only' }, 403)

  const body = await c.req.json()
  const { name, slug } = body

  // Normalize slug first, then validate
  const cleanSlug = slug ? slug.toLowerCase().replace(/\s+/g, '-') : slug

  const { valid, errors } = validateBody(body, {
    name: { required: true, validate: v => validateName(v) },
    slug: { required: true, validate: v => validateSlug(cleanSlug) }
  })
  if (!valid) return c.json({ error: errors.join(', ') }, 400)

  // Check slug uniqueness before insert
  const slugExists = await queryOne(c.env.DB,
    'SELECT id FROM organization WHERE slug = ?', [cleanSlug]
  )
  if (slugExists) return c.json({ error: 'This store slug is already taken' }, 409)

  const id = uuid()

  await execute(c.env.DB,
    'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
    [id, name, cleanSlug]
  )

  // Auto-register {slug}.ivond.com as a Pages custom domain (fire-and-forget)
  registerStoreSubdomain(c, cleanSlug).catch(() => {})
  // Generate QR code for the store
  generateStoreQR(c.env, cleanSlug).catch(() => {})

  const store = await queryOne(c.env.DB,
    'SELECT * FROM organization WHERE id = ?', [id]
  )
  return c.json(store)
})

// ─── Duplicate a store (copy org + branding + products + promos + discounts) ──
router.post('/:id/duplicate', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Admin only' }, 403)

  const sourceId = c.req.param('id')
  const body = await c.req.json()
  const { name, slug } = body
  const cleanSlug = slug ? slug.toLowerCase().replace(/\s+/g, '-') : slug

  const { valid, errors } = validateBody(body, {
    name: { required: true, validate: v => validateName(v) },
    slug: { required: true, validate: v => validateSlug(cleanSlug) }
  })
  if (!valid) return c.json({ error: errors.join(', ') }, 400)

  const slugExists = await queryOne(c.env.DB,
    'SELECT id FROM organization WHERE slug = ?', [cleanSlug]
  )
  if (slugExists) return c.json({ error: 'This store slug is already taken' }, 409)

  const source = await queryOne(c.env.DB,
    'SELECT * FROM organization WHERE id = ?', [sourceId]
  )
  if (!source) return c.json({ error: 'Source store not found' }, 404)

  const newId = uuid()
  const now = new Date().toISOString()
  const stmts = []

  // 1. Organization
  stmts.push(c.env.DB.prepare(
    'INSERT INTO organization (id, name, slug, logo, metadata, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(newId, name, cleanSlug, source.logo, source.metadata, now, now))

  // 2. Store branding
  const branding = await queryOne(c.env.DB,
    'SELECT * FROM store_branding WHERE store_id = ?', [sourceId]
  )
  if (branding) {
    stmts.push(c.env.DB.prepare(
      `INSERT INTO store_branding (store_id, logo_url, primary_color, accent_color, display_name, contact_email, contact_phone, footer_text, instagram_url, tiktok_url, website_url, facebook_url, twitter_url, youtube_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(newId, branding.logo_url, branding.primary_color, branding.accent_color,
      branding.display_name, branding.contact_email, branding.contact_phone,
      branding.footer_text, branding.instagram_url, branding.tiktok_url,
      branding.website_url, branding.facebook_url, branding.twitter_url,
      branding.youtube_url))
  }

  // 3. Import mapping
  const mapping = await queryOne(c.env.DB,
    'SELECT * FROM import_mapping WHERE store_id = ?', [sourceId]
  )
  if (mapping) {
    stmts.push(c.env.DB.prepare(
      'INSERT INTO import_mapping (id, store_id, column_mapping, parser_options, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(uuid(), newId, mapping.column_mapping, mapping.parser_options,
      mapping.is_verified, now, now))
  }

  // 4. Products
  const products = await queryAll(c.env.DB,
    'SELECT * FROM product WHERE store_id = ?', [sourceId]
  )
  for (const p of products) {
    stmts.push(c.env.DB.prepare(
      'INSERT INTO product (id, store_id, barcode, name, price, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(uuid(), newId, p.barcode, p.name, p.price, p.category, now, now))
  }

  // 5. Promotions
  const promotions = await queryAll(c.env.DB,
    'SELECT * FROM promotion WHERE store_id = ?', [sourceId]
  )
  for (const p of promotions) {
    stmts.push(c.env.DB.prepare(
      'INSERT INTO promotion (id, store_id, type, title, image_data, trigger_type, trigger_value, active, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(uuid(), newId, p.type, p.title, p.image_data, p.trigger_type, p.trigger_value, p.active, p.priority, now, now))
  }

  // 6. Discount items
  const discounts = await queryAll(c.env.DB,
    'SELECT * FROM discount_item WHERE store_id = ?', [sourceId]
  )
  for (const d of discounts) {
    stmts.push(c.env.DB.prepare(
      'INSERT INTO discount_item (id, store_id, barcode, name, image_data, category, original_price, new_price, discount_percent, featured, active, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(uuid(), newId, d.barcode, d.name, d.image_data, d.category, d.original_price, d.new_price, d.discount_percent, d.featured, d.active, d.priority, now, now))
  }

  // Atomic batch insert
  await c.env.DB.batch(stmts)

  // Fire-and-forget subdomain + QR
  registerStoreSubdomain(c, cleanSlug).catch(() => {})
  generateStoreQR(c.env, cleanSlug).catch(() => {})

  const store = await queryOne(c.env.DB,
    'SELECT * FROM organization WHERE id = ?', [newId]
  )
  return c.json(store)
})

router.get('/:id', async (c) => {
  const user = c.get('user')
  const store = await queryOne(c.env.DB,
    'SELECT * FROM organization WHERE id = ?',
    [c.req.param('id')]
  )
  if (!store) return c.json({ error: 'Store not found' }, 404)
  if (user.role !== 'admin' && store.id !== user.store_id) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  return c.json(store)
})

router.get('/:id/usage', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Admin only' }, 403)
  const storeId = c.req.param('id')

  const db = c.env.DB
  const [offersAlwaysShow, offersActive, discountsFeatured, discountsActive] = await Promise.all([
    countAlwaysShowOffers(db, storeId),
    countActiveOffers(db, storeId),
    countFeaturedDiscounts(db, storeId),
    countActiveDiscounts(db, storeId)
  ])
  const limits = await getStoreLimits(db, storeId)

  return c.json({
    offersAlwaysShow, offersActive,
    discountsFeatured, discountsActive,
    limits
  })
})

router.put('/:id', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Admin only' }, 403)

  const body = await c.req.json()
  const { name, slug, limits } = body

  // Normalize slug first, then validate
  const cleanSlug = slug ? slug.toLowerCase().replace(/\s+/g, '-') : slug

  const { valid, errors } = validateBody(body, {
    name: { required: false, validate: v => validateName(v) },
    slug: { required: false, validate: v => validateSlug(cleanSlug) }
  })
  if (!valid) return c.json({ error: errors.join(', ') }, 400)
  if (!name && !slug && limits === undefined) return c.json({ error: 'Nothing to update' }, 400)

  const store = await queryOne(c.env.DB,
    'SELECT * FROM organization WHERE id = ?',
    [c.req.param('id')]
  )
  if (!store) return c.json({ error: 'Store not found' }, 404)
  const newName = name || store.name
  const newSlug = cleanSlug || store.slug

  // If slug changed, regenerate QR and delete old one
  if (newSlug !== store.slug) {
    generateStoreQR(c.env, newSlug).catch(() => {})
    deleteStoreQR(c.env, store.slug).catch(() => {})
  }

  let metadata = store.metadata || '{}'
  if (limits !== undefined) {
    let parsed = {}
    try { parsed = JSON.parse(metadata) } catch {}
    parsed.limits = limits
    metadata = JSON.stringify(parsed)
  }

  await execute(c.env.DB,
    'UPDATE organization SET name = ?, slug = ?, metadata = ? WHERE id = ?',
    [newName, newSlug, metadata, c.req.param('id')]
  )

  const updated = await queryOne(c.env.DB,
    'SELECT * FROM organization WHERE id = ?', [c.req.param('id')]
  )
  return c.json(updated)
})

router.delete('/:id', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Admin only' }, 403)

  await execute(c.env.DB,
    'DELETE FROM organization WHERE id = ?',
    [c.req.param('id')]
  )
  return c.json({ ok: true })
})

export { router as storesRouter }
