# Handoff v3 — 2026-06-02

## Summary

Shifted Shelf Scanner from **local-first** to **deployed-only** development with store subdomains (`{store}.ivond.com`), a CI/CD pipeline (build → deploy → test), and post-deploy automated testing against the live production URL. All 14 integration tests now use env-var-based config and disposable test stores to avoid polluting production data.

## Recent Changes

### Infrastructure & CI/CD
- **`.github/workflows/deploy.yml`** — CI/CD pipeline: build → deploy Pages → deploy Worker → warm-up → run full test suite. Triggers on push to `main`.
- **`functions/_middleware.js`** — Extended for store subdomain routing: `*.ivond.com` → serves `scanner.html`, `admin.ivond.com` → `/admin/` redirect, `ivond.com` → normal routing.
- **`functions/_routes.json`** — Excludes `/api/*` from Pages (Worker handles them).
- **`static/_headers`** — Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy for camera.
- **`package.json`** — Added `deploy:fe`, `deploy:api`, `deploy:all` scripts.

### API changes (deployed-only readiness)
- **`api/src/index.js`** — CORS: `origin: '*'` replaced with dynamic origin echo supporting `*.ivond.com`, `localhost`, `*.pages.dev`. Credentials enabled.
- **`api/src/auth/index.js`** — `createAuth()` now accepts `requestOrigin` param; `trustedOrigins` dynamically accepts the request Origin if it matches trusted patterns; cookies set with `sameSite: 'none'` and `secure: true` for cross-subdomain auth.
- **`api/src/routes/auth.js`** — Passes Origin header to `createAuth()`.
- **`api/wrangler.prod.toml`** — `BETTER_AUTH_URL` set to `https://ivond.com`. Known D1 DB ID bug flagged with comment.

### Frontend changes
- **`js/app.js`** — Added hostname-based store slug detection: on `*.ivond.com` subdomains, slug extracted from `hostname.split('.')[0]`; falls back to path-based detection for backward compat.
- **`AGENTS.md`** — Rewritten to deployed-only workflow. Removed local dev references, `@app-launcher`, `start.mjs`. Updated URLs, test commands, key files.

### Test infrastructure
- **`test/api/setup.js`** — `API_BASE`, `ORIGIN`, credentials all from env vars with defaults. Added `getTestStoreId()` / `destroyTestStore()` for disposable test store creation/cleanup.
- **All 14 API test files** — Updated mutations to use disposable test store instead of real `my-store` data. Each mutation test creates and cleans up its own data.
- Tests run post-deploy against: `API_BASE=https://ivond.com/api`. Overrideable via env vars.

## Cloudflare State

- **Pages**: `shelf-scanner` project — build output `dist/`. Wildcard domain `*.ivond.com` must be added in Cloudflare Dashboard.
- **Worker**: `scanner-api` — Worker route `*.ivond.com/api/*` must be created in Cloudflare Dashboard.
- **D1**: `shelf-scanner-db` (prod) — database ID not yet set correctly in `wrangler.prod.toml`.
- **Secrets**: `BETTER_AUTH_SECRET` still needs to be set.

## Next Tasks (prioritized)

| # | Task | Who |
|---|---|---|
| 1 | **Fix D1 database ID** — run `npx wrangler d1 list` to find `shelf-scanner-db` UUID, update `api/wrangler.prod.toml` | User |
| 2 | **Add `*.ivond.com` wildcard domain** to Pages project in Cloudflare Dashboard | User |
| 3 | **Add Worker route** `*.ivond.com/api/*` → `scanner-api` in Cloudflare Dashboard | User |
| 4 | **Set `BETTER_AUTH_SECRET`** via `npx wrangler secret put BETTER_AUTH_SECRET` | User |
| 5 | **Apply D1 migrations to remote** `wrangler d1 execute shelf-scanner-db --remote --file=migrations/001_init.sql` | User |
| 6 | **Deploy first production build** — `npm run deploy:all` — and verify all tests pass | User |

## Lore Flags

- (none — all current patterns captured in `code-lore/infrastructure/cloudflare-setup.md`)
