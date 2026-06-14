// ─── Scanner Frontend Worker v4 ──────────────────────────────────────
// Serves the static frontend for *.ivond.com and ivond.com
// v4: Desktop User-Agent → scanner-qr.html (QR code interstitial)
// v3: Added no-cache headers to fix stale Cloudflare edge cache issues
// ─────────────────────────────────────────────────────────────────────

// ─── Scanner Frontend Worker v5 ──────────────────────────────────────
// v5: sw.js excluded from asset cache, bumped SW cache to fix stale carousel
// ─────────────────────────────────────────────────────────────────────

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://ivond.com https://*.ivond.com https://unpkg.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com; manifest-src 'self' https://ivond.com https://*.ivond.com",
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
      'X-Worker-Version': 'v5'
    }

    const isSwJs = url.pathname.endsWith('/sw.js')

    // ── sw.js: serve with no-cache so browser always checks for updates
    if (isSwJs && isAsset) {
      const resp = await env.ASSETS.fetch(request)
      const headers = new Headers(resp.headers)
      for (const [key, val] of Object.entries(noCacheHeaders)) headers.set(key, val)
      return addSecurityToResponse(new Response(resp.body, { status: resp.status, headers }))
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

    // ── Store subdomains — serve scanner.html (mobile) or scanner-qr.html (desktop)
    if (host.endsWith('.ivond.com') && host !== 'ivond.com' && !host.startsWith('admin.')) {
      if (isAsset) return addSecurityToResponse(await env.ASSETS.fetch(request))
      const ua = (request.headers.get('User-Agent') || '').toLowerCase()
      const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua)
      // Android must use Chrome — zbar-wasm fallback is unreliable
      if (/android/.test(ua) && !/chrome/.test(ua)) {
        const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chrome Required</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;background:#0f0f1a;color:#e2e8f0}svg{width:80px;height:80px;margin-bottom:16px}h1{font-size:24px;margin:0 0 8px}p{font-size:16px;color:#94a3b8;max-width:400px;line-height:1.5;margin:0 0 24px}.btn{display:inline-block;padding:14px 32px;background:#4285f4;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px}.note{font-size:13px;color:#64748b;margin-top:24px}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#4285f4"/><path d="M14 20l10-8 10 8v12a2 2 0 01-2 2H16a2 2 0 01-2-2V20z" fill="#fff" opacity=".9"/><circle cx="24" cy="24" r="4" fill="#4285f4"/></svg><h1>Open in Chrome</h1><p>The scanner requires Chrome on Android for reliable barcode detection. Please open this page in the Chrome browser.</p><a class="btn" href="intent://' + host + url.pathname + url.search + '#Intent;scheme=https;package=com.android.chrome;end">Open in Chrome</a><p class="note">If the button doesn\'t work, copy the URL and paste it into Chrome manually.</p></body></html>'
        return addSecurityToResponse(new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8' } }))
      }
      const page = isMobile ? '/scanner.html' : '/scanner-qr.html'
      const resp = await env.ASSETS.fetch(new URL(page, request.url))
      const newResp = new Response(resp.body, {
        status: resp.status,
        headers: { ...Object.fromEntries(resp.headers), ...noCacheHeaders,       'X-Worker-Version': 'v5-subdomain' }
      })
      return addSecurityToResponse(newResp)
    }

    // ── Apex ivond.com: homepage, dashboard, auth
    if (isAsset) return addSecurityToResponse(await env.ASSETS.fetch(request))
    const resp = await env.ASSETS.fetch(request)
    const newResp = new Response(resp.body, {
      status: resp.status,
      headers: { ...Object.fromEntries(resp.headers), ...noCacheHeaders,       'X-Worker-Version': 'v5-apex' }
    })
    return addSecurityToResponse(newResp)
  }
}
