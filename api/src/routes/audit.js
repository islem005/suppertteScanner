import { Hono } from 'hono'
import { queryAll, execute, uuid } from '../db.js'
import { authenticate, requireManagerOrAbove } from '../middleware.js'

const router = new Hono()

export async function logAudit(env, { storeId, userId, userName, userRole, action, entityType, entityId, details }) {
  try {
    await execute(env.DB,
      `INSERT INTO audit_log (id, store_id, user_id, user_name, user_role, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), storeId, userId, userName || null, userRole || null, action, entityType, entityId || null, details ? JSON.stringify(details) : null]
    )
  } catch (err) {
    console.error('Audit log error:', err)
  }
}

router.get('/:storeId', authenticate, requireManagerOrAbove, async (c) => {
  const storeId = c.req.param('storeId')
  const user = c.get('user')
  const limit = parseInt(c.req.query('limit')) || 50
  const offset = parseInt(c.req.query('offset')) || 0

  if (user.role !== 'admin' && user.store_id !== storeId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const logs = await queryAll(c.env.DB,
    `SELECT * FROM audit_log WHERE store_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [storeId, limit, offset]
  )

  const totalRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as c FROM audit_log WHERE store_id = ?'
  ).bind(storeId).first()

  return c.json({
    logs: logs || [],
    total: totalRow?.c || 0,
    limit,
    offset
  })
})

export { router as auditRouter }
