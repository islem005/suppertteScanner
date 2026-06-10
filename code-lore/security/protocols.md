# Security Protocols

## Authentication

### Better Auth (Current)

SKANER by ivond uses **Better Auth** for authentication, integrated with Hono Workers + D1.

- **Sign-in**: `POST /api/auth/sign-in/email` with `{ email, password }` — sets a cookie session
- **Sign-up**: `POST /api/auth/sign-up/email` with `{ email, password, name }`
- **Session check**: `GET /api/auth/user` — returns user object if valid session cookie
- **Sign-out**: `POST /api/auth/sign-out`
- **Auth config**: `api/src/auth/index.js` — Better Auth instance with `admin` and `organization` plugins

### Session Mechanism

- **Cookie-based**: Better Auth sets `better-auth.session_token` cookie on sign-in
- **`credentials: 'include'`** must be set on all `fetch()` calls for authenticated requests
- Session token is validated server-side by `loadSession` middleware which queries D1 directly
- No `localStorage` token storage — cookies are httpOnly by default

### Test Credentials

These credentials are used for both local dev and deployed testing (CI/CD + manual):

| User | Email | Password | Role |
|---|---|---|---|
| Admin | `admin@store.com` | `admin123` | admin |
| Manager | `manager@store.com` | `manager123` | manager |
| Store slug | `my-store` | — | — |

> ⚠️ These are test credentials. In production, always override via env vars (`ADMIN_EMAIL`, `ADMIN_PASS`).

### Better Auth Configuration (`api/src/auth/index.js`)

- **Database**: D1 binding (`env.DB`) — Better Auth auto-detects and creates the SQL dialect
- **Plugins**: `admin` (role-based access with `defaultRole: 'staff'`, `adminRoles: ['admin']`), `organization` (multi-tenant stores, only admins can create orgs)
- **User custom fields**: `display_name` (string), `role` (string, default `'staff'`, not user-settable), `store_id` (string)
- **Cross-subdomain cookie config**: `sameSite: 'none'` + `secure: true` — required so the session cookie is sent across `ivond.com` → `{store}.ivond.com` subdomains
- **Dynamic trusted origins**: Built per-request from a base list, plus the incoming `Origin` header if it passes `isTrustedOrigin()`:
  - `https://ivond.com`
  - `https://admin.ivond.com`
  - `http://localhost:5173`, `https://localhost:5173`
  - Any `*.ivond.com` subdomain (matched via `origin.endsWith('.ivond.com')`)
  - Any `*.pages.dev` preview deployment
- **`isTrustedOrigin(origin)`** function validates incoming origins against the patterns above before dynamically adding them to the trusted list
- **`createAuth(env, requestOrigin)`** is called per-request (Workers stateless model) — the auth router passes the `Origin` header from each request
- **Secrets**: `env.BETTER_AUTH_SECRET` — must be set via `wrangler secret put BETTER_AUTH_SECRET` in production. Falls back to `'dev-secret-change-in-prod'` locally.

## Role Enforcement

Four roles enforced both client-side and server-side:

| Resource | Admin | Manager | Associate | Staff | Public |
|---|---|---|---|---|---|
| View all stores | ✅ | Own only | Own only | Own only | ❌ |
| Create store | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete store | ✅ | ❌ | ❌ | ❌ | ❌ |
| View products (any) | ✅ | Own store | Own store | Own store | ❌ |
| Add/edit/delete products | ✅ | Own store | Own store | ❌ | ❌ |
| Upload CSV / import | ✅ | Own store | Own store | ❌ | ❌ |
| Manage offers & discounts | ✅ | Own store | Own store | ❌ | ❌ |
| View analytics/stats | ✅ | Own store | ❌ | ❌ | ❌ |
| Edit branding | ✅ | Own store | ❌ | ❌ | ❌ |
| Manage team (CRUD associates) | ✅ | Own store | ❌ | ❌ | ❌ |
| View audit log | ✅ | Own store | ❌ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ | ❌ |
| View admin stats | ✅ | ❌ | ❌ | ❌ | ❌ |
| Lookup barcode | — | — | — | — | ✅ |
| Log scan | — | — | — | — | ✅ |

### Admin Login Gate

In `admin/js/app.js`, after successful auth, the role is checked:

```js
if (userData.role !== 'admin') {
  throw new Error('This login is for admin accounts only. Managers use the /auth/ page.')
}
```

In `dashboard/js/app.js`, the session check verifies with the server and redirects to `/auth/` on failure.

## Cloudflare Access (Production Admin)

- Admin dashboard at `admin.ivond.com` is behind Cloudflare Access (Email OTP)
- The `scanner-frontend` Worker rewrites `/` → `/admin/` for the admin host (see `frontend-worker/src/index.js`)
- `meta[name="cf-access"]` in admin HTML triggers auto-auth via `POST /api/auth/cf-access`
- The Cf-Access endpoint at `api/src/routes/cf-access.js` exchanges the `Cf-Access-Authenticated-User-Email` header for a session
- Admin emails are stored in the main `shelf-scanner-db` (queried via `c.env.DB`)
- Cloudflare Access is enforced at the network level before any request reaches the Worker

## Backend Middleware (`api/src/middleware.js`)

### `loadSession` — Runs on all `/api/*` routes

- Parses the `better-auth.session_token` cookie from incoming requests
- Looks up the session token directly in D1 (`SELECT ... FROM session WHERE token = ?`)
- Validates expiry — if expired, session is ignored
- Loads the user row (`SELECT id, name, email, role, display_name, store_id, image FROM user WHERE id = ?`)
- Sets `c.get('user')` and `c.get('session')` on the Hono context
- If no valid session found, sets both to `null` (does not block — downstream middleware/handlers decide)

### `authenticate` — Requires valid session

```js
const user = c.get('user')
if (!user) return c.json({ error: 'Authentication required' }, 401)
```

### `adminOnly` — Admin role gate

```js
const user = c.get('user')
if (!user || user.role !== 'admin') return c.json({ error: 'Admin only' }, 403)
```

### `requireManagerOrAbove` — Blocks associate and staff

```js
const user = c.get('user')
if (!user || (user.role !== 'admin' && user.role !== 'manager')) return 403
```

Applied to: analytics, branding, team management, audit log endpoints.

### `requireStoreAccess` — Store-scoped access

- Admins pass through automatically
- Non-admins must have matching `store_id`
- Checks `c.req.param('storeId')`, `c.req.query('store_id')`, or `user.store_id`

## Local Storage Patterns

- `user` key: stores JSON user object (for session persistence across page reloads)
- `api_base` key: optional override for API base URL (for testing)
- Both are cleared on 401 / sign-out
