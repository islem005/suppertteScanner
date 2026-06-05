# Handoff v6 — 2026-06-04

## Summary
Migrated frontend hosting from Cloudflare Pages to a Cloudflare Worker (`scanner-frontend`) to enable true wildcard subdomain routing. Cloudflare Pages does not support wildcard custom domains — that's the root reason `casa.ivond.com` (and every other `*.ivond.com` subdomain) was failing.

**New architecture:**
```
*.ivond.com  ─┐
ivond.com    ─┼─→  Cloudflare Worker (scanner-frontend)  ─→  static assets
www.ivond.com ─┘

*.ivond.com/api/*  ─┐
ivond.com/api/*    ─┼─→  Cloudflare Worker (scanner-api)  ─→  Hono + D1
www.ivond.com/api/* ─┘
```

## Changes Made This Session

### New Worker: `scanner-frontend`
- **Files created:**
  - `frontend-worker/src/index.js` — hostname-based routing logic
  - `frontend-worker/wrangler.toml` — Workers Assets binding + route config
  - `frontend-worker/package.json` — wrangler v4 + node compat
  - `frontend-worker/public/` — built static assets (49 files, 32 in deploy)
- **Routing logic in `src/index.js`:**
  - `admin.ivond.com` → `/admin/index.html`
  - `*.ivond.com` (subdomain) → `/scanner.html` (SPA catch-all for non-asset paths)
  - `www.ivond.com` → 301 redirect to `ivond.com`
  - `ivond.com` → static assets (homepage, dashboard, auth)
- **Uses Workers Assets** (newer than Workers Sites — simpler, no KV needed)

### Build Pipeline
- **Created `build-frontend.mjs`** — runs `npm run build` then copies `dist/` to `frontend-worker/public/`
- Handles Windows path quirks (uses `node:fs/promises` recursive copy instead of `xcopy`)

### Deployed to Production
- **Worker URL:** `https://scanner-frontend.islemhassini.workers.dev`
- **32 assets uploaded** (~19.62 KiB)
- **Latest Version ID:** `2e1054f0-49dc-49a1-bd4f-fc5e1191e78e`

## Blocked Issue: API Token Missing "Workers Routes: Edit" Permission

The wrangler deploy succeeded for the Worker code + assets, but **routes are NOT being applied** because the API token returns 403 Forbidden on route management:

```
PUT /accounts/.../workers/scripts/scanner-frontend/routes → 403 Forbidden
GET /zones/ec6bafffc316940075e3082acc58b08b/workers/routes → 403 Forbidden
```

**Required action (user):** Update the API token at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens):
- Add `Workers Routes → Edit` permission (zone: ivond.com)
- OR change token template to `Edit all zones`

After token update, run:
```bash
cd D:\projects\suppertteScanner\frontend-worker
npx wrangler deploy
```

## Verified Working (Pre-Route)

| Endpoint | Status | Notes |
|---|---|---|
| `https://ivond.com/api/health` | 200 `{"ok":true}` | API Worker route (already in `api/wrangler.prod.toml`) ✅ |
| `https://casa.ivond.com/api/health` | 200 `{"ok":true}` | API routes work everywhere ✅ |
| `https://casa.ivond.com` | 200 (HTML) | Works because manually added to Pages custom domains earlier |
| `https://ivond.com` | 200 (HTML) | Apex serves via Pages |
| `https://admin.ivond.com` | 301 → /admin/ | Admin redirect works |
| `https://test-random-xyz.ivond.com` | **522** | ❌ Wildcard route not applied (waiting for token fix) |

## After Token Fix (Expected)

Once routes deploy, these will all work:
- `casa.ivond.com`, `my-store.ivond.com`, `any-slug.ivond.com` → scanner
- `ivond.com/dashboard/` → store dashboard
- `ivond.com/admin/` → admin panel
- `ivond.com/auth/` → login/register

## Next Tasks (prioritized)

| # | Task | Who |
|---|---|---|
| 1 | **Update API token** to include `Workers Routes → Edit` for ivond.com | User |
| 2 | **Re-run `wrangler deploy`** after token update to apply routes | User/Agent |
| 3 | **Remove `casa.ivond.com`** from Pages custom domains (if present) to avoid Worker/Pages conflict | User |
| 4 | **Remove `admin.ivond.com` and `www.ivond.com` CNAMEs** from DNS (redundant, wildcard covers them) | User |
| 5 | **Clean up: remove `functions/_middleware.js`** — Worker now handles all routing | Agent |
| 6 | **Run full test suite** against new routing | Agent |

## Lore Flags

- **NEW PATTERN:** Cloudflare Workers as frontend host (vs Pages) for wildcard subdomain SaaS apps
- **NEW PATTERN:** Workers Assets (replaces Workers Sites — simpler, no KV binding needed)
- **NEW GOTCHA:** Cloudflare API token needs `Workers Routes → Edit` permission — not included by default
- **NEW GOTCHA:** Cloudflare Pages does NOT support wildcard custom domains (`.example.com/*` syntax fails)
- Update `code-lore/infrastructure/cloudflare-setup.md` with new architecture after token fix verified
