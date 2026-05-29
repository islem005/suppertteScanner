import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { supabase } from './db.js'
import { authRouter } from './auth.js'
import { storesRouter } from './stores.js'
import { productsRouter } from './products.js'
import { lookupRouter } from './lookup.js'
import { scansRouter } from './scans.js'
import { brandingRouter } from './branding.js'
import { adminRouter } from './admin.js'
import { importsRouter } from './imports.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const pubLimiter = rateLimit({ windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false })
app.use('/api/lookup', pubLimiter)
app.use('/api/scans', pubLimiter)
app.use('/api/branding', pubLimiter)

async function seedDevData() {
  if (process.env.NODE_ENV === 'production') return

  let storeId = null
  const { data: existingStore } = await supabase.from('stores').select('id').eq('slug', 'test-store').single()
  if (!existingStore) {
    const { data: store } = await supabase.from('stores').insert({ name: 'Test Store', slug: 'test-store' }).select().single()
    if (store) storeId = store.id
    console.log('  ✓ Created test store')
  } else {
    storeId = existingStore.id
  }

  const hash = (p) => bcrypt.hashSync(p, 10)

  const { data: admin } = await supabase.from('store_users').select('id').eq('email', 'admin@test.com').single()
  if (!admin) {
    await supabase.from('store_users').insert({ email: 'admin@test.com', password_hash: hash('password123'), display_name: 'Admin', role: 'admin', store_id: null }).select().single()
    console.log('  ✓ Created admin user (admin@test.com / password123)')
  }

  const { data: mgr } = await supabase.from('store_users').select('id').eq('email', 'manager@test.com').single()
  if (!mgr && storeId) {
    await supabase.from('store_users').insert({ email: 'manager@test.com', password_hash: hash('password123'), display_name: 'Manager', role: 'manager', store_id: storeId }).select().single()
    console.log('  ✓ Created manager user (manager@test.com / password123)')
  }
}

app.use('/api/auth', authRouter)
app.use('/api/stores', storesRouter)
app.use('/api/products', productsRouter)
app.use('/api/lookup', lookupRouter)
app.use('/api/scans', scansRouter)
app.use('/api/branding', brandingRouter)
app.use('/api/admin', adminRouter)
app.use('/api/imports', importsRouter)

app.post('/api/setup', async (req, res) => {
  const { email, password, displayName, storeName, storeSlug } = req.body
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'email, password, displayName required' })
  }

  let storeId = null
  if (storeName && storeSlug) {
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .insert({ name: storeName, slug: storeSlug.toLowerCase().replace(/\s+/g, '-') })
      .select()
      .single()
    if (storeErr) return res.status(400).json({ error: storeErr.message })
    storeId = store.id
  }

  const { data: user, error } = await supabase
    .from('store_users')
    .insert({
      email, password_hash: await bcrypt.hash(password, 10),
      display_name: displayName,
      store_id: storeId,
      role: storeId ? 'manager' : 'admin'
    })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, store_id: user.store_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({ token, user: { ...user, password_hash: undefined } })
})

app.get('/api/health', (_, res) => res.json({ ok: true }))

app.listen(PORT, async () => {
  console.log(`API running on http://localhost:${PORT}`)
  await seedDevData()
})
