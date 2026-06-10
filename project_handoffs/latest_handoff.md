# Handoff v8 — 2026-06-10

## Summary
Added associate role + audit log system, rebranded company/product (ivond + SKANER), redesigned mobile homepage, implemented R2 file upload routes, fixed store registration and discount/promotion issues. Completed Pages→Workers migration cleanup (lore, deploy scripts, CI/CD).

## Changes This Session

### Features
1. **Associate role** — New role between manager and staff. Managers can CRUD associates for their store. Dashboard nav adapts by role. Admin panel supports associate role.
2. **Audit log system** — `audit_log` table (migration 004) logs associate actions on products, promos, discounts. Manager-facing view at Dashboard > Audit Log.
3. **R2 file upload routes** — `GET/PUT/DELETE /api/files/*` for product/promo/discount images, replacing base64 approach.
4. **Store registration system** — Full sign-up flow for new stores with auto-subdomain registration.

### Rebrand
- **Product name**: SKANER (formerly Shelf Scanner)
- **Company name**: ivond
- Homepage, scanner PWA, auth pages, dashboard, admin panel all updated

### Infrastructure & Bug Fixes
- **Workers-only CI/CD** — Updated `.github/workflows/deploy.yml` from Pages deploy to Worker Assets deploy. Updated `package.json` scripts (`deploy:fe`, `deploy:all`). 
- **`requireManagerOrAbove` middleware** — Blocks associate and staff from analytics, branding, team management, audit log endpoints (`api/src/middleware.js:95`).
- **`004_audit_log.sql` migration** — New table + indexes for audit trail.

### Lore Updates
- `AGENTS.md` — Removed deleted `functions/` references, added associate role to credentials, fixed deploy command
- `code-lore/code-lore-index.md` — Updated brand name, view counts (7→10, 8→11)
- `code-lore/security/protocols.md` — Removed Pages Function + admin-auth DB references (now handled by Worker + main DB)
- `code-lore/infrastructure/cloudflare-setup.md` — Updated brand name, asset copy command, migration/table counts, deploy steps
- `code-lore/infrastructure/pwa-setup.md` — Updated manifest content (SKANER), dynamic manifest link
- `code-lore/infrastructure/r2-file-storage.md` — Updated brand name
- `code-lore/patterns/api-call-patterns.md` — Added analytics, team, audit, upload, registration endpoints
- `code-lore/patterns/dashboard-patterns.md` — Fixed i18n file path, 3 languages (en/fr/ar), added Analytics/Team/Audit Log views, added API methods
- `code-lore/patterns/admin-patterns.md` — Updated nav item count (8→10), added Analytics + Registrations views
- `code-lore/patterns/auth-flow.md` — Removed Pages Function + cf-access meta + admin-auth DB claims
- `overview.md` — Updated brand name, 3→4 roles

## Architecture (unchanged)
```
*.ivond.com       ─┐
ivond.com         ─┼─→  Cloudflare Worker (scanner-frontend)  ─→  Workers Assets
www.ivond.com     ─┘
admin.ivond.com   ─┤
                    │
*.ivond.com/api/* ─┐
ivond.com/api/*   ─┼─→  Cloudflare Worker (scanner-api)  ─→  Hono + D1
www.ivond.com/api/*─┘
```

## Next Tasks
1. Run full test suite post-deploy
2. Verify wildcard subdomain `test-random-xyz.ivond.com` (was 522, should be fixed)
3. Run migration 004 on production D1 (`wrangler d1 execute shelf-scanner-db --file=./migrations/004_audit_log.sql`)
4. Check if any dashboard views need the `requireManagerOrAbove` guard for associate users on product/promo/discount mutation endpoints

## Lore Flags
- None — all existing patterns now documented per latest state
