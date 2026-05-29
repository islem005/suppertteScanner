import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { supabase } from './db.js'
import { authenticate } from './middleware.js'

const router = Router()

router.use(authenticate)
router.use((req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  next()
})

// Dashboard overview stats
router.get('/stats', async (req, res) => {
  const { data: stores } = await supabase.from('stores').select('*')
  const { data: users } = await supabase.from('store_users').select('*')
  const { data: allProducts } = await supabase.from('products').select('id, store_id')
  const { data: scans } = await supabase.from('scan_events').select('*')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayScans = (scans || []).filter(s => new Date(s.scanned_at) >= today).length

  const storeStats = (stores || []).map(s => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    products: (allProducts || []).filter(p => p.store_id === s.id).length,
    scans: (scans || []).filter(sc => sc.store_id === s.id).length,
    users: (users || []).filter(u => u.store_id === s.id).length
  }))

  res.json({
    totalStores: (stores || []).length,
    totalUsers: (users || []).length,
    totalProducts: (allProducts || []).length,
    totalScans: (scans || []).length,
    todayScans,
    storeStats
  })
})

// List all users
router.get('/users', async (req, res) => {
  const { data } = await supabase
    .from('store_users')
    .select('id, email, display_name, role, store_id, created_at')

  const users = (data || []).map(u => {
    const { password_hash, ...safe } = u
    return safe
  })

  res.json(users)
})

// Create user
router.post('/users', async (req, res) => {
  const { email, password, displayName, storeId, role } = req.body
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'email, password, displayName required' })
  }

  const pwHash = await bcrypt.hash(password, 10)
  const { data, error } = await supabase
    .from('store_users')
    .insert({
      email,
      password_hash: pwHash,
      display_name: displayName,
      store_id: storeId || null,
      role: role || 'staff'
    })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  const { password_hash, ...safe } = data
  res.json(safe)
})

// Delete user
router.delete('/users/:id', async (req, res) => {
  const { error } = await supabase
    .from('store_users')
    .delete()
    .eq('id', req.params.id)

  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true })
})

// Store activity — per-store stats summary ordered by most recently created
router.get('/activity', async (req, res) => {
  const { data: stores } = await supabase.from('stores').select('*').order('created_at', 'DESC')
  const { data: users } = await supabase.from('store_users').select('*')
  const { data: allProducts } = await supabase.from('products').select('id, store_id')
  const { data: scans } = await supabase.from('scan_events').select('*')

  const limit = parseInt(req.query.limit) || 30

  const storeUserCounts = {}
  if (users) for (const u of users) {
    const sid = u.store_id || '__none__'
    storeUserCounts[sid] = (storeUserCounts[sid] || 0) + 1
  }

  const storeProductCounts = {}
  if (allProducts) for (const p of allProducts) {
    storeProductCounts[p.store_id] = (storeProductCounts[p.store_id] || 0) + 1
  }

  const storeScanCounts = {}
  if (scans) for (const s of scans) {
    storeScanCounts[s.store_id] = (storeScanCounts[s.store_id] || 0) + 1
  }

  const activity = (stores || []).slice(0, limit).map(s => ({
    store_id: s.id,
    store_name: s.name,
    store_slug: s.slug,
    created_at: s.created_at,
    products: storeProductCounts[s.id] || 0,
    scans: storeScanCounts[s.id] || 0,
    users: storeUserCounts[s.id] || 0
  }))

  res.json(activity)
})

export { router as adminRouter }
