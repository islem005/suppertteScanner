# Cloudflare Infrastructure

## Overview

SKANER by ivond runs entirely on Cloudflare's free tier with a **Workers-only architecture** (no Pages project):
- **Worker `scanner-frontend`** — hosts all frontend via Workers Assets (Vite MPA build)
- **Worker `scanner-api`** — hosts the Hono API
- **D1** provides relational storage
- **R2** stores catalog images and uploaded files

**Development model: Deployed-only.** All development happens against the live deployed instance at `https://ivond.com`. There is no local dev environment — changes are pushed to GitHub, then CI/CD builds, deploys, and runs the full test suite against production.

**Architecture:**
```
*.ivond.com       ─┐
ivond.com         ─┼─→  Worker scanner-frontend  ─→  Workers Assets
www.ivond.com     ─┘
admin.ivond.com   ─┤
                    │
*.ivond.com/api/* ─┐
ivond.com/api/*   ─┼─→  Worker scanner-api  ─→  Hono + D1 + R2
www.ivond.com/api/*─┘
```

---

## Worker — `scanner-frontend`

The frontend Worker serves all static assets and handles hostname-based routing.

**Config:** `frontend-worker/wrangler.toml`

**Worker Routes:**
| Pattern | Zone |
|---|---|
| `*.ivond.com/*` | ivond.com |
| `ivond.com/*` | ivond.com |
| `www.ivond.com/*` | ivond.com |

**Workers Assets:** Built frontend lives in `frontend-worker/public/` (output of `node build-frontend.mjs`, which runs `npm run build` then copies `dist/` to `frontend-worker/public/`). The `run_worker_first = true` setting means the Worker runs before serving static assets, allowing custom routing logic.

**Hostname-based routing** (`frontend-worker/src/index.js`):
- `admin.ivond.com` → serves `/admin/index.html`
- `www.ivond.com` → 301 redirects to `ivond.com`
- `*.ivond.com` (store subdomains, e.g. `casa.ivond.com`) → serves `/scanner.html`
- `ivond.com` (apex) → serves whatever the request path maps to (homepage, dashboard, auth)

**Asset detection:** Requests for `.css`, `.js`, `.json`, `.svg`, `.png`, `.jpg`, `.ico`, `.woff2?`, `.ttf`, `.webmanifest`, `.map` are passed directly to `env.ASSETS.fetch()` without modification.

**No-cache headers:** All HTML responses get `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` to prevent stale Cloudflare edge cache issues.

**Favicon:** `/favicon.ico` is handled inline in the Worker fetch handler — returns a branded SVG favicon (`image/svg+xml`) to prevent browser 404 noise.

**Deploy:**
```bash
cd frontend-worker && wrangler deploy
```

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

**Secrets (set):**
- `BETTER_AUTH_SECRET` ✅ — Set 2026-06-04 for production Worker `scanner-api`

**Worker Routes:** `ivond.com/api/*` and `*.ivond.com/api/*` → `scanner-api`

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

---

## D1 Databases

| Name | UUID | Purpose |
|---|---|---|
| `shelf-scanner-db` | `a6547253-cfd8-47cb-9bd0-ca61db1b6d61` | Production database |
| `shelf-scanner-db-dev` | `be60b33e-892f-4dde-8b54-f097e53f552e` | Development database |
| `admin-auth` | `74e5cbce-56ee-4c85-b492-9baa3e8a0097` | Cloudflare Access admin auth |

**Migration files:**
- `api/migrations/001_init.sql` — Base schema (Better Auth + app tables)
- `api/migrations/002_r2.sql` — R2 file storage columns
- `api/migrations/002_store_registrations.sql` — Store registration requests table
- `api/migrations/003_client_tracking.sql` — Client device + page view tracking
- `api/migrations/004_audit_log.sql` — Audit log for associate actions

**Apply migrations:**
```bash
wrangler d1 execute shelf-scanner-db --remote --file=migrations/001_init.sql
wrangler d1 execute shelf-scanner-db --remote --file=migrations/002_r2.sql
wrangler d1 execute shelf-scanner-db --remote --file=migrations/002_store_registrations.sql
wrangler d1 execute shelf-scanner-db --remote --file=migrations/003_client_tracking.sql
wrangler d1 execute shelf-scanner-db --remote --file=migrations/004_audit_log.sql
```

**D1 tables (20 total):**
- Better Auth core: `user`, `session`, `account`, `verification`
- Organization plugin: `organization`, `member`, `invitation`
- App tables: `product`, `scan_event`, `store_branding`, `promotion`, `discount_item`, `import_mapping`, `pending_import`, `store_registration`, `client_device`, `page_view`, `audit_log`
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

### Manual Deploy
```bash
node build-frontend.mjs          # Build frontend + copy to frontend-worker/public/
cd frontend-worker && wrangler deploy && cd ..
cd api && wrangler deploy --config wrangler.prod.toml && cd ..
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
4. **Copy assets to frontend-worker/public/**
5. **Deploy frontend Worker** via `cloudflare/wrangler-action@v3` in `frontend-worker/`
6. **Install API dependencies** (`cd api && npm ci`)
7. **Deploy backend Worker** via `cloudflare/wrangler-action@v3`:
   `wrangler deploy --config wrangler.prod.toml`
8. **Warm-up** — polls `API_BASE/health` every 5s up to 60s until 200 OK
9. **Run full test suite** (`npx vitest run --reporter=verbose`) against live deployed URL
10. **Notify on failure** — prints `::error::` annotation if tests fail post-deploy

---

## Auto-Subdomain Registration

When a new store (organization) is created, the Worker automatically registers `{slug}.ivond.com` via the Cloudflare API.

**Current implementation** (`api/src/routes/stores.js`):
- `registerStoreSubdomain()` helper — called fire-and-forget after `INSERT INTO organization`
- Uses `CLOUDFLARE_PAGES_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` env vars
- POSTs to `https://api.cloudflare.com/client/v4/accounts/{id}/pages/projects/shelf-scanner/domains`
- Body: `{ "name": "{slug}.ivond.com" }`

**⚠️ NOTE:** The Pages project `shelf-scanner` has been deleted. This auto-registration code targets the old Pages project and does **not** work with the current Workers-only architecture. It needs to be updated to either:
- Add a custom domain to the Worker with `GET/POST /accounts/{id}/workers/domains`
- Or use Worker routes API

On failure, only logs a warning — doesn't block store creation.

---

## Known Issues

### Stale HTML/JS Mismatch

Production deployments can ship new JS that expects DOM elements (e.g., tabs, registration form fields) that aren't yet in the deployed HTML. This causes the JS to crash at `null.addEventListener()` before event handlers register, resulting in silent failure.

**Mitigation:** All frontend JS uses a defensive `$` helper that returns `null` for missing elements and logs a warning instead of crashing. See `patterns/defensive-js.md` for the pattern.

**Symptoms:**
- Form submit does nothing
- Buttons appear but don't respond
- Console shows `Cannot read properties of null (reading 'addEventListener')`

**Fix:** Re-run `npm run build` to regenerate `dist/` with matching HTML and JS, then redeploy.

### Auto-Subdomain Registration Broken

The `registerStoreSubdomain()` function in `api/src/routes/stores.js` still targets the deleted Pages project. New stores created in the dashboard will have a `slug` but their subdomain won't be registered on the Worker. See Auto-Subdomain Registration section above.

---

## Resolved Issues

1. ✅ ~~`wrangler.prod.toml` database ID was wrong~~ — Fixed, now correctly points to `shelf-scanner-db` (a6547253-...)
2. ✅ ~~`BETTER_AUTH_SECRET` not set~~ — Set via `wrangler secret put` on 2026-06-04
3. ✅ ~~Remote D1 migrations not applied~~ — Both migrations (001 + 002) applied to production DB on 2026-06-04
4. ✅ ~~Auth login crash from stale HTML/JS mismatch~~ — Fixed 2026-06-04 by defensive `$` helper + null guards on top-level handlers
5. ✅ ~~Pages project `shelf-scanner` deleted~~ — Migrated to Workers-only architecture 2026-06-05
6. ✅ ~~Pages Functions (`_middleware.js`, `_routes.json`) removed~~ — No longer needed with Worker routing
