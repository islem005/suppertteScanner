import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuth } from './auth/index.js'
import { loadSession, adminOnly } from './middleware.js'
import { authRouter } from './routes/auth.js'
import { storesRouter } from './routes/stores.js'
import { productsRouter } from './routes/products.js'
import { lookupRouter } from './routes/lookup.js'
import { scansRouter } from './routes/scans.js'
import { brandingRouter } from './routes/branding.js'
import { adminRouter } from './routes/admin.js'
import { importsRouter } from './routes/imports.js'
import { promotionsRouter } from './routes/promotions.js'
import { discountsRouter } from './routes/discounts.js'
import { cfAccessRouter } from './routes/cf-access.js'
import { manifestRouter } from './routes/manifest.js'
import { registrationsRouter } from './routes/registrations.js'
import { uploadRouter } from './routes/upload.js'
import { filesRouter } from './routes/files.js'
import { pageViewsRouter } from './routes/page-views.js'
import { analyticsRouter } from './routes/analytics.js'
import { auditRouter } from './routes/audit.js'
import { teamRouter } from './routes/team.js'
import { changePasswordRouter } from './routes/change-password.js'
import { rateLimit } from './routes/rate-limit-middleware.js'
import { csrfProtection } from './csrf.js'

const app = new Hono()

// Dynamic CORS: echo back the request origin so credentialed requests
// work across store subdomains (my-store.ivond.com → api.ivond.com).
// Falls back to ivond.com if no Origin header is present.
app.use('*', cors({
  origin: (origin, c) => {
    // Allow requests with no origin (same-origin, curl, etc.)
    if (!origin) return 'https://ivond.com'
    // Allow any subdomain of ivond.com
    if (origin.endsWith('.ivond.com') || origin === 'https://ivond.com') {
      return origin
    }
    // Allow localhost for dev/preview
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      return origin
    }
    // Allow shelf-scanner.pages.dev for staging
    if (origin.endsWith('.pages.dev')) {
      return origin
    }
    // Default fallback
    return 'https://ivond.com'
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposeHeaders: ['Content-Type'],
  credentials: true
}))

// CSRF protection for all API routes
app.use('/api/*', csrfProtection())

// Custom auth routes — must be mounted BEFORE authRouter's catch-all
app.route('/api/auth/cf-access', cfAccessRouter)
app.route('/api/auth/change-password', changePasswordRouter)

// Load session for all authenticated API routes
app.use('/api/*', loadSession)

// Rate limiting for public-facing endpoints
app.use('/api/page-views/*', rateLimit({ maxRequests: 30, windowMs: 60000 }))
app.use('/api/registrations/*', rateLimit({ maxRequests: 10, windowMs: 60000 }))
app.use('/api/auth/*', rateLimit({ maxRequests: 20, windowMs: 60000 }))

// Also expose /api/setup as an alias for convenience
// (authRouter's catch-all forwards unmatched /api/auth/* to Better Auth)

app.route('/api/auth', authRouter)
app.route('/api/stores', storesRouter)
app.route('/api/products', productsRouter)
app.route('/api/lookup', lookupRouter)
app.route('/api/scans', scansRouter)
app.route('/api/branding', brandingRouter)
app.route('/api/admin', adminRouter)
app.route('/api/imports', importsRouter)
app.route('/api/promotions', promotionsRouter)
app.route('/api/discounts', discountsRouter)
app.route('/api/manifest', manifestRouter)
app.route('/api/registrations', registrationsRouter)
app.route('/api/upload', uploadRouter)
app.route('/api/files', filesRouter)
app.route('/api/page-views', pageViewsRouter)
app.route('/api/analytics', analyticsRouter)
app.route('/api/audit', auditRouter)
app.route('/api/team', teamRouter)

app.get('/api/health', (c) => c.json({ ok: true }))

// Debug: check what loadSession finds (admin only)
app.get('/api/debug/session', adminOnly, async (c) => {
  const rawHeaders = {}
  c.req.raw.headers.forEach((v, k) => { rawHeaders[k] = v })
  
  const cookie = c.req.raw.headers.get('cookie') || c.req.raw.headers.get('Cookie') || ''
  const match = cookie.match(/better-auth\.session_token=([^;]+)/)
  let tokenInfo = null
  if (match) {
    const raw = decodeURIComponent(match[1])
    const dotIdx = raw.indexOf('.')
    const token = dotIdx > 0 ? raw.substring(0, dotIdx) : raw
    tokenInfo = { raw_match: match[1], decoded_raw: raw, token }
  }
  
  let dbResult = null
  if (tokenInfo?.token) {
    try {
      const row = await c.env.DB.prepare('SELECT token, userId, expiresAt FROM session WHERE token = ?').bind(tokenInfo.token).first()
      dbResult = row ? 'FOUND' : 'NOT_FOUND'
    } catch (e) { dbResult = e.message }
  }
  
  return c.json({
    all_headers: rawHeaders,
    cookie_found: !!cookie,
    cookie_val: cookie ? cookie.substring(0, 80) : null,
    token_info: tokenInfo,
    db_result: dbResult,
    user: c.get('user')
  })
})

app.get('/', (c) => c.json({ name: 'ivond API', version: '1.0.0', status: 'running' }))

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

export default app
