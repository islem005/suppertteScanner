// ─── Scanner Frontend Worker v3 ──────────────────────────────────────
// Serves the static frontend for *.ivond.com and ivond.com
// v3: Adds no-cache headers to fix stale Cloudflare edge cache issues
// ─────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const host = url.hostname
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
      if (url.pathname.startsWith('/admin/') || url.pathname === '/admin') {
        return env.ASSETS.fetch(request)
      }
      const resp = await env.ASSETS.fetch(new URL('/admin/index.html', request.url))
      return new Response(resp.body, {
        status: resp.status,
        headers: { ...Object.fromEntries(resp.headers), ...noCacheHeaders, 'X-Worker-Version': 'v3-admin' }
      })
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
