// ─── Branding Routes ─────────────────────────────────────────────────
// Per-store branding (colors, logo, social links).
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryOne, execute, uuid } from '../db.js'
import { authenticate, requireManagerOrAbove } from '../middleware.js'

const router = new Hono()

// Get branding (public, returns defaults if not set)
router.get('/:storeId', async (c) => {
  const branding = await queryOne(c.env.DB,
    'SELECT * FROM store_branding WHERE store_id = ?',
    [c.req.param('storeId')]
  )

  if (!branding) {
    return c.json({
      store_id: c.req.param('storeId'),
      primary_color: '#6366f1',
      accent_color: '#10b981'
    })
  }

  return c.json(branding)
})

// Update/create branding (manager or admin only)
router.put('/:storeId', authenticate, requireManagerOrAbove, async (c) => {
  const body = await c.req.json()
  const storeId = c.req.param('storeId')

  const existing = await queryOne(c.env.DB,
    'SELECT * FROM store_branding WHERE store_id = ?',
    [storeId]
  )

  // Allowed branding fields and their defaults for new records
  const ALL_FIELDS = {
    logo_url: null,
    primary_color: '#6366f1',
    accent_color: '#10b981',
    display_name: null,
    contact_email: null,
    contact_phone: null,
    footer_text: null,
    instagram_url: null,
    tiktok_url: null,
    website_url: null,
    facebook_url: null,
    twitter_url: null,
    youtube_url: null
  }

  if (existing) {
    // Partial update: only change fields present in the request body,
    // keep existing values for everything else
    const updates = {}
    for (const key of Object.keys(ALL_FIELDS)) {
      if (key in body) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map(k => `"${k}" = ?`).join(', ')
      const values = [...Object.values(updates), storeId]
      await execute(c.env.DB,
        `UPDATE store_branding SET ${setClauses} WHERE store_id = ?`,
        values
      )
    }
  } else {
    // New record: use body values with defaults for missing fields
    const data = {}
    for (const [key, defaultValue] of Object.entries(ALL_FIELDS)) {
      data[key] = key in body ? body[key] : defaultValue
    }

    const columns = ['store_id', ...Object.keys(data)]
    const placeholders = columns.map(() => '?').join(', ')
    const values = [storeId, ...Object.values(data)]

    await execute(c.env.DB,
      `INSERT INTO store_branding (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
      values
    )
  }

  const branding = await queryOne(c.env.DB,
    'SELECT * FROM store_branding WHERE store_id = ?',
    [storeId]
  )
  return c.json(branding)
})

export { router as brandingRouter }
