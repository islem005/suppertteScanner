# Code-Lore Index

Permanent project memory for SKANER by ivond. This index maps every lore file to its purpose.

## Quick Reference

| Category | File | What it covers |
|---|---|---|
| **Styles** | `styles/colors.md` | Full CSS color token palette |
| **Styles** | `styles/typography.md` | Font stack, sizes, weights, usage rules |
| **Styles** | `styles/layout-patterns.md` | Spacing scale, border radii, shadows, transitions, component patterns |
| **Components** | `components/headers.md` | Scanner top-bar, dashboard sidebar header, admin sidebar |
| **Components** | `components/footers.md` | Scanner footer, sidebar footer section |
| **Components** | `components/scanner.md` | Scanner engine (BarcodeDetector), features (torch, cam switch), UX flow, desktop QR interstitial |
| **Components** | `components/scanner-storage.md` | IndexedDB schema, scan history CRUD, localStorage usage |
| **Patterns** | `patterns/api-call-patterns.md` | API client structure, cookie-based auth, error handling |
| **Patterns** | `patterns/error-handling.md` | Toast notifications, modal errors, unhandled rejection handling |
| **Patterns** | `patterns/debugging.md` | Stack-specific debug guides, mistake log, debugging workflows |
| **Patterns** | `patterns/dashboard-patterns.md` | Dashboard SPA structure, all 10 views, upload flow, API client, i18n system |
| **Patterns** | `patterns/admin-patterns.md` | Admin panel SPA structure, all 11 views, store detail, mapping editor, role enforcement |
| **Patterns** | `patterns/auth-flow.md` | Login page flow, session persistence, dashboard/admin auth, sign out, localStorage keys |
| **Patterns** | `patterns/defensive-js.md` | Defensive `$` helper, Feather icons init, IIFE wrapper, null guards on top-level handlers |
| **Patterns** | `patterns/tool-preferences.md` | MCP-first tool usage rule |
| **Patterns** | `patterns/email-sending.md` | Email sending via Workers binding, department addresses, attachment handling |
| **Security** | `security/protocols.md` | Better Auth, middleware chain, role enforcement, Cloudflare Access |
| **Security** | `security/csrf-protection.md` | CSRF middleware, origin/referer checking, token validation, exempted public paths |
| **Patterns** | `patterns/rate-limiting.md` | In-memory sliding window rate limiter, middleware usage, per-endpoint limits |
| **Patterns** | `patterns/input-validation.md` | Server-side validation helpers, schema-based body validation, all validators |
| **Infrastructure** | `infrastructure/cloudflare-setup.md` | Workers-only architecture (scanner-frontend + scanner-api), D1, R2, deployment flow, CI/CD, dynamic CORS, cross-subdomain auth, auto-subdomain registration, known issues |
| **Infrastructure** | `infrastructure/pwa-setup.md` | Service Worker cache-first strategy, web manifest, PWA registration flow |
| **Infrastructure** | `infrastructure/r2-file-storage.md` | R2 bucket, upload/serve endpoints, cache strategy, path convention, frontend upload helpers, migration, display priority |
| **Infrastructure** | `infrastructure/build-tooling.md` | Vite MPA build config, SSL, proxy, entry points, asset copy |
| **Infrastructure** | `infrastructure/cloudflare-mcp-setup.md` | Cloudflare API MCP server config (OpenCode global config, OAuth auth, URL, coverage) |
| **Project Mgmt** | `project-management/thread-handoff-protocol.md` | Session end/archive workflow |
| **Project Mgmt** | `project-management/code-lore-management.md` | How to add to lore, flag patterns |
| **Project Mgmt** | `project-management/git-branch-convention.md` | GitHub Flow, branch naming, session-to-branch workflow |

## Lore Rules

1. **Session Start Protocol** — read `project_handoffs/latest_handoff.md` for current status, then `code-lore/code-lore-index.md` for permanent patterns, before any other work
2. **Update lore before handoff** — when preparing a session handoff, update lore files first, then archive
3. **Follow without exception** — patterns in lore override general conventions
4. **Flag for later** — if you notice a repeatable pattern mid-task, pin it for end-of-session
5. **Ask before inventing** — if something needed isn't in lore, stop and ask
6. **"Do we have code-lore for X?"** triggers a lookup in this index — find the exact file, reference only the required lines
