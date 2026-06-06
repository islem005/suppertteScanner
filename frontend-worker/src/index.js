// ─── Scanner Frontend Worker v3 ──────────────────────────────────────
// Serves the static frontend for *.ivond.com and ivond.com
// v3: Adds no-cache headers to fix stale Cloudflare edge cache issues
// ─────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const host = url.hostname
    // Handle favicon.ico — serve an inline SVG to avoid browser 404 noise
    if (url.pathname === '/favicon.ico') {
      return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#6366f1"/><path d="M8 12h16M8 16h16M8 20h10" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>', {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }
      })
    }

    const isAsset = /\.(css|js|json|svg|png|jpg|ico|woff2?|ttf|webmanifest|map)$/i.test(url.pathname)

    const noCacheHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Worker-Version': 'v3'
    }

    // ── Admin subdomain → admin panel
    if (host === 'admin.ivond.com' || host.startsWith('admin.')) {
      if (isAsset) return env.ASSETS.fetch(request)
      // Redirect root and /admin to /admin/ so relative paths in admin HTML resolve correctly
      if (url.pathname === '/' || url.pathname === '' || url.pathname === '/admin') {
        return Response.redirect(`https://${host}/admin/`, 301)
      }
      if (url.pathname.startsWith('/admin/')) {
        return env.ASSETS.fetch(new URL('/admin/index.html', request.url).href)
      }
      return new Response('Not found', { status: 404 })
    }

    // ── www redirect
    if (host.startsWith('www.')) {
      const canonical = new URL(request.url)
      canonical.hostname = host.slice(4)
      return Response.redirect(canonical.toString(), 301)
    }

    // ── Store subdomains — ALWAYS serve scanner.html
    if (host.endsWith('.ivond.com') && host !== 'ivond.com' && !host.startsWith('admin.')) {
      if (isAsset) return env.ASSETS.fetch(request)
      const resp = await env.ASSETS.fetch(new URL('/scanner.html', request.url))
      return new Response(resp.body, {
        status: resp.status,
        headers: { ...Object.fromEntries(resp.headers), ...noCacheHeaders, 'X-Worker-Version': 'v3-subdomain' }
      })
    }

    // ── Apex ivond.com: homepage, dashboard, auth
    if (isAsset) return env.ASSETS.fetch(request)
    const resp = await env.ASSETS.fetch(request)
    return new Response(resp.body, {
      status: resp.status,
      headers: { ...Object.fromEntries(resp.headers), ...noCacheHeaders, 'X-Worker-Version': 'v3-apex' }
    })
  }
}
