# Archived Handoff v1 — 2026-06-01

This is the initial archive, migrated from `.opencode/session-journal.md`.

## Original Session Journal Content

The session journal contained entries for:

1. **2026-05-31 — Local dev == Production (Workers + Supabase)** — Migrated local dev from Express + SQLite to Hono Workers + Supabase
2. **2026-05-31 — Separate admin & manager login flows** — Separated admin dashboard login from shared manager login
3. **2026-05-31 — Fix admin login 405 error** — Added health check, error handling improvements
4. **2026-05-31 — Admin.ivond.com: Cloudflare Access + D1 auth** — Moved admin behind Cloudflare Access, decoupled admin auth into D1
5. **2026-06-01 — D1 Migration cleanup + App launcher skill** — Completed Supabase→D1 migration, created app-launcher subagent

See `.opencode/session-journal.md` for full details of each entry.

## Current Project State

- **Backend**: Hono Workers API on port 3002, with Better Auth + D1
- **Frontend**: Vite dev server on port 5173, multi-page (scanner, dashboard, admin)
- **Database**: D1 local (`.wrangler/state`) for dev, D1 remote for production
- **Auth**: Cookie-based via Better Auth (sign-in/email, sign-up/email)
- **Roles**: admin, manager, staff
- **Admin production**: Behind Cloudflare Access at admin.ivond.com
- **Storage**: No image storage yet (logos are base64 data URLs)
