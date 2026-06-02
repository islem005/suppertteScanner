# Code-Lore Index

Permanent project memory for Shelf Scanner. This index maps every lore file to its purpose.

## Quick Reference

| Category | File | What it covers |
|---|---|---|
| **Styles** | `styles/colors.md` | Full CSS color token palette |
| **Styles** | `styles/typography.md` | Font stack, sizes, weights, usage rules |
| **Styles** | `styles/layout-patterns.md` | Spacing scale, border radii, shadows, transitions, component patterns |
| **Components** | `components/headers.md` | Scanner top-bar, dashboard sidebar header, admin sidebar |
| **Components** | `components/footers.md` | Scanner footer, sidebar footer section |
| **Patterns** | `patterns/api-call-patterns.md` | API client structure, cookie-based auth, error handling |
| **Patterns** | `patterns/error-handling.md` | Toast notifications, modal errors, unhandled rejection handling |
| **Security** | `security/protocols.md` | Better Auth, middleware chain, role enforcement, Cloudflare Access |
| **Infrastructure** | `infrastructure/cloudflare-setup.md` | Pages, Worker, D1, R2 resources, deployment flow, known issues |
| **Project Mgmt** | `project-management/thread-handoff-protocol.md` | Session end/archive workflow |
| **Project Mgmt** | `project-management/code-lore-management.md` | How to add to lore, flag patterns |
| **Patterns** | `patterns/tool-preferences.md` | MCP-first tool usage rule |

## Lore Rules

1. **Read before acting** — check `latest_handoff.md` before starting a session
2. **Follow without exception** — patterns in lore override general conventions
3. **Flag for later** — if you notice a repeatable pattern mid-task, pin it for end-of-session
4. **Ask before inventing** — if something needed isn't in lore, stop and ask
5. **"Do we have code-lore for X?"** triggers a lookup in this index — find the exact file, reference only the required lines
