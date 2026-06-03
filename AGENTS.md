# Shelf Scanner — Agent Orientation

## What is this?

Shelf Scanner is a SaaS barcode scanning platform that lets stores publish their product catalogs as scannable barcode lookups. Customers visit `{store}.ivond.com` on their phone, point the camera at a product barcode, and instantly see the name and price.

**Three apps in one:**
- **Scanner** (`{store}.ivond.com`) — Public-facing PWA for customers
- **Dashboard** (`ivond.com/dashboard`) — Store management for managers/staff
- **Admin Panel** (`admin.ivond.com`) — Platform administration

## Session Start Protocol

Every session begins with two reads in order:
1. **Read the handoff** — `project_handoffs/latest_handoff.md` for current status & next tasks
2. **Read code-lore** — `code-lore/code-lore-index.md` for permanent patterns & conventions

Without both, you may miss context or repeat mistakes. If something isn't in lore, stop and ask.

## What is code-lore?

The `code-lore/` directory contains our development patterns, conventions, and permanent project memory. See `code-lore/code-lore-index.md` for a comprehensive guide to available documentation.

Key areas:
- **Styles** — Colors, typography, layout patterns, component CSS
- **Components** — Header/footer structures for scanner, dashboard, admin
- **Patterns** — API call conventions, error handling strategies
- **Security** — Auth protocols, role enforcement, credential rules
- **Project Management** — Handoff protocol, lore management
- **Infrastructure** — Cloudflare Pages, Workers, D1, R2 setup

If a plan requires something not covered in code-lore, stop and ask how to proceed.

## Workflow: Deployed-Only

**There is no local dev environment.** All development happens against the live deployed instance at `https://ivond.com`.

### Development Flow
```
1. Make changes in api/ or frontend files
2. npm run build          # → dist/
3. git add -A && git commit && git push
4. [CI/CD] Build → Deploy (Pages + Worker) → Run full test suite
5. Test at ivond.com / my-store.ivond.com / admin.ivond.com
```

### Manual Deploy (if not using CI/CD)
```bash
npm run deploy:all
```
This runs: `npm run build && wrangler pages deploy dist/ --project-name shelf-scanner && cd api && wrangler deploy --config wrangler.prod.toml`

### Testing
Tests run **post-deploy** against the live production URL via CI/CD:
```bash
# Manually run tests against production:
API_BASE=https://ivond.com/api npx vitest run

# Or test against local wrangler dev (pre-deploy debugging):
npx vitest run
```

Subagents available:
- `@ui-rules` — UI design system enforcer
- `@tester` — Test runner and output analysis

## Backend Source Directory

- **`api/`** — Hono Workers API using Better Auth + D1 (local dev and Cloudflare production).
  All backend changes go here. No duplicate Express API.

## URLs

| URL | Serves | Notes |
|---|---|---|
| `https://ivond.com` | Homepage + Dashboard + Auth | Main domain |
| `https://admin.ivond.com` | Admin Panel | Behind Cloudflare Access |
| `https://{store}.ivond.com` | Scanner PWA | Per-store subdomain, slug from hostname |
| `https://ivond.com/api/*` | Hono Workers API | Worker route to `scanner-api` |

## Code Style

- Follow the conventions in `PLAN.md` and `UI-PLAN.md`
- Never use emoji characters as icons — use Feather Icons
- Never hardcode colors outside the CSS custom properties defined in `css/tokens.css` (documented in `code-lore/styles/colors.md`)
- Never add inline styles in JavaScript — use CSS classes
- Always support `prefers-reduced-motion`

## Cloudflare Free Tier

This account is on the Workers Free plan. Read `CLOUDFLARE-USAGE.md` before deploying anything to Cloudflare. Never upgrade to Workers Paid ($5/mo). Exceeding free limits = hard-blocked errors (not auto-billing).

## About LSP Errors

Some LSP errors can be safely ignored — browser APIs like `BarcodeDetector` may show as unrecognized in Node.js contexts, and JSX-in-JS patterns may trigger false positives. These are normal for this project.

## Known Credentials (Configurable via env vars)

| User | Email | Password | Role |
|---|---|---|---|
| Admin | `admin@store.com` | `admin123` | admin |
| Manager | `manager@store.com` | `manager123` | manager |
| Store slug | `my-store` | — | — |

For post-deploy testing, override via: `ADMIN_EMAIL`, `ADMIN_PASS`, `API_BASE` env vars.

## Preparing for the Next Thread

When the user says **"Let's prepare for the next thread"** or equivalent:
1. **Update lore before compacting** — If any patterns were flagged during the session, ask the user if they should be documented. If yes, create/update the lore file(s), update `code-lore/code-lore-index.md`, then proceed.
2. Follow the protocol at `code-lore/project-management/thread-handoff-protocol.md`
3. Archive the current handoff, increment version, create fresh handoff

## Key Files

- `api/src/index.js` — Hono Workers API entry point
- `api/wrangler.prod.toml` — Cloudflare Workers production config
- `api/wrangler.toml` — Cloudflare Workers dev config
- `index.html` / `scanner.html` — Scanner PWA entry points
- `dashboard/index.html` — Store dashboard SPA
- `admin/index.html` — Admin panel SPA
- `functions/_middleware.js` — Pages Function: hostname-based routing (subdomain → scanner.html)
- `functions/_routes.json` — Pages routing: excludes `/api/*` from Pages
- `.github/workflows/deploy.yml` — CI/CD pipeline: build → deploy → test
- `vite.config.js` — Vite build config (not used for serving, only for `npm run build`)
- `test/api/setup.js` — Test config (API_BASE from env var, disposable test store)

## Current Status

See `project_handoffs/latest_handoff.md`.

## Next Steps

If at any time you're unsure about protocols, check code-lore. If something isn't there, ask the user. See the handoff file for the prioritized task list.

Agent: please do not edit this file.
