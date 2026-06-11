import QRCode from 'qrcode'

const QR_PATH = 'qr'

/**
 * Generate a QR SVG for a store slug and upload to R2.
 * @param {import('hono').Context['env']} env
 * @param {string} slug
 * @returns {Promise<string>} the R2 key (e.g. "qr/my-store.svg")
 */
export async function generateStoreQR(env, slug) {
  const url = `https://${slug}.ivond.com`
  const svg = await QRCode.toString(url, {
    type: 'svg',
    width: 200,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  })
  const key = `${QR_PATH}/${slug}.svg`
  await env.CATALOGS.put(key, svg, {
    httpMetadata: { contentType: 'image/svg+xml' },
    customMetadata: { slug, url }
  })
  return key
}

/**
 * Delete a stored QR SVG for a slug.
 * @param {import('hono').Context['env']} env
 * @param {string} slug
 */
export async function deleteStoreQR(env, slug) {
  const key = `${QR_PATH}/${slug}.svg`
  await env.CATALOGS.delete(key)
}
