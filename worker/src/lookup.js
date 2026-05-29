import { Router } from 'express'
import { supabase } from './db.js'

const router = Router()

router.get('/:slug', async (req, res) => {
  const { barcode } = req.query
  if (!barcode) return res.status(400).json({ error: 'Barcode query param required' })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', req.params.slug)
    .single()

  if (!store) return res.status(404).json({ error: 'Store not found' })

  const { data: product } = await supabase
    .from('products')
    .select('barcode, name, price, category')
    .eq('store_id', store.id)
    .eq('barcode', barcode)
    .single()

  if (!product) {
    return res.json({ found: false, barcode })
  }

  res.json({ found: true, ...product })
})

export { router as lookupRouter }
