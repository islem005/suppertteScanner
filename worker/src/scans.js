import { Router } from 'express'
import { supabase } from './db.js'
import { authenticate } from './middleware.js'

const router = Router()

router.post('/', async (req, res) => {
  const { store_slug, barcode } = req.body
  if (!store_slug || !barcode) {
    return res.status(400).json({ error: 'store_slug and barcode required' })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', store_slug)
    .single()

  if (!store) return res.status(404).json({ error: 'Store not found' })

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('store_id', store.id)
    .eq('barcode', barcode)
    .single()

  await supabase.from('scan_events').insert({
    store_id: store.id,
    product_id: product?.id || null,
    barcode
  })

  res.json({ ok: true })
})

router.get('/stats', authenticate, async (req, res) => {
  const storeId = req.query.store_id || req.user.store_id

  const { data: total } = await supabase
    .from('scan_events')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)

  const { data: today } = await supabase
    .from('scan_events')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .gte('scanned_at', new Date(new Date().setHours(0,0,0,0)).toISOString())

  const { data: topProducts } = await supabase
    .from('scan_events')
    .select('barcode, product_id')
    .eq('store_id', storeId)

  const topMap = {}
  if (topProducts) {
    for (const s of topProducts) {
      topMap[s.barcode] = (topMap[s.barcode] || 0) + 1
    }
  }
  const top = Object.entries(topMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([barcode, count]) => ({ barcode, count }))

  res.json({
    total: total?.length || 0,
    today: today?.length || 0,
    topProducts: top
  })
})

export { router as scansRouter }
