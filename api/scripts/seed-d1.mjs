#!/usr/bin/env node

// ─── D1 Seed Script ──────────────────────────────────────────────────────
// Seeds the local D1 database with: store, admin/manager users, products,
// branding, promotions, discount items.
//
// Run: node api/scripts/seed-d1.mjs
// Requires: wrangler dev running on port 3002 (or update API_BASE)
// ────────────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3002/api'
const API_HEALTH = 'http://localhost:3002/api/health'

async function fetchJSON(url, method = 'GET', body = null, cookie = '') {
  const headers = { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }
  if (cookie) headers.Cookie = cookie

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data, cookie: res.headers.get('set-cookie') || '' }
}

async function loginAs(email, password) {
  const { status, data, cookie } = await fetchJSON(`${API_BASE}/auth/sign-in/email`, 'POST', { email, password })
  if (status !== 200) throw new Error(`Login failed (${status}): ${data.error || data.message || 'unknown'}`)
  // Extract just the session cookie name=value
  const sessionCookie = cookie.split(',').map(c => c.split(';')[0].trim()).join('; ')
  return { cookie: sessionCookie, user: data.user }
}

async function waitForAPI(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(API_HEALTH)
      if (res.ok) return true
    } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

async function seed() {
  console.log('Waiting for API...')
  if (!await waitForAPI()) {
    console.error('API not available. Start with: cd api && npx wrangler dev --port 3002')
    process.exit(1)
  }
  console.log('API ready.\n')

  // ── Step 1: Login as admin ──────────────────────────────────────────
  console.log('1. Logging in as admin...')
  let session
  try {
    session = await loginAs('admin@store.com', 'admin123')
    console.log(`   ✅ Admin logged in: ${session.user.name} (${session.user.id})`)
  } catch (e) {
    // Admin might not exist — create via sign-up
    console.log('   Admin not found, creating...')
    const r = await fetchJSON(`${API_BASE}/auth/sign-up/email`, 'POST', {
      name: 'Admin User',
      email: 'admin@store.com',
      password: 'admin123',
      role: 'admin'
    })
    if (r.status !== 200 && r.status !== 201) {
      console.error(`   ❌ Failed to create admin: ${r.data.error || r.data.message}`)
      process.exit(1)
    }
    session = await loginAs('admin@store.com', 'admin123')
    console.log(`   ✅ Admin created and logged in`)
  }

  const adminCookie = session.cookie

  // ── Step 2: Create organization (store) ────────────────────────────
  console.log('2. Creating store...')

  // Check if store already exists
  const storeCheck = await fetchJSON(`${API_BASE}/stores/slug/my-store`)
  let storeId
  if (storeCheck.status === 200) {
    storeId = storeCheck.data.id
    console.log(`   ✅ Store already exists: ${storeCheck.data.name} (${storeId})`)
  } else {
    // Create the store via Better Auth organization API
    // First try the stores route
    const r = await fetchJSON(`${API_BASE}/stores`, 'POST', {
      name: 'My Store',
      slug: 'my-store'
    }, adminCookie)
    if (r.status === 200) {
      storeId = r.data.id
      console.log(`   ✅ Store created: ${r.data.name} (${storeId})`)
    } else {
      // Try Better Auth organization API
      const r2 = await fetchJSON(`${API_BASE}/auth/organizations`, 'POST', {
        name: 'My Store',
        slug: 'my-store'
      }, adminCookie)
      if (r2.status === 200) {
        storeId = r2.data.id
        console.log(`   ✅ Store created via org API: ${r2.data.name} (${storeId})`)
      } else {
        console.error(`   ❌ Failed to create store: ${r.status} - ${JSON.stringify(r.data)}`)
        console.error(`   Orgs attempt: ${r2.status} - ${JSON.stringify(r2.data)}`)
        process.exit(1)
      }
    }
  }

  // ── Step 3: Create manager user ────────────────────────────────────
  console.log('3. Creating manager user...')
  try {
    const mgrLogin = await loginAs('manager@store.com', 'manager123')
    console.log(`   ✅ Manager already exists: ${mgrLogin.user.name}`)
  } catch {
    // Create manager via admin API or sign-up
    // Try sign-up first
    const r1 = await fetchJSON(`${API_BASE}/auth/sign-up/email`, 'POST', {
      name: 'Manager User',
      email: 'manager@store.com',
      password: 'manager123'
    }, '')
    
    if (r1.status === 200 || r1.status === 201) {
      console.log('   ✅ Manager created via sign-up')
    } else {
      console.log(`   Sign-up result: ${r1.status}`)
      // Try admin create user
      const r2 = await fetchJSON(`${API_BASE}/admin/users`, 'POST', {
        email: 'manager@store.com',
        password: 'manager123',
        displayName: 'Manager User',
        storeId: storeId,
        role: 'manager'
      }, adminCookie)
      if (r2.status === 200) {
        console.log('   ✅ Manager created via admin API')
      } else {
        console.log(`   Admin API result: ${r2.status} - ${JSON.stringify(r2.data)}`)
      }
    }
  }

  // ── Step 4: Seed products from seed.csv ────────────────────────────
  console.log('4. Seeding products...')
  const fs = await import('fs')
  const path = await import('path')
  const csvPath = path.resolve(process.cwd(), 'seed.csv')

  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const lines = csvContent.split('\n').filter(l => l.trim() && !l.startsWith('#'))
    const headers = lines[0].split(',')
    const products = []
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',')
      if (vals.length >= 3) {
        products.push({
          barcode: vals[0].trim(),
          name: vals[1].trim(),
          price: parseFloat(vals[2].trim()),
          category: vals[3]?.trim() || null
        })
      }
    }

    // Find existing products count
    const existingCheck = await fetchJSON(`${API_BASE}/products?store_id=${storeId}`, 'GET', null, adminCookie)
    const existingCount = existingCheck.status === 200 && Array.isArray(existingCheck.data)
      ? existingCheck.data.length : 0

    if (existingCount >= products.length) {
      console.log(`   ✅ ${existingCount} products already seeded`)
    } else {
      // Upload CSV to create products
      const csvLines = ['barcode,name,price,category']
      products.forEach(p => csvLines.push(`${p.barcode},${p.name},${p.price},${p.category || ''}`))
      const csvStr = csvLines.join('\n')

      const r = await fetchJSON(`${API_BASE}/products/upload`, 'POST', { csv: csvStr }, adminCookie)
      if (r.status === 200) {
        console.log(`   ✅ ${r.data.imported} products imported`)
      } else {
        console.log(`   Upload result: ${r.status} - ${JSON.stringify(r.data)}`)
        // Try individual product creation
        let count = 0
        for (const p of products) {
          const pr = await fetchJSON(`${API_BASE}/products`, 'POST', {
            barcode: p.barcode,
            name: p.name,
            price: p.price,
            category: p.category
          }, adminCookie)
          if (pr.status === 200) count++
        }
        console.log(`   ✅ ${count}/${products.length} products created individually`)
      }
    }
  } else {
    console.log(`   ⚠️ seed.csv not found at ${csvPath}`)
  }

  // ── Step 5: Create branding ────────────────────────────────────────
  console.log('5. Creating store branding...')
  const brandingCheck = await fetchJSON(`${API_BASE}/branding/${storeId}`)
  if (brandingCheck.status === 200 && brandingCheck.data.store_id) {
    console.log('   ✅ Branding already exists')
  } else {
    const r = await fetchJSON(`${API_BASE}/branding/${storeId}`, 'PUT', {
      logo_url: null,
      primary_color: '#6366f1',
      accent_color: '#10b981',
      display_name: 'My Store',
      contact_email: 'store@example.com',
      contact_phone: '+1-555-0100',
      footer_text: 'Fresh products, fair prices.'
    }, adminCookie)
    if (r.status === 200) {
      console.log('   ✅ Branding created')
    } else {
      console.log(`   Branding result: ${r.status} - ${JSON.stringify(r.data)}`)
    }
  }

  // ── Step 6: Create promotions ──────────────────────────────────────
  console.log('6. Creating promotions...')
  const bannersCheck = await fetchJSON(`${API_BASE}/promotions/banners/${storeId}`)
  const existingBanners = bannersCheck.status === 200 && Array.isArray(bannersCheck.data) ? bannersCheck.data : []

  if (existingBanners.length > 0) {
    console.log(`   ✅ ${existingBanners.length} banners already exist`)
  } else {
    // Create banner 1
    const r1 = await fetchJSON(`${API_BASE}/promotions`, 'POST', {
      store_id: storeId,
      type: 'banner',
      title: '🎉 Grand Opening Sale!',
      trigger_type: 'always',
      active: 1,
      priority: 10
    }, adminCookie)
    console.log(`   Banner 1: ${r1.status}`)

    // Create banner 2
    const r2 = await fetchJSON(`${API_BASE}/promotions`, 'POST', {
      store_id: storeId,
      type: 'banner',
      title: 'Fresh Produce Weekly Specials',
      trigger_type: 'always',
      active: 1,
      priority: 5
    }, adminCookie)
    console.log(`   Banner 2: ${r2.status}`)
  }

  const offersCheck = await fetchJSON(`${API_BASE}/promotions/offers/${storeId}`)
  const existingOffers = offersCheck.status === 200 && Array.isArray(offersCheck.data)

  if (existingOffers && existingOffers.length > 0) {
    console.log(`   ✅ ${existingOffers.length} offers already exist`)
  } else {
    // Create offer 1
    const r3 = await fetchJSON(`${API_BASE}/promotions`, 'POST', {
      store_id: storeId,
      type: 'offer',
      title: 'Buy 2 Get 1 Free on Dairy',
      trigger_type: 'category',
      trigger_value: 'Dairy',
      active: 1,
      priority: 8
    }, adminCookie)
    console.log(`   Offer 1: ${r3.status}`)

    // Create offer 2
    const r4 = await fetchJSON(`${API_BASE}/promotions`, 'POST', {
      store_id: storeId,
      type: 'offer',
      title: '20% Off All Beverages',
      trigger_type: 'category',
      trigger_value: 'Beverages',
      active: 1,
      priority: 6
    }, adminCookie)
    console.log(`   Offer 2: ${r4.status}`)

    // Create offer 3
    const r5 = await fetchJSON(`${API_BASE}/promotions`, 'POST', {
      store_id: storeId,
      type: 'offer',
      title: 'Coffee Lovers Special - 15% Off',
      trigger_type: 'barcode',
      trigger_value: '5901234123501',
      active: 1,
      priority: 7
    }, adminCookie)
    console.log(`   Offer 3: ${r5.status}`)
  }

  // ── Step 7: Create discount items ──────────────────────────────────
  console.log('7. Creating discount items...')
  const discountsCheck = await fetchJSON(`${API_BASE}/discounts/${storeId}`)
  const existingDiscounts = discountsCheck.status === 200 && Array.isArray(discountsCheck.data)

  if (existingDiscounts && existingDiscounts.length > 0) {
    console.log(`   ✅ ${existingDiscounts.length} discount items already exist`)
  } else {
    const discountItems = [
      { name: 'Organic Milk 1L', barcode: '5901234123457', original_price: 4.99, new_price: 3.99, discount_percent: 20, category: 'Dairy', featured: 1, priority: 10 },
      { name: 'Sourdough Bread', barcode: '5901234123464', original_price: 5.49, new_price: 3.99, discount_percent: 27, category: 'Bakery', featured: 1, priority: 8 },
      { name: 'Roasted Coffee Beans', barcode: '5901234123501', original_price: 14.99, new_price: 11.99, discount_percent: 20, category: 'Beverages', featured: 1, priority: 9 },
      { name: 'Dark Chocolate', barcode: '5901234123648', original_price: 3.99, new_price: 2.99, discount_percent: 25, category: 'Snacks', featured: 0, priority: 5 },
      { name: 'Extra Virgin Olive Oil', barcode: '5901234123570', original_price: 12.99, new_price: 9.99, discount_percent: 23, category: 'Oils', featured: 0, priority: 6 }
    ]

    let count = 0
    for (const d of discountItems) {
      const r = await fetchJSON(`${API_BASE}/discounts`, 'POST', {
        store_id: storeId,
        ...d
      }, adminCookie)
      if (r.status === 200) count++
      else console.log(`   Discount ${d.name}: ${r.status} - ${JSON.stringify(r.data)}`)
    }
    console.log(`   ✅ ${count}/${discountItems.length} discount items created`)
  }

  console.log('\n─── Seed complete ───')
}

seed().catch(e => {
  console.error('Seed failed:', e)
  process.exit(1)
})
