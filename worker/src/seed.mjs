import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { supabase } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const storeSlug = process.argv[2] || 'my-store'

  // Find store
  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('slug', storeSlug)
    .single()

  if (!store) {
    console.error(`Store "${storeSlug}" not found. Run setup first.`)
    process.exit(1)
  }

  // Check for existing products
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('store_id', store.id)

  if (existing && existing.length > 0) {
    console.log(`Store "${store.name}" already has ${existing.length} products. Skipping seed.`)
    console.log('Delete them or use --force to reseed.')
    if (!process.argv.includes('--force')) process.exit(0)
    await supabase.from('products').delete().eq('store_id', store.id)
  }

  // Read CSV
  const csvPath = resolve(__dirname, '../../seed.csv')
  const csv = readFileSync(csvPath, 'utf-8')
  const lines = csv.trim().split('\n')

  const products = []
  const headers = lines[0].split(',')

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',')
    const product = {
      store_id: store.id,
      barcode: vals[0]?.trim(),
      name: vals[1]?.trim(),
      price: parseFloat(vals[2]?.trim()) || 0,
      category: vals[3]?.trim() || null
    }
    if (product.barcode && product.name) {
      products.push(product)
    }
  }

  // Insert in batches
  const BATCH = 25
  let imported = 0
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH)
    const { error } = await supabase.from('products').upsert(batch, { onConflict: 'store_id,barcode' })
    if (error) {
      console.error(`Batch ${i}: ${error.message}`)
    } else {
      imported += batch.length
    }
  }

  console.log(`\n  Imported ${imported} products into "${store.name}"`)
  console.log(`  Try scanning at: /${storeSlug}\n`)
}

main().catch(e => { console.error('Seed failed:', e); process.exit(1) })
