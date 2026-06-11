# Debugging Patterns & Mistake Log

## General Principles

1. **Isolate first** — Determine if it's frontend (JS, Vite, PWA) or backend (Worker, D1, R2). Use `wrangler tail` for backend, browser DevTools for frontend.
2. **Check the pipeline** — Bug could be in build (`npm run build`), deploy (`wrangler deploy`), or runtime. Test each layer.
3. **Reproduce locally first** — `npm run start` gives you local Vite + wrangler dev. If it works locally but fails in production, suspect: environment variables, D1 binding names, wrangler config, CORS, or missing routes.
4. **Check recent changes** — If something that was working broke, `git diff` the last change. Most bugs are newly introduced.
5. **Check the handoff** — If you didn't make the change, the last session might have. Read `project_handoffs/latest_handoff.md`.

## Stack-Specific Debugging

### Cloudflare Workers (Backend)

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Error 1027` | Exceeded free tier CPU/requests | Wait for daily reset; optimize query |
| 401 on authenticated routes | Invalid/expired session, wrong cookie domain | Check `better-auth.session_token` cookie in DevTools → Application → Cookies |
| 404 on API routes | Route not registered, wrong path, Worker not deployed | Check `api/src/index.js` for `.route()` calls; `wrangler deploy` |
| 500 internal error | Uncaught exception in Hono handler | `wrangler tail` to see stack trace |
| CORS error | Missing/misconfigured CORS headers | Check `api/src/index.js` for `cors()` middleware; verify `origin` header |
| D1 binding returns `undefined` | D1 binding name mismatch | `api/wrangler.toml` `[[d1_databases]]` binding must match `context.env.DB` |
| `wrangler dev` works, deploy fails | `wrangler.prod.toml` differs from `wrangler.toml` | Compare both files; especially D1 database IDs |

### D1 Database

| Symptom | Likely Cause | Fix |
|---|---|---|
| Query returns empty | Wrong table name, wrong binding, schema not migrated | Check `api/migrations/`; run migrations on remote: `wrangler d1 migrations apply <db-name> --remote` |
| `no such table` | Migration not applied | Apply migrations: `wrangler d1 migrations apply <db-name>` |
| Write fails | Exceeded 100K rows written/day (free tier) | Wait for reset at 00:00 UTC; optimize writes |
| Unique constraint violation | Duplicate data | Use INSERT OR REPLACE or check-then-insert pattern |
| Query timeout | Full table scan, no index | Add LIMIT/OFFSET; check for missing indexes |

### Better Auth

| Symptom | Likely Cause | Fix |
|---|---|---|
| Session not persisting across domains | Cookie `domain` or `sameSite` config | Dashboard needs `domain: '.ivond.com'` or use `sameSite: 'lax'` |
| `BETTER_AUTH_SECRET` not set | Missing env var | Set via `wrangler secret put BETTER_AUTH_SECRET` |
| Role not respected | `user.role` not set or middleware checks wrong field | Check `middleware.js` — it reads `user.role` from D1 `user` table |
| Cannot create users | Password validation, missing fields | Password must be ≥8 chars; all fields must match schema |
| Admin sees "Not authorized" | Missing adminOnly middleware on route | Check route handler for `adminOnly` wrapper |

### Frontend (JS/PWA)

| Symptom | Likely Cause | Fix |
|---|---|---|
| Scanner camera doesn't start | HTTPS required (PWA), or BarcodeDetector not supported | Test on https:// or localhost; check `navigator.mediaDevices` |
| Scanner shows "Unknown product" | Barcode not in DB, or wrong store slug | Check `GET /api/lookup/{slug}?barcode=X` response in DevTools → Network |
| `BarcodeDetector` is undefined | Browser doesn't support it (Firefox, Safari) | Check `js/scanner.js` — falls back to `NotSupportedError` gracefully |
| `showToast is not defined` | Shared JS loaded after app JS | Check `<script>` order in HTML — `shared.js` must load before `app.js` |
| Vite build succeeds, pages blank | Wrong asset paths in built HTML | Check `vite.config.js` `base` setting; try `base: '/'` |
| Service Worker not updating | Cache-first strategy serving stale files | Bump `sw.js` version; or use `caches.delete()` in DevTools |

### R2 / File Upload

| Symptom | Likely Cause | Fix |
|---|---|---|
| Upload returns 413 | Request too large | File must be base64-encoded; max payload depends on Worker limits (128 MB) |
| Uploaded file not accessible | Wrong bucket name or binding | Check `wrangler.toml` `[[r2_buckets]]` binding name matches `context.env.<NAME>` |
| Upload works locally but not deployed | Missing `wrangler.prod.toml` R2 binding | Add `[[r2_buckets]]` to both wrangler config files |

### Build & Deploy

| Symptom | Likely Cause | Fix |
|---|---|---|
| `npm run build` succeeds but UI wrong | Vite didn't copy assets | Run `node copy-assets.mjs` manually; check `dist/` output |
| `wrangler deploy` fails | Missing API token, wrong account | Check `CLOUDFLARE_API_TOKEN`; verify account in `wrangler.toml` |
| Deploy succeeds, site shows 404 | Route not configured, Workers Assets missing | Check `frontend-worker/src/index.js` routes; check `assets` config |
| CI/CD fails | Tests failing against production | Run `npx vitest run` locally against local wrangler dev first |

## Mistake Log

Every time a bug is fixed or a lesson learned, add an entry here.

| Date | Issue | Root Cause | Fix | Prevention |
|---|---|---|---|---|
| | | | | |

## Debugging Workflow

### For backend issues:
```
npm run dev:backend          # Start wrangler dev on port 3002
wrangler tail                # Follow live logs (prod only)
```
Test endpoint:
```
curl -v http://localhost:3002/api/health
```

### For frontend issues:
```
npm run dev                  # Vite dev server
# Open DevTools → Console for JS errors
# Open DevTools → Network for API request/response
# Open DevTools → Application → Cookies for session
```

### For build issues:
```
npm run build                # Check for errors
node copy-assets.mjs         # Verify assets copied to dist/
# Compare dist/ with expected file structure
```

### Cross-origin / cookie issues:
```
# Check cookies in DevTools → Application → Storage → Cookies
# Verify domain, path, SameSite, Secure flags
# For cross-subdomain auth: cookie must have domain=.ivond.com
```

### Full local reproduction (production-like):
```
npm run start                # Vite dev + wrangler dev concurrently
# Access at https://localhost:5173
# All API calls proxy to wrangler dev on :3002
```

## Quick Commands

| Command | What it does |
|---|---|
| `npm run dev:backend` | Start wrangler dev for API debugging |
| `npm run dev` | Start Vite dev server for frontend debugging |
| `npm run start` | Both concurrently |
| `wrangler tail` | Stream production Worker logs |
| `npx vitest run --reporter=verbose` | Run all tests |
| `git log --oneline -10` | Recent commits — what changed? |
| `git diff HEAD~1` | What changed in last commit? |
