import { Router } from 'express'
import { supabase } from './db.js'
import { authenticate } from './middleware.js'

const router = Router()

router.get('/:storeId', async (req, res) => {
  const { data, error } = await supabase
    .from('store_branding')
    .select('*')
    .eq('store_id', req.params.storeId)
    .single()

  if (error) return res.json({
    store_id: req.params.storeId,
    primary_color: '#6366f1',
    accent_color: '#10b981'
  })

  res.json(data)
})

router.put('/:storeId', authenticate, async (req, res) => {
  const { logo_url, primary_color, accent_color, display_name, contact_email, contact_phone, footer_text, instagram_url, tiktok_url, website_url } = req.body

  const { data, error } = await supabase
    .from('store_branding')
    .upsert({
      store_id: req.params.storeId,
      logo_url: logo_url || null,
      primary_color: primary_color || '#6366f1',
      accent_color: accent_color || '#10b981',
      display_name: display_name || null,
      contact_email: contact_email || null,
      contact_phone: contact_phone || null,
      footer_text: footer_text || null,
      instagram_url: instagram_url || null,
      tiktok_url: tiktok_url || null,
      website_url: website_url || null
    }, { onConflict: 'store_id' })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

export { router as brandingRouter }
