// ─── Scanner Frontend Worker v3 ──────────────────────────────────────
// Serves the static frontend for *.ivond.com and ivond.com
// v3: Adds no-cache headers to fix stale Cloudflare edge cache issues
// ─────────────────────────────────────────────────────────────────────

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://ivond.com https://*.ivond.com; manifest-src 'self' https://ivond.com https://*.ivond.com",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
}

function applySecurityHeaders(headers) {
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value)
  }
  return headers
}

function addSecurityToResponse(response) {
  const headers = new Headers(response.headers)
  applySecurityHeaders(headers)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const host = url.hostname
    // Handle favicon.ico — serve an inline SVG to avoid browser 404 noise
    if (url.pathname === '/favicon.ico') {
      const resp = new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#6366f1"/><path d="M8 12h16M8 16h16M8 20h10" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>', {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }
      })
      return addSecurityToResponse(resp)
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
      if (isAsset) return addSecurityToResponse(await env.ASSETS.fetch(request))
      // Redirect root and /admin to /admin/ so relative paths in admin HTML resolve correctly
      if (url.pathname === '/' || url.pathname === '' || url.pathname === '/admin') {
        return addSecurityToResponse(Response.redirect(`https://${host}/admin/`, 301))
      }
      if (url.pathname.startsWith('/admin/')) {
        return addSecurityToResponse(await env.ASSETS.fetch(new URL('/admin/index.html', request.url).href))
      }
      return addSecurityToResponse(new Response('Not found', { status: 404 }))
    }

    // ── www redirect
    if (host.startsWith('www.')) {
      const canonical = new URL(request.url)
      canonical.hostname = host.slice(4)
      return addSecurityToResponse(Response.redirect(canonical.toString(), 301))
    }

    // ── Store subdomains — ALWAYS serve scanner.html
    if (host.endsWith('.ivond.com') && host !== 'ivond.com' && !host.startsWith('admin.')) {
      if (isAsset) return addSecurityToResponse(await env.ASSETS.fetch(request))
      const resp = await env.ASSETS.fetch(new URL('/scanner.html', request.url))
      const newResp = new Response(resp.body, {
        status: resp.status,
        headers: { ...Object.fromEntries(resp.headers), ...noCacheHeaders, 'X-Worker-Version': 'v3-subdomain' }
      })
      return addSecurityToResponse(newResp)
    }

    // ── Apex ivond.com: homepage, dashboard, auth
    if (isAsset) return addSecurityToResponse(await env.ASSETS.fetch(request))
    const resp = await env.ASSETS.fetch(request)
    const newResp = new Response(resp.body, {
      status: resp.status,
      headers: { ...Object.fromEntries(resp.headers), ...noCacheHeaders, 'X-Worker-Version': 'v3-apex' }
    })
    return addSecurityToResponse(newResp)
  }
}
