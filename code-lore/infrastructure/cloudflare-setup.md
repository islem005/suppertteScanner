# Cloudflare Infrastructure

## Overview

Shelf Scanner runs entirely on Cloudflare's free tier:
- **Pages** hosts the frontend (Vite MPA build)
- **Workers** hosts the Hono API (`scanner-api`)
- **D1** provides relational storage
- **R2** stores catalog images and uploaded files

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
`.github/workflows/deploy.yml`:
1. Build frontend (`npm run build`)
2. Deploy to Pages (`wrangler pages deploy dist/`)
3. Deploy to Workers (`wrangler deploy --config wrangler.prod.toml`)
4. Run full test suite against `https://ivond.com/api`

---

## Known Issues

1. **`wrangler.prod.toml` database ID is wrong** — it currently points to `admin-auth` (74e5cbce...) instead of the correct production database ID. Must be fixed before production deployment.
2. **`BETTER_AUTH_SECRET`** is not yet set in Cloudflare secrets.
3. **Remote D1 migrations** need to be applied before the Worker will function in production.
