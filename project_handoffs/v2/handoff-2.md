# Handoff v2 — 2026-06-02

## Summary

Audited the full project state (local + Cloudflare) and updated all documentation (code-lore, PLAN.md, handoff) to reflect the current architecture. The app is fully on **Hono Workers + Better Auth + D1**. Cloudflare Pages hosts the frontend (`shelf-scanner`), the Worker handles API requests. Key infrastructure and schema changes are now documented in lore.

## Recent Changes

- **Code-lore updated:**
  - `security/protocols.md` — Rewrote for Better Auth (cookie sessions, middleware chain, role enforcement, D1 session lookup). Removed legacy JWT section.
  - `patterns/api-call-patterns.md` — Updated endpoint categories to match current routes (added discounts, cf-access). Clarified cookie-based auth.
  - `patterns/tool-preferences.md` — Removed Supabase MCP section (no longer relevant). Added D1 CLI alternatives.
  - `code-lore-index.md` — Added reference to new infrastructure lore.
  - Created `code-lore/infrastructure/cloudflare-setup.md` — Documents all Cloudflare resources, deployment flow, wrangler configs, bindings, and secrets.

- **PLAN.md updated:**
  - Database schema section rewritten to match D1 tables (Better Auth core + org plugin tables, renamed app tables, new promotion/discount_item tables, store_branding social links).
  - API reference rewritten to match current Better Auth endpoints and split route files.
  - Auth & roles section updated for Better Auth cookie-based sessions.
  - Directory structure updated (api/src/routes/, api/src/auth/, api/migrations/, removed deprecated worker/ and supabase/ dirs).
  - Setup commands and roadmap updated for D1/Better Auth.

- **Handoff archived:** v1 → `project_handoffs/v2/handoff-1.md`, version bumped to 2.

## Cloudflare State

- **Pages**: `shelf-scanner` project — domains: `shelf-scanner.pages.dev`, `admin.ivond.com`, `ivond.com`, `www.ivond.com`. Latest deploy from commit `0dabc98`.
- **Worker**: `scanner-api` — D1 (`DB`), R2 (`CATALOGS`), env vars (`BETTER_AUTH_URL`)
- **D1 databases**: `shelf-scanner-db-dev` (15 tables, active), `admin-auth` (Cloudflare Access), `shelf-scanner-db` (planned prod)
- **R2**: `store-catalogs` bucket
- **Secrets**: Only `JWT_SECRET` set — `BETTER_AUTH_SECRET` still needs to be created

## Next Tasks

1. Fix `wrangler.prod.toml` database ID — currently points to `admin-auth` (74e5cbce...) instead of `shelf-scanner-db`
2. Set `BETTER_AUTH_SECRET` via `wrangler secret put BETTER_AUTH_SECRET`
3. Apply D1 migrations to the remote database before Worker will function in prod
4. Continue feature work from `PLAN.md` Phase 2 (rate limiting, CORS hardening, bcrypt)

## Lore Flags

- (none — all current patterns captured)
