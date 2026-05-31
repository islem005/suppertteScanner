// ─── D1 Admin Credential Store ──────────────────────────────────────────
// Stores admin users in Cloudflare D1 instead of Supabase
// Used by auth.js (password login) and cf-access.js (Access header login)
// ────────────────────────────────────────────────────────────────────────

/**
 * Look up an admin user by email in D1.
 * @param {import('..').D1Database} db - D1 binding (c.env.ADMIN_DB)
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export async function getAdminByEmail(db, email) {
  const { results } = await db.prepare('SELECT * FROM admin_users WHERE email = ?').bind(email).all()
  return results?.[0] || null
}

/**
 * Create a new admin user in D1.
 * @param {import('..').D1Database} db
 * @param {{ email: string, password_hash?: string, display_name?: string }} fields
 * @returns {Promise<string>} The new admin's ID
 */
export async function createAdmin(db, { email, password_hash, display_name }) {
  const id = crypto.randomUUID()
  await db.prepare(
    'INSERT INTO admin_users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
  ).bind(id, email, password_hash || null, display_name || 'Admin').run()
  return id
}

/**
 * Delete an admin user by email.
 * @param {import('..').D1Database} db
 * @param {string} email
 */
export async function deleteAdminByEmail(db, email) {
  await db.prepare('DELETE FROM admin_users WHERE email = ?').bind(email).run()
}

/**
 * Seed the default admin user (skip if exists).
 * @param {import('..').D1Database} db
 * @param {{ email: string, password_hash: string, display_name?: string }} fields
 */
export async function seedAdmin(db, { email, password_hash, display_name }) {
  const existing = await getAdminByEmail(db, email)
  if (existing) return false
  await createAdmin(db, { email, password_hash, display_name })
  return true
}
