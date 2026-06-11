import { queryOne } from './db.js'

const DEFAULTS = {
  offersAlwaysShow: 3,
  offersActive: 20,
  discountsFeatured: 10,
  discountsActive: 100
}

export async function getStoreLimits(db, storeId) {
  const org = await queryOne(db, 'SELECT metadata FROM organization WHERE id = ?', [storeId])
  if (!org?.metadata) return { ...DEFAULTS }
  try {
    const parsed = JSON.parse(org.metadata)
    return { ...DEFAULTS, ...(parsed.limits || {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function countAlwaysShowOffers(db, storeId, excludeId) {
  let sql = "SELECT COUNT(*) as c FROM promotion WHERE store_id = ? AND type = 'offer' AND active = 1 AND trigger_type IS NULL"
  const params = [storeId]
  if (excludeId) { sql += ' AND id != ?'; params.push(excludeId) }
  const row = await queryOne(db, sql, params)
  return row?.c || 0
}

export async function countActiveOffers(db, storeId, excludeId) {
  let sql = "SELECT COUNT(*) as c FROM promotion WHERE store_id = ? AND type = 'offer' AND active = 1"
  const params = [storeId]
  if (excludeId) { sql += ' AND id != ?'; params.push(excludeId) }
  const row = await queryOne(db, sql, params)
  return row?.c || 0
}

export async function countFeaturedDiscounts(db, storeId, excludeId) {
  let sql = 'SELECT COUNT(*) as c FROM discount_item WHERE store_id = ? AND active = 1 AND featured = 1'
  const params = [storeId]
  if (excludeId) { sql += ' AND id != ?'; params.push(excludeId) }
  const row = await queryOne(db, sql, params)
  return row?.c || 0
}

export async function countActiveDiscounts(db, storeId, excludeId) {
  let sql = 'SELECT COUNT(*) as c FROM discount_item WHERE store_id = ? AND active = 1'
  const params = [storeId]
  if (excludeId) { sql += ' AND id != ?'; params.push(excludeId) }
  const row = await queryOne(db, sql, params)
  return row?.c || 0
}
