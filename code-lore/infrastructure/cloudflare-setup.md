# Cloudflare Infrastructure

## Overview

Shelf Scanner runs entirely on Cloudflare's free tier:
- **Pages** hosts the frontend (Vite MPA build)
- **Workers** hosts the Hono API (`scanner-api`)
- **D1** provides relational storage
- **R2** stores catalog images and uploaded files

**Development model: Deployed-only.** All development happens against the live deployed instance at `https://ivond.com`. There is no local dev environment — changes are pushed to GitHub, then CI/CD builds, deploys, and runs the full test suite against production. Manual deploy is also available via `npm run deploy:all`.

---

## Pages — `shelf-scanner`

The `shelf-scanner` Pages project serves the Vite-built frontend.

**Custom domains:**
| Domain | Purpose | Routing |
|---|---|---|
| `shelf-scanner.pages.dev` | Default Cloudflare Pages domain | — |
| `ivond.com` | Homepage + Dashboard + Auth | Normal Pages routing |
| `*.ivond.com` (wildcard) | Store scanner subdomains | Pages Function → `scanner.html` |
| `admin.ivond.com` | Admin panel (behind Cloudflare Access) | Pages Function → `/admin/` |

**Deployment:** Via `npm run deploy:fe` (wrangler pages deploy), or CI/CD via `.github/workflows/deploy.yml`.

**Pages Functions:** `functions/_middleware.js` routes by hostname:
- `admin.ivond.com` → redirects `/` → `/admin/`
- `*.ivond.com` (store subdomains) → serves `scanner.html`
- `ivond.com` → normal routing

**Pages routing:** `functions/_routes.json` excludes `/api/*` from Pages so the Worker handles them.

---

## Worker — `scanner-api`

The Hono Workers API runs as `scanner-api`. Configured in two wrangler configs:

| Config | File | Use |
|---|---|---|
| Dev | `api/wrangler.toml` | Local `wrangler dev` |
| Production | `api/wrangler.prod.toml` | `wrangler deploy` |

**Bindings:**
| Binding | Resource | Type |
|---|---|---|
| `DB` | `shelf-scanner-db-dev` (dev) / `shelf-scanner-db` (prod) | D1 Database |
| `CATALOGS` | `store-catalogs` | R2 Bucket |
| `BETTER_AUTH_URL` | `https://ivond.com` | Environment variable (production) |

**Secrets to set:**
```bash
wrangler secret put BETTER_AUTH_SECRET    # Required for production
```

**Worker Route:** `ivond.com/api/*` and `*.ivond.com/api/*` → `scanner-api`

### Dynamic CORS Configuration

The Worker uses Hono's `cors()` middleware with a dynamic origin callback (`api/src/index.js`):

```js
origin: (origin, c) => {
  if (!origin) return 'https://ivond.com'
  if (origin.endsWith('.ivond.com') || origin === 'https://ivond.com') return origin
  if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) return origin
  if (origin.endsWith('.pages.dev')) return origin
  return 'https://ivond.com'
}
```

This echoes back the request origin for trusted subdomains, enabling credentialed requests across `{store}.ivond.com` → `ivond.com/api/*`. `credentials: true` is set to allow cookies cross-origin.

### Cross-Subdomain Cookie Config

Better Auth is configured with `sameSite: 'none'` and `secure: true` on the session cookie (`api/src/auth/index.js`). This ensures the `better-auth.session_token` cookie is sent by the browser when a scanner at `my-store.ivond.com` makes API calls to `ivond.com/api/*`. Without this, the cookie would be blocked.

### Security Headers

Applied via `static/_headers` to all Pages responses:

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin

/scanner.html
  Permissions-Policy: camera=(self)
```

The `Permissions-Policy: camera=(self)` on `scanner.html` is required for `BarcodeDetector` API access.

---

## D1 Databases

| Name | UUID | Purpose |
|---|---|---|
| `shelf-scanner-db-dev` | `be60b33e-892f-4dde-8b54-f097e53f552e` | Development database |
| `admin-auth` | `74e5cbce-56ee-4c85-b492-9baa3e8a0097` | Cloudflare Access admin auth |
| `shelf-scanner-db` | *needs to be found* | Production database |

**⚠️ Known issue:** `api/wrangler.prod.toml` currently has `database_id = "74e5cbce-..."` which points to `admin-auth`, NOT `shelf-scanner-db`. Find the correct UUID for `shelf-scanner-db` via `wrangler d1 list` before deploying.

**Migration file:** `api/migrations/001_init.sql` — contains full DDL for all 15 tables.

**Apply migrations:**
```bash
# Remote dev
wrangler d1 execute shelf-scanner-db-dev --remote --file=migrations/001_init.sql
# Production (after fixing DB ID)
wrangler d1 execute shelf-scanner-db --remote --file=migrations/001_init.sql
```

**D1 tables (15 total):**
- Better Auth core: `user`, `session`, `account`, `verification`
- Organization plugin: `organization`, `member`, `invitation`
- App tables: `product`, `scan_event`, `store_branding`, `promotion`, `discount_item`, `import_mapping`, `pending_import`
- Internal: `_cf_KV`

---

## R2 — `store-catalogs`

One bucket exists:
- **Name:** `store-catalogs`
- **Created:** 2026-05-30
- **Binding:** `CATALOGS` on the `scanner-api` Worker
- **Purpose:** Store catalog images and uploaded product files

---

## Deployment Flow

### Manual deploy
```bash
npm run deploy:all
# = npm run build + wrangler pages deploy dist/ + cd api && wrangler deploy
```

### CI/CD (on push to main)

**Pipeline file:** `.github/workflows/deploy.yml`

Triggers on push to `main` branch or via `workflow_dispatch`. Uses concurrency gating (cancels in-flight runs for same branch).

**Environment:**
| Env var | Source | Default |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub secret (required) | — |
| `API_BASE` | GitHub secret | `https://ivond.com/api` |
| `ADMIN_EMAIL` | GitHub secret | `admin@store.com` |
| `ADMIN_PASS` | GitHub secret | `admin123` |
| `ORIGIN` | GitHub secret | `https://ivond.com` |

**Steps (timeout: 15min):**
1. **Checkout + Setup Node.js 20** with npm cache
2. **Install dependencies** (`npm ci`)
3. **Build frontend** (`npm run build` → `dist/`)
4. **Deploy frontend to Pages** via `cloudflare/wrangler-action@v3`:
   `wrangler pages deploy dist/ --project-name shelf-scanner --branch main`
5. **Install API dependencies** (`cd api && npm ci`)
6. **Deploy backend to Workers** via `cloudflare/wrangler-action@v3`:
   `wrangler deploy --config wrangler.prod.toml`
7. **Warm-up** — polls `API_BASE/health` every 5s up to 60s until 200 OK
8. **Run full test suite** (`npx vitest run --reporter=verbose`) against live deployed URL with `API_BASE`, `ADMIN_EMAIL`, `ADMIN_PASS`, `ORIGIN` env vars
9. **Notify on failure** — prints `::error::` annotation if tests fail post-deploy

---

## Auto-Subdomain Registration

When a new store (organization) is created, the Worker automatically registers `{slug}.ivond.com` as a custom domain on the Pages project via the Cloudflare API.

**How it works:**
- `api/src/routes/stores.js` exports a `registerStoreSubdomain()` helper
- Called fire-and-forget (no `await`) after `INSERT INTO organization` succeeds
- Uses `CLOUDFLARE_PAGES_TOKEN` (Worker secret) for API auth
- Uses `CLOUDFLARE_ACCOUNT_ID` (env var in `wrangler.prod.toml`) for endpoint URL
- POSTs to `https://api.cloudflare.com/client/v4/accounts/{id}/pages/projects/shelf-scanner/domains`
- Body: `{ "name": "{slug}.ivond.com" }`
- On failure, only logs a warning — doesn't block store creation

**Prerequisites:**
1. `CLOUDFLARE_PAGES_TOKEN` secret must be set on the Worker (a Cloudflare API token with `pages:write` permission for the Pages project)
2. `CLOUDFLARE_ACCOUNT_ID` must be set as an env var (in `wrangler.prod.toml`)
3. Wildcard `*.ivond.com` DNS CNAME must exist pointing to `shelf-scanner.pages.dev` (set manually via Cloudflare DNS)
4. The Pages Function (`functions/_middleware.js`) must route `*.ivond.com` → `scanner.html`

**Middleware redirect fix:**
Previously, store subdomains hit a 308 redirect loop because `env.ASSETS.fetch('/scanner.html')` returns a 308 redirect to `/scanner` (Pages strips `.html`). The fix: `fetch()` follows the redirect internally by not setting `redirect: 'manual'`, so the middleware now serves the redirected page correctly.

---

## Known Issues

1. **`wrangler.prod.toml` database ID is wrong** — it currently points to `admin-auth` (74e5cbce...) instead of the correct production database ID. Must be fixed before production deployment.
2. **`BETTER_AUTH_SECRET`** is not yet set in Cloudflare secrets.
3. **Remote D1 migrations** need to be applied before the Worker will function in production.
