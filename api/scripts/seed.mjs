// ─── Dev/Prod Seed Script ──────────────────────────────────────────────
// Seeds default store, users, branding, promotions, discounts, and products
// Connects to Supabase directly using env vars (works with any Supabase project)
// Usage: node api/scripts/seed.mjs [slug] [--force]
// ────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wlutqwabjuevlrvvrqjf.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsdXRxd2FianVldmxydnZycWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzEwMDAsImV4cCI6MjA5NTY0NzAwMH0.UNwQxsGpxQrRrJ7baipFx1DA5PJv-5Ib1jZDj-PZO5M'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function _svgDataUri(svg) {
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

async function main() {
  const storeSlug = process.argv[2] || 'my-store'
  const force = process.argv.includes('--force')
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@store.com'
  const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123'
  const STORE_NAME = process.env.STORE_NAME || 'My Store'
  const MANAGER_EMAIL = process.env.MANAGER_EMAIL || 'manager@store.com'
  const MANAGER_PASS = process.env.MANAGER_PASS || 'manager123'

  console.log(`\n  ── Seeding Supabase project: ${SUPABASE_URL}\n`)

  // ─── 1. Store ──────────────────────────────────────────────────────────
  let storeId = null
  const { data: existingStore } = await supabase
    .from('stores').select('id').eq('slug', storeSlug).single()

  if (existingStore) {
    storeId = existingStore.id
    console.log(`  ✓ Store "${STORE_NAME}" (${storeSlug}) already exists`)
  } else {
    const { data: store, error } = await supabase
      .from('stores').insert({ name: STORE_NAME, slug: storeSlug }).select().single()
    if (error) { console.error('  ✗ Failed to create store:', error.message); process.exit(1) }
    storeId = store.id
    console.log(`  ✓ Created store "${STORE_NAME}" (${storeSlug})`)
  }

  // ─── 2. Admin user (D1 via Worker endpoint) ────────────────────────────
  // Seed admin in Cloudflare D1 (admin credentials live outside Supabase)
  const ADMIN_API = process.env.ADMIN_API || 'http://localhost:3002'
  try {
    const seedRes = await fetch(`${ADMIN_API}/api/auth/seed-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS, displayName: 'Admin' })
    })
    const seedData = await seedRes.json()
    if (seedRes.ok) {
      console.log(`  ✓ Created admin in D1: ${ADMIN_EMAIL}`)
    } else if (seedRes.status === 409) {
      console.log(`  ✓ Admin "${ADMIN_EMAIL}" already exists in D1`)
    } else {
      console.warn(`  ⚠ D1 admin seed: ${seedData.error || seedRes.status}`)
    }
  } catch (e) {
    console.warn(`  ⚠ Could not reach Worker API for D1 admin seed: ${e.message}`)
  }

  // Also keep admin in Supabase store_users for backward compat (manager/staff etc.)
  // D1 is now the primary store for admin credentials
  const { data: existingAdmin } = await supabase
    .from('store_users').select('id').eq('email', ADMIN_EMAIL).single()
  if (!existingAdmin) {
    const pwHash = await bcrypt.hash(ADMIN_PASS, 10)
    await supabase.from('store_users').insert({
      email: ADMIN_EMAIL, password_hash: pwHash,
      display_name: 'Admin', store_id: null, role: 'admin'
    }).then(() => {}, () => {})
  }

  // ─── 3. Manager user ───────────────────────────────────────────────────
  const { data: existingManager } = await supabase
    .from('store_users').select('id').eq('email', MANAGER_EMAIL).single()

  if (existingManager) {
    console.log(`  ✓ Manager "${MANAGER_EMAIL}" already exists`)
  } else {
    const password_hash = await bcrypt.hash(MANAGER_PASS, 10)
    const { error } = await supabase.from('store_users').insert({
      email: MANAGER_EMAIL, password_hash,
      display_name: 'Store Manager', store_id: storeId, role: 'manager'
    })
    if (error) console.error('  ✗ Failed to create manager:', error.message)
    else console.log(`  ✓ Created manager: ${MANAGER_EMAIL}`)
  }

  // ─── 4. Branding ──────────────────────────────────────────────────────
  const logoUrl = _svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">' +
    '<defs><radialGradient id="g" cx="50%" cy="50%" r="50%">' +
    '<stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#4338ca"/>' +
    '</radialGradient></defs>' +
    '<circle cx="150" cy="150" r="150" fill="url(#g)"/>' +
    '<text x="150" y="175" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="140" font-weight="800" fill="white" letter-spacing="-2">I</text></svg>'
  )

  const { data: existingBrand } = await supabase
    .from('store_branding').select('store_id').eq('store_id', storeId).single()

  if (existingBrand) {
    console.log('  ✓ Branding already exists')
  } else {
    const { error } = await supabase.from('store_branding').upsert({
      store_id: storeId,
      display_name: STORE_NAME,
      logo_url: logoUrl,
      primary_color: '#6366f1',
      accent_color: '#10b981',
      contact_email: 'hello@ivond.market',
      contact_phone: '+213 555-0123',
      footer_text: '© 2026 Ivond Market — Fresh, Fast, Fair',
      instagram_url: 'https://instagram.com/ivondmarket',
      tiktok_url: 'https://tiktok.com/@ivondmarket',
      website_url: 'https://ivond.market'
    }, { onConflict: 'store_id' })
    if (error) console.error('  ✗ Failed to create branding:', error.message)
    else console.log('  ✓ Seeded branding with social links')
  }

  // ─── 5. Promotions (banners) ──────────────────────────────────────────
  const banner1Url = _svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300" viewBox="0 0 800 300">' +
    '<defs><linearGradient id="b" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="#1e1b4b"/><stop offset="50%" stop-color="#312e81"/>' +
    '<stop offset="100%" stop-color="#4338ca"/></linearGradient></defs>' +
    '<rect width="800" height="300" fill="url(#b)" rx="12"/>' +
    '<circle cx="680" cy="50" r="120" fill="rgba(99,102,241,0.15)"/>' +
    '<circle cx="120" cy="280" r="140" fill="rgba(16,185,129,0.08)"/>' +
    '<text x="400" y="110" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="48" font-weight="800" fill="#fafafa" letter-spacing="-1">Weekly Specials</text>' +
    '<text x="400" y="160" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="22" font-weight="600" fill="#a1a1aa">Up to 50% off — Selected Items</text>' +
    '<rect x="310" y="195" width="180" height="48" rx="24" fill="#10b981"/>' +
    '<text x="400" y="227" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="17" font-weight="700" fill="white">Shop Now →</text></svg>'
  )

  const banner2Url = _svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300" viewBox="0 0 800 300">' +
    '<defs><linearGradient id="b2" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="#065f46"/><stop offset="50%" stop-color="#047857"/>' +
    '<stop offset="100%" stop-color="#059669"/></linearGradient></defs>' +
    '<rect width="800" height="300" fill="url(#b2)" rx="12"/>' +
    '<circle cx="120" cy="50" r="100" fill="rgba(16,185,129,0.12)"/>' +
    '<circle cx="680" cy="280" r="130" fill="rgba(245,158,11,0.1)"/>' +
    '<text x="400" y="110" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="48" font-weight="800" fill="#fafafa" letter-spacing="-1">New Arrivals</text>' +
    '<text x="400" y="160" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="22" font-weight="600" fill="#a1a1aa">Fresh products added weekly</text>' +
    '<rect x="310" y="195" width="180" height="48" rx="24" fill="#f59e0b"/>' +
    '<text x="400" y="227" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="17" font-weight="700" fill="white">Browse Now →</text></svg>'
  )

  const { data: existingBanners } = await supabase
    .from('promotions').select('id').eq('store_id', storeId).eq('type', 'banner')

  if (!existingBanners || existingBanners.length === 0) {
    await supabase.from('promotions').insert([
      { store_id: storeId, type: 'banner', title: 'Weekly Specials — Up to 50% off!', image_data: banner1Url, active: 1, priority: 0 },
      { store_id: storeId, type: 'banner', title: 'New Arrivals — Fresh Weekly', image_data: banner2Url, active: 1, priority: 1 }
    ])
    console.log('  ✓ Seeded 2 banners')
  } else {
    console.log('  ✓ Banners already exist')
  }

  // ─── 6. Offers ─────────────────────────────────────────────────────────
  const offer1Url = _svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">' +
    '<defs><linearGradient id="o1" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="#065f46"/><stop offset="100%" stop-color="#047857"/>' +
    '</linearGradient></defs><rect width="400" height="200" fill="url(#o1)" rx="12"/>' +
    '<text x="200" y="65" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="36" font-weight="800" fill="#fafafa">Buy 2 Get 1 Free</text>' +
    '<text x="200" y="105" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="18" font-weight="600" fill="#6ee7b7">On all Beverages!</text>' +
    '<rect x="120" y="130" width="160" height="36" rx="18" fill="#f59e0b"/>' +
    '<text x="200" y="154" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="14" font-weight="700" fill="white">Use at checkout</text></svg>'
  )

  const offer2Url = _svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">' +
    '<defs><linearGradient id="o2" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="#7c2d12"/><stop offset="100%" stop-color="#9a3412"/>' +
    '</linearGradient></defs><rect width="400" height="200" fill="url(#o2)" rx="12"/>' +
    '<text x="200" y="65" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="40" font-weight="800" fill="#fafafa">20% OFF</text>' +
    '<text x="200" y="105" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="18" font-weight="600" fill="#fdba74">Weekend Special</text>' +
    '<rect x="120" y="130" width="160" height="36" rx="18" fill="#10b981"/>' +
    '<text x="200" y="154" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="14" font-weight="700" fill="white">Scan & Save →</text></svg>'
  )

  const placeholderUrl = _svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">' +
    '<defs><linearGradient id="pd" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#312e81"/>' +
    '</linearGradient></defs><rect width="400" height="200" fill="url(#pd)" rx="12"/>' +
    '<text x="200" y="75" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="40" font-weight="800" fill="#fafafa">Welcome!</text>' +
    '<text x="200" y="120" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="18" font-weight="600" fill="#a1a1aa">Scan a product to see prices</text>' +
    '<rect x="120" y="145" width="160" height="36" rx="18" fill="#6366f1"/>' +
    '<text x="200" y="169" text-anchor="middle" font-family="Inter, sans-serif" ' +
    'font-size="14" font-weight="700" fill="white">Start scanning →</text></svg>'
  )

  const { data: existingOffers } = await supabase
    .from('promotions').select('id').eq('store_id', storeId).eq('type', 'offer')

  if (!existingOffers || existingOffers.length === 0) {
    await supabase.from('promotions').insert([
      { store_id: storeId, type: 'offer', title: 'Welcome — Scan to explore', image_data: placeholderUrl, active: 1, priority: 10 },
      { store_id: storeId, type: 'offer', title: 'Buy 2 Get 1 Free — Beverages', image_data: offer1Url, trigger_type: 'category', trigger_value: 'Beverages', active: 1, priority: 0 },
      { store_id: storeId, type: 'offer', title: 'Weekend Special 20% off', image_data: offer2Url, trigger_type: 'product', trigger_value: '5901234123457', active: 1, priority: 0 }
    ])
    console.log('  ✓ Seeded 3 offers')
  } else {
    console.log('  ✓ Offers already exist')
  }

  // ─── 7. Discount items ─────────────────────────────────────────────────
  function discSvg(name) {
    return _svgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">` +
      `<defs><linearGradient id="d" x1="0%" y1="0%" x2="100%" y2="100%">` +
      `<stop offset="0%" stop-color="#312e81"/><stop offset="100%" stop-color="#4338ca"/>` +
      `</linearGradient></defs><rect width="400" height="400" fill="url(#d)" rx="16"/>` +
      `<circle cx="200" cy="120" r="60" fill="rgba(99,102,241,0.3)"/>` +
      `<text x="200" y="135" text-anchor="middle" font-family="Inter,sans-serif" ` +
      `font-size="14" font-weight="600" fill="#fafafa">${name}</text>` +
      `<rect x="100" y="200" width="200" height="120" rx="12" fill="rgba(255,255,255,0.08)"/>` +
      `<text x="200" y="235" text-anchor="middle" font-family="Inter,sans-serif" ` +
      `font-size="13" font-weight="500" fill="#a1a1aa">Original</text>` +
      `<text x="200" y="255" text-anchor="middle" font-family="Inter,sans-serif" ` +
      `font-size="16" font-weight="700" fill="#fafafa" text-decoration="line-through">$</text>` +
      `<text x="200" y="285" text-anchor="middle" font-family="Inter,sans-serif" ` +
      `font-size="16" font-weight="600" fill="#a1a1aa">Now</text>` +
      `<text x="200" y="305" text-anchor="middle" font-family="Inter,sans-serif" ` +
      `font-size="28" font-weight="800" fill="#10b981">$</text></svg>`
    )
  }

  const { data: existingDiscounts } = await supabase
    .from('discount_items').select('id').eq('store_id', storeId)

  if (!existingDiscounts || existingDiscounts.length === 0) {
    await supabase.from('discount_items').insert([
      { store_id: storeId, barcode: '5901234123457', name: 'Organic Honey', category: 'Groceries', image_data: discSvg('Organic Honey'), original_price: 12.99, new_price: 9.99, discount_percent: 23, featured: 1, priority: 10 },
      { store_id: storeId, barcode: '5901234123464', name: 'Orange Juice', category: 'Beverages', image_data: discSvg('Orange Juice'), original_price: 5.49, new_price: 3.99, discount_percent: 27, featured: 1, priority: 9 },
      { store_id: storeId, barcode: '5901234123471', name: 'Mixed Nuts 200g', category: 'Snacks', image_data: discSvg('Mixed Nuts'), original_price: 8.99, new_price: 6.49, discount_percent: 28, featured: 1, priority: 8 },
      { store_id: storeId, barcode: '5901234123488', name: 'Sparkling Water', category: 'Beverages', image_data: discSvg('Sparkling Water'), original_price: 2.99, new_price: 1.99, discount_percent: 33, featured: 0, priority: 7 },
      { store_id: storeId, barcode: null, name: 'Dark Chocolate', category: 'Snacks', image_data: discSvg('Dark Chocolate'), original_price: 6.99, new_price: 4.99, discount_percent: 29, featured: 0, priority: 6 }
    ])
    console.log('  ✓ Seeded 5 discount items')
  } else {
    console.log('  ✓ Discount items already exist')
  }

  // ─── 8. Products from seed.csv ─────────────────────────────────────────
  const csvPath = resolve(__dirname, '../../seed.csv')
  let csv
  try {
    csv = readFileSync(csvPath, 'utf-8')
  } catch {
    console.log('  - No seed.csv found, skipping product seeding')
    process.exit(0)
  }

  const { data: existingProducts } = await supabase
    .from('products').select('id').eq('store_id', storeId)

  if (existingProducts && existingProducts.length > 0) {
    if (force) {
      await supabase.from('products').delete().eq('store_id', storeId)
      console.log('  ✓ Cleared existing products (--force)')
    } else {
      console.log(`  ✓ ${existingProducts.length} products already exist (use --force to re-seed)`)
      process.exit(0)
    }
  }

  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',')
  const products = []

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',')
    const product = {
      store_id: storeId,
      barcode: vals[0]?.trim(),
      name: vals[1]?.trim(),
      price: parseFloat(vals[2]?.trim()) || 0,
      category: vals[3]?.trim() || null
    }
    if (product.barcode && product.name) {
      products.push(product)
    }
  }

  const BATCH = 25
  let imported = 0
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH)
    const { error } = await supabase.from('products').upsert(batch, { onConflict: 'store_id,barcode' })
    if (error) {
      console.error(`  ✗ Batch ${i}: ${error.message}`)
    } else {
      imported += batch.length
    }
  }

  console.log(`  ✓ Seeded ${imported} products into "${STORE_NAME}"`)

  console.log(`\n  ── Seed complete ──\n`)
  console.log(`  Store slug:      ${storeSlug}`)
  console.log(`  Admin:           ${ADMIN_EMAIL}`)
  console.log(`  Manager:         ${MANAGER_EMAIL}`)
  console.log(`  Products:        ${imported}`)
  console.log()
}

main().catch(e => { console.error('Seed failed:', e); process.exit(1) })
