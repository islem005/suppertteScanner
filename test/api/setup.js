// ─── API Test Setup ──────────────────────────────────────────────────────
// Shared helpers for all API integration tests.
// All config is overridable via env vars for post-deploy testing.
// ────────────────────────────────────────────────────────────────────────

// @vitest-environment node

/** Base URL for the API (default: localhost:3002 for pre-deploy) */
export const API_BASE = process.env.API_BASE || 'http://localhost:3002/api'

/** The Origin header to send (default: ivond.com for post-deploy) */
export const ORIGIN = process.env.ORIGIN || 'http://localhost:5173'

/** Known test credentials (from seed script) — all overridable via env */
export const ADMIN_EMAIL   = process.env.ADMIN_EMAIL   || 'admin@store.com'
export const ADMIN_PASS    = process.env.ADMIN_PASS    || 'admin123'
export const MANAGER_EMAIL = process.env.MANAGER_EMAIL || 'manager@store.com'
export const MANAGER_PASS  = process.env.MANAGER_PASS  || 'manager123'

/** Default store slug used for read-only public tests */
export const STORE_SLUG = process.env.STORE_SLUG || 'my-store'

/**
 * A unique test store slug created per test run.
 * All mutation tests (create/update/delete) operate on this store
 * so they never touch the production "my-store" data.
 * Created lazily via getTestStoreId().
 */
const TEST_STORE_SLUG = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
let _testStoreId = null

/**
 * Get (or create) the disposable test store used by mutation tests.
 * Creates the store on first call via the admin endpoint.
 * Auto-cleaned by destroyTestStore() after all tests finish.
 */
export async function getTestStoreId(adminCookie) {
  if (_testStoreId) return _testStoreId

  // Try to find existing test store
  const stores = await (await authedGet(`${API_BASE}/stores`, adminCookie)).json()
  const existing = stores.find(s => s.slug === TEST_STORE_SLUG)
  if (existing) {
    _testStoreId = existing.id
    return _testStoreId
  }

  // Create a fresh test store
  const res = await authedPost(`${API_BASE}/stores`, adminCookie, {
    name: 'Test Store (auto-cleaned)',
    slug: TEST_STORE_SLUG
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Failed to create test store: ${res.status} ${body.error || ''}`)
  }
  const store = await res.json()
  _testStoreId = store.id
  return _testStoreId
}

/**
 * Destroy the test store and all its data.
 * Call in your test file's afterAll or globally.
 */
export async function destroyTestStore(adminCookie) {
  if (!_testStoreId) return
  const res = await authedDelete(`${API_BASE}/stores/${_testStoreId}`, adminCookie)
  _testStoreId = null
  if (!res.ok) {
    console.warn(`Warning: test store cleanup returned ${res.status}`)
  }
}

/**
 * Login and return session cookie + user info.
 * Returns { cookie, user, headers }
 */
export async function loginAs(email, password) {
  const res = await fetch(`${API_BASE}/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'skaner-csrf-token',
      'Origin': ORIGIN
    },
    body: JSON.stringify({ email, password })
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Login failed (${res.status}): ${body.message || body.error || 'unknown'}`)
  }

  // Extract set-cookie header
  const cookieHeader = res.headers.get('set-cookie') || ''
  // Better Auth may return multiple cookies; grab the session one
  const cookie = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ')

  const data = await res.json()
  return { cookie, user: data.user, headers: { Cookie: cookie } }
}

/**
 * Make an authenticated GET request.
 */
export async function authedGet(url, cookie) {
  return fetch(url, {
    headers: { Cookie: cookie, Origin: ORIGIN }
  })
}

/**
 * Make an authenticated POST request.
 */
export async function authedPost(url, cookie, body) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'skaner-csrf-token',
      Origin: ORIGIN,
      Cookie: cookie
    },
    body: JSON.stringify(body)
  })
}

/**
 * Make an authenticated PUT request.
 */
export async function authedPut(url, cookie, body) {
  return fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'skaner-csrf-token',
      Origin: ORIGIN,
      Cookie: cookie
    },
    body: JSON.stringify(body)
  })
}

/**
 * Make an authenticated DELETE request.
 */
export async function authedDelete(url, cookie) {
  return fetch(url, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': 'skaner-csrf-token', Origin: ORIGIN, Cookie: cookie }
  })
}

/**
 * Fetch a store ID by slug for test use.
 */
export async function getStoreIdBySlug(slug) {
  const res = await fetch(`${API_BASE}/stores/slug/${slug}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.id
}
