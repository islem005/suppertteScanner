import { Hono } from 'hono'
import { queryOne, execute, uuid, upsertClientDevice } from '../db.js'

const router = new Hono()

router.post('/', async (c) => {
  const { store_slug, client_id, session_id, device_type, referrer } = await c.req.json()
  if (!store_slug || !session_id) {
    return c.json({ error: 'store_slug and session_id required' }, 400)
  }

  const store = await queryOne(c.env.DB,
    'SELECT id FROM organization WHERE slug = ?',
    [store_slug]
  )
  if (!store) return c.json({ error: 'Store not found' }, 404)

  await execute(c.env.DB,
    `INSERT INTO page_view (id, store_id, client_id, session_id, referrer, device_type, viewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), store.id, client_id || null, session_id, referrer || null, device_type || null, new Date().toISOString()]
  )

  if (client_id) {
    const userAgent = c.req.header('user-agent')
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')
    await upsertClientDevice(c.env.DB, {
      id: client_id,
      storeId: store.id,
      userAgent,
      ip,
      deviceType: device_type
    })
  }

  return c.json({ ok: true })
})

export { router as pageViewsRouter }
