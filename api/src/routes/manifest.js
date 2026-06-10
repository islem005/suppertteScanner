// ─── Dynamic PWA Manifest ──────────────────────────────────────────────
// Serves a per-store manifest so each store subdomain gets its own PWA
// name, icon, etc. (e.g. "My Store" for my-store.ivond.com).
// If the store has a logo_url in branding, it becomes the PWA icon.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryOne } from '../db.js'

const DEFAULT_ICON_192 = { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' }
const DEFAULT_ICON_512 = { src: '/assets/icons/icon-192.png', sizes: '512x512', type: 'image/png', purpose: 'any' }

function detectMime(url) {
  if (!url) return 'image/png'
  if (url.startsWith('data:')) {
    // Extract MIME from data URL: data:image/png;base64,...
    const semi = url.indexOf(';')
    if (semi > 5) return url.slice(5, semi)
    return 'image/png'
  }
  // Guess from extension
  const ext = url.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'ico') return 'image/x-icon'
  return 'image/png'
}

const router = new Hono()

router.get('/', async (c) => {
  // Determine store slug: query param takes priority, then hostname
  let slug = c.req.query('slug')

  if (!slug) {
    const host = c.req.header('host') || ''
    if (host.endsWith('.ivond.com') && !host.startsWith('www.') && !host.startsWith('admin.')) {
      slug = host.split('.')[0]
    }
  }

  // Default icons
  let icons = [DEFAULT_ICON_192, DEFAULT_ICON_512]
  let themeColor = '#0c0c0d'

  if (slug) {
    try {
      const store = await queryOne(c.env.DB,
        'SELECT id, name FROM organization WHERE slug = ?',
        [slug]
      )

      if (store) {
        // Try to get the store's logo from branding
        try {
          const brand = await queryOne(c.env.DB,
            'SELECT logo_url, primary_color FROM store_branding WHERE store_id = ?',
            [store.id]
          )

          if (brand?.logo_url) {
            const mime = detectMime(brand.logo_url)
            icons = [
              { src: brand.logo_url, sizes: '192x192', type: mime },
              { src: brand.logo_url, sizes: '512x512', type: mime, purpose: 'any' }
            ]
          }

          if (brand?.primary_color) {
            themeColor = brand.primary_color
          }
        } catch {}

        return c.json({
          name: store.name,
          short_name: store.name.length > 12 ? store.name.substring(0, 12) + '…' : store.name,
          description: `${store.name} — SKANER by ivond`,
          start_url: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0c0c0d',
          theme_color: themeColor,
          icons
        })
      }
    } catch {}
  }

  return c.json({
    name: 'SKANER',
    short_name: 'SKANER',
    description: 'SKANER by ivond — instant in-store barcode scanning',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0c0c0d',
    theme_color: '#0c0c0d',
    icons
  })
})

export { router as manifestRouter }
