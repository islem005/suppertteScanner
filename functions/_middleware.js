// ─── Pages Function Middleware ─────────────────────────────────────────
// Serves the admin dashboard at the root for admin.ivond.com
// Everything else passes through to static assets normally.
// ────────────────────────────────────────────────────────────────────────

/**
 * @param {import('@cloudflare/workers-types').PagesFunctionContext} context
 */
export async function onRequest(context) {
  const { request, env, next } = context
  const url = new URL(request.url)
  const host = url.hostname

  // For admin subdomain, serve admin/index.html at root
  if (host === 'admin.ivond.com' || host.startsWith('admin.')) {
    // Root path → serve admin dashboard
    if (url.pathname === '/' || url.pathname === '') {
      const adminUrl = new URL(request.url)
      adminUrl.pathname = '/admin/'
      return env.ASSETS.fetch(adminUrl)
    }
    // If someone navigates to /admin directly, let it through
  }

  // Everything else: serve static assets normally
  return next()
}
