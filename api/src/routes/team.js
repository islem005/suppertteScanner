import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate, requireManagerOrAbove } from '../middleware.js'
import { createAuth } from '../auth/index.js'

const router = new Hono()

router.use('*', authenticate, requireManagerOrAbove)

router.get('/:storeId', async (c) => {
  const storeId = c.req.param('storeId')
  const user = c.get('user')

  if (user.role !== 'admin' && user.store_id !== storeId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const members = await queryAll(c.env.DB,
    "SELECT id, email, name, display_name, role, store_id, createdAt FROM user WHERE store_id = ? AND role = 'associate' ORDER BY name",
    [storeId]
  )

  return c.json(members)
})

router.post('/:storeId', async (c) => {
  const storeId = c.req.param('storeId')
  const user = c.get('user')

  if (user.role !== 'admin' && user.store_id !== storeId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const { email, password, displayName } = await c.req.json()
  if (!email || !password || !displayName) {
    return c.json({ error: 'email, password, and displayName required' }, 400)
  }

  const auth = createAuth(c.env)

  let result
  try {
    result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: displayName,
        display_name: displayName,
        store_id: storeId
      }
    })
  } catch (err) {
    return c.json({ error: err.message || 'Failed to create user' }, 400)
  }

  await execute(c.env.DB,
    "UPDATE user SET role = 'associate' WHERE id = ?",
    [result.user.id]
  )

  const created = await queryOne(c.env.DB,
    'SELECT id, email, name, display_name, role, store_id, createdAt FROM user WHERE id = ?',
    [result.user.id]
  )

  return c.json(created)
})

router.delete('/:storeId/:userId', async (c) => {
  const storeId = c.req.param('storeId')
  const userId = c.req.param('userId')
  const user = c.get('user')

  if (user.role !== 'admin' && user.store_id !== storeId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const target = await queryOne(c.env.DB,
    'SELECT id, role, store_id FROM user WHERE id = ?',
    [userId]
  )

  if (!target) return c.json({ error: 'User not found' }, 404)
  if (target.role !== 'associate') return c.json({ error: 'Can only delete associate users' }, 400)
  if (target.store_id !== storeId) return c.json({ error: 'User is not in this store' }, 400)

  await execute(c.env.DB, 'DELETE FROM session WHERE userId = ?', [userId])
  await execute(c.env.DB, 'DELETE FROM account WHERE userId = ?', [userId])
  await execute(c.env.DB, 'DELETE FROM member WHERE userId = ?', [userId])
  await execute(c.env.DB, 'DELETE FROM user WHERE id = ?', [userId])

  return c.json({ ok: true })
})

export { router as teamRouter }
