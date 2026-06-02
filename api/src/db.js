// ─── D1 Database Utility ──────────────────────────────────────────────
// Provides helper functions for common database operations.
// Replaces the old Supabase client factory.
// ────────────────────────────────────────────────────────────────────────

/**
 * Execute a query and return all results.
 * @param {import('..').D1Database} db - D1 binding
 * @param {string} sql - SQL statement with ? placeholders
 * @param {any[]} params - Bind parameters
 * @returns {Promise<any[]>}
 */
export async function queryAll(db, sql, params = []) {
  let stmt = db.prepare(sql)
  if (params.length > 0) stmt = stmt.bind(...params)
  const { results } = await stmt.all()
  return results || []
}

/**
 * Execute a query and return the first row or null.
 */
export async function queryOne(db, sql, params = []) {
  let stmt = db.prepare(sql)
  if (params.length > 0) stmt = stmt.bind(...params)
  const { results } = await stmt.all()
  return results?.[0] || null
}

/**
 * Execute a write query (INSERT/UPDATE/DELETE) and return the result info.
 */
export async function execute(db, sql, params = []) {
  let stmt = db.prepare(sql)
  if (params.length > 0) stmt = stmt.bind(...params)
  return stmt.run()
}

/**
 * Insert a row and return the full record.
 */
export async function insertAndReturn(db, table, data) {
  const columns = Object.keys(data)
  const values = Object.values(data)
  const placeholders = columns.map(() => '?').join(', ')
  const colNames = columns.map(c => `"${c}"`).join(', ')

  await execute(db,
    `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders})`,
    values
  )

  return queryOne(db, `SELECT * FROM "${table}" WHERE id = ?`, [data.id])
}

/**
 * Update a row and return the full record.
 */
export async function updateAndReturn(db, table, id, data) {
  const setClauses = Object.keys(data).map(k => `"${k}" = ?`).join(', ')
  const values = [...Object.values(data), id]

  await execute(db,
    `UPDATE "${table}" SET ${setClauses} WHERE id = ?`,
    values
  )

  return queryOne(db, `SELECT * FROM "${table}" WHERE id = ?`, [id])
}

/**
 * Generate a UUID v4 (same as crypto.randomUUID()).
 */
export function uuid() {
  return crypto.randomUUID()
}
