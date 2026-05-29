import { Router } from 'express'
import { supabase } from './db.js'
import { authenticate } from './middleware.js'

const router = Router()

router.get('/', authenticate, async (req, res) => {
  if (req.user.role === 'admin') {
    const { data } = await supabase.from('stores').select('*').order('name')
    return res.json(data || [])
  }
  const { data } = await supabase
    .from('stores')
    .select('*')
    .eq('id', req.user.store_id)
    .single()
  res.json(data ? [data] : [])
})

router.post('/', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' })
  }
  const { name, slug } = req.body
  if (!name || !slug) return res.status(400).json({ error: 'Name and slug required' })

  const { data, error } = await supabase
    .from('stores')
    .insert({ name, slug: slug.toLowerCase().replace(/\s+/g, '-') })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

router.get('/slug/:slug', async (req, res) => {
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, slug')
    .eq('slug', req.params.slug)
    .single()

  if (error) return res.status(404).json({ error: 'Store not found' })
  res.json(data)
})

router.get('/:id', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: 'Store not found' })
  if (req.user.role !== 'admin' && data.id !== req.user.store_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' })
  }
  const { error } = await supabase.from('stores').delete().eq('id', req.params.id)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true })
})

export { router as storesRouter }
