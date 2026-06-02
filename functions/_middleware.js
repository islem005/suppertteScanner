// ─── Pages Function Middleware ─────────────────────────────────────────
// Routes by hostname:
//   admin.ivond.com    → admin panel (behind Cloudflare Access)
//   *.ivond.com        → scanner.html (store subdomains — slug from hostname)
//   ivond.com/*        → normal Pages routing (homepage, dashboard, auth)
// ────────────────────────────────────────────────────────────────────────

/**
 * @param {import('@cloudflare/workers-types').PagesFunctionContext} context
 */
export async function onRequest(context) {
  const { request, env, next } = context
  const url = new URL(request.url)
  const host = url.hostname

  // ── API routes: let them pass through to static assets
  //     (excluded from Pages by _routes.json, so they hit the Worker route)
  if (url.pathname.startsWith('/api/')) {
    return next()
  }

  // ── Admin subdomain: redirect root to /admin/ for Cloudflare Access protection
  if (host === 'admin.ivond.com' || host.startsWith('admin.')) {
    if (url.pathname === '/' || url.pathname === '') {
      return Response.redirect('https://' + host + '/admin/', 301)
    }
    // Serve normally for /admin/* paths
    return next()
  }

  // ── Store subdomains: serve scanner.html for every path
  //     Host is *.ivond.com, not admin.ivond.com, not ivond.com itself
  if (host.endsWith('.ivond.com') && host !== 'ivond.com' && !host.startsWith('admin.')) {
    // SPA catch-all: serve scanner.html for all store subdomain paths
    const scannerUrl = new URL('/scanner.html', request.url)
    return env.ASSETS.fetch(new Request(scannerUrl, request))
  }

  // ── Main domain (ivond.com): normal Pages routing
  return next()
}
