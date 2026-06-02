// ─── Better Auth Instance ──────────────────────────────────────────────
// Configured for Cloudflare Workers + D1 with organization (multi-tenant)
// and admin (user management) plugins.
// Accepts an optional requestOrigin to dynamically trust store subdomains.
// ────────────────────────────────────────────────────────────────────────

import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins/admin'
import { organization } from 'better-auth/plugins/organization'

/**
 * Check whether an origin string should be trusted.
 * Accepts: ivond.com and all subdomains, localhost, pages.dev previews.
 */
function isTrustedOrigin(origin) {
  if (!origin) return false
  return (
    origin === 'https://ivond.com' ||
    origin.endsWith('.ivond.com') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('https://localhost:') ||
    origin.endsWith('.pages.dev')
  )
}

/**
 * Create a Better Auth instance for the given environment.
 * Must be called per-request (Workers stateless model).
 *
 * @param {object} env - The Workers environment bindings (DB, BETTER_AUTH_URL, etc.)
 * @param {string} [requestOrigin] - The Origin header from the incoming request,
 *   used to dynamically add trusted origins for wildcard subdomains.
 */
export function createAuth(env, requestOrigin) {
  const baseURL = env.BETTER_AUTH_URL || 'https://ivond.com'

  // Build trusted origins list dynamically
  const trustedOrigins = [
    'http://localhost:5173',
    'https://localhost:5173',
    'https://ivond.com',
    'https://admin.ivond.com'
  ]
  if (requestOrigin && isTrustedOrigin(requestOrigin) && !trustedOrigins.includes(requestOrigin)) {
    trustedOrigins.push(requestOrigin)
  }

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET || 'dev-secret-change-in-prod',
    baseURL,
    basePath: '/api/auth',

    trustedOrigins,

    // Cross-subdomain cookie config (camelCase keys as expected by Better Auth)
    cookies: {
      sessionToken: {
        sameSite: 'none',
        secure: true
      }
    },

    emailAndPassword: {
      enabled: true
    },

    user: {
      additionalFields: {
        display_name: {
          type: 'string',
          required: false,
          defaultValue: null
        },
        role: {
          type: 'string',
          required: false,
          defaultValue: 'staff',
          input: false
        },
        store_id: {
          type: 'string',
          required: false,
          defaultValue: null
        }
      }
    },

    plugins: [
      admin({
        defaultRole: 'staff',
        adminRoles: ['admin']
      }),
      organization({
        allowUserToCreateOrganization: async (user) => {
          return user.role === 'admin'
        }
      })
    ]
  })
}
