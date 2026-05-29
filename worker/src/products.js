import { Router } from 'express'
import { supabase } from './db.js'
import { authenticate } from './middleware.js'
import { parse } from 'csv-parse/sync'

const router = Router()

router.get('/', authenticate, async (req, res) => {
  const storeId = req.query.store_id || req.user.store_id
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .order('name')

  if (error) return res.status(400).json({ error: error.message })
  res.json(data || [])
})

router.post('/', authenticate, async (req, res) => {
  const { barcode, name, price, category } = req.body
  if (!barcode || !name || price === undefined) {
    return res.status(400).json({ error: 'Barcode, name, and price required' })
  }

  const { data, error } = await supabase
    .from('products')
    .upsert({
      store_id: req.user.store_id,
      barcode,
      name,
      price,
      category,
      updated_at: new Date().toISOString()
    }, { onConflict: 'store_id,barcode' })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

router.post('/upload', authenticate, async (req, res) => {
  const { csv } = req.body
  if (!csv) return res.status(400).json({ error: 'CSV content required' })

  let records
  try {
    records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })
  } catch {
    return res.status(400).json({ error: 'Invalid CSV format' })
  }

  const products = records.map(r => ({
    store_id: req.user.store_id,
    barcode: r.barcode || r.Barcode || r.BARCODE || '',
    name: r.name || r.Name || r.product_name || r.Product || '',
    price: parseFloat(r.price || r.Price || r.PRICE || 0),
    category: r.category || r.Category || r.CATEGORY || null,
    updated_at: new Date().toISOString()
  })).filter(p => p.barcode && p.name)

  if (products.length === 0) {
    return res.status(400).json({ error: 'No valid products found in CSV' })
  }

  const { data, error } = await supabase
    .from('products')
    .upsert(products, { onConflict: 'store_id,barcode' })
    .select()

  if (error) return res.status(400).json({ error: error.message })
  res.json({ imported: data.length })
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', req.params.id)
    .eq('store_id', req.user.store_id)

  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true })
})

export { router as productsRouter }
