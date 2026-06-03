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

  // ── www.ivond.com: redirect to ivond.com
  if (host.startsWith('www.')) {
    const canonical = new URL(request.url)
    canonical.hostname = host.slice(4)
    return Response.redirect(canonical.toString(), 301)
  }

  // ── Store subdomains: serve scanner.html for root, let assets through
  //     Host is *.ivond.com, not admin.ivond.com, not ivond.com itself
  if (host.endsWith('.ivond.com') && host !== 'ivond.com' && !host.startsWith('admin.')) {
    // Let actual files pass through (.css, .js, .json, .svg, etc.)
    if (/\.(css|js|json|svg|png|jpg|ico|woff2?|ttf|webmanifest)$/i.test(url.pathname)) {
      return next()
    }

    // SPA catch-all: serve scanner.html for all other paths
    const scannerUrl = new URL('/scanner.html', request.url)
    let resp = await env.ASSETS.fetch(new Request(scannerUrl, request))

    // Cloudflare Pages strips .html → redirects /scanner.html to /scanner.
    // Follow the redirect internally to prevent infinite loop.
    if ([301, 302, 307, 308].includes(resp.status)) {
      const location = new URL(resp.headers.get('Location'), request.url)
      resp = await env.ASSETS.fetch(new Request(location, request))
    }

    return resp
  }

  // ── Main domain (ivond.com): normal Pages routing
  return next()
}
