# Handoff v11 — 2026-06-11

## Branch
`main`

## Summary
P0-P6 review-driven overhaul: CSRF protection, rate limiting, server-side validation, scanner-core extraction, per-store offer/discount limits, BREVO email (replacing Workers binding), cross-platform build fixes, and 66+ unit tests. All 3 new cross-cutting patterns documented in code-lore.

## Recent Changes

### Infrastructure & Security
- **CSRF protection** (`api/src/csrf.js`) — Hono middleware on all non-GET endpoints, origin/referer check + `X-CSRF-Token` header
- **Rate limiting** (`api/src/rate-limit.js`, `api/src/routes/rate-limit-middleware.js`) — In-memory sliding window, per-endpoint configurable, sets `X-RateLimit-*` headers
- **Input validation** (`api/src/validate.js`) — `validateBarcode`, `validateName`, `validatePrice`, `validateSlug`, `validateEmail`, `validateBody()` schema helper
- **Scanner core** (`js/scanner-core.js`) — Camera + barcode detection extracted to shared module (`window.scannerCore`), used by scanner.js
- **Shared utilities** (`js/shared.js`) — `escapeHtml`, `showToast`, `cropImage` (with pinch-zoom, pan, mouse wheel) extracted for all apps
- **Per-store limits** (`api/src/limits.js`) — `offersAlwaysShow`, `offersActive`, `discountsFeatured`, `discountsActive` stored in `organization.metadata`, enforced on create/update
- **File upload route** (`api/src/routes/upload.js`) — Multipart form upload to R2 with type validation (logo/promotion/discount/import), 10MB limit
- **Offline page** (`offline.html`) — Fallback for disconnected devices
- **Component CSS** (`css/components.css`) — Shared component styles across all apps
- **Email** — Switched from Workers `send_email` binding (requires Paid plan) to BREVO API (`BREVO_API_KEY` secret)
- **ESLint + Prettier** configs added
- **Build scripts** — Fixed `build-frontend.mjs` for cross-platform CI (removed `cmd.exe` dependency)
- **CI/CD upgrades** — Node.js 20→22, `wranglerVersion: 4` pinned, workers.dev URL for test/WAF bypass, health check path `/api/health`, security audit step, rollback on test failure

### Admin/Dashboard
- 66+ unit tests across CSRF, rate-limit, validation, middleware, discounts, promotions, products, page-views, scanner
- Admin: per-store limits editor (Offers Always Show count, Offers Active max, Discounts Featured max, Discounts Active max)
- Dashboard: associate nav restricted to Products/Offers/Discounts/Profile (no Overview, no Activity)

### Lore Created/Updated
- `security/csrf-protection.md` — CSRF middleware, origin check, exempt paths
- `patterns/rate-limiting.md` — Sliding window, middleware usage, cleanup
- `patterns/input-validation.md` — All validators, schema-based `validateBody()`
- `components/scanner.md` — Updated entry points to include `scanner-core.js` and `offline.html`
- `code-lore-index.md` — Added 3 new entries (CSRF, rate limiting, input validation)
- `infrastructure/cloudflare-setup.md` — Updated CI/CD steps: Node.js 22, wrangler 4, workers.dev WAF bypass, security audit, rollback

## Next Tasks
1. Run full test suite post-deploy against production
2. Verify BREVO email sending from admin panel
3. Verify per-store limits enforcement in dashboard
4. (Optional) Admin i18n — large task, admin pages are English-only
5. (Optional) Contrast tuning — `--text-tertiary: #71717a` on `--bg-base: #0c0d0d` ~4.5:1

## Lore Flags
- All new cross-cutting patterns from P0-P6 overhaul now documented
