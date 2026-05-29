import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { supabase } from './db.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'
const SALT_ROUNDS = 10

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, store_id: user.store_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

router.post('/register', async (req, res) => {
  const { email, password, displayName, storeSlug, role } = req.body
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  let storeId = null
  if (storeSlug) {
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('id')
      .eq('slug', storeSlug)
      .single()
    if (storeErr || !store) return res.status(400).json({ error: 'Store not found' })
    storeId = store.id
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS)

  const { data: user, error } = await supabase
    .from('store_users')
    .insert({
      email,
      password_hash,
      display_name: displayName,
      store_id: storeId,
      role: role || 'staff'
    })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })

  const token = generateToken(user)
  res.json({ token, user: { ...user, password_hash: undefined } })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  const { data: user, error } = await supabase
    .from('store_users')
    .select('*')
    .eq('email', email)
    .single()

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = generateToken(user)
  const { password_hash, ...safe } = user
  res.json({ token, user: safe })
})

export { router as authRouter, JWT_SECRET }
