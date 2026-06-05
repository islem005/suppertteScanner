# Tool Preferences — MCP First

## Rule

**When an MCP server is available for a task, use it instead of a direct shell command.**

MCP servers provide structured, safe access to infrastructure APIs. Prefer them over `wrangler`, `gh`, or any CLI that duplicates their functionality.

## Available MCP Servers

| Server | What it's for | Prefer over |
|---|---|---|---|
| **cloudflare-api** | Everything Cloudflare (Workers, D1, R2, KV, DO, Queues, AI, Pages, DNS, Zones, Secrets, etc.) | `wrangler`, `curl`, Cloudflare dashboard |
| **Git** | Commits, branches, status, diffs, logs | `git` CLI (for read operations) |

---

## Cloudflare MCP Server

### Current Setup (Official Cloudflare API MCP)

Cloudflare now provides a single official MCP endpoint that covers all Cloudflare API operations. This is configured in OpenCode's **global** config at `C:\Users\pc1\.config\opencode\opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "cloudflare-api": {
      "type": "remote",
      "url": "https://mcp.cloudflare.com/mcp",
      "enabled": true
    }
  }
}
```

This uses **OAuth-based authentication** (browser flow on first use, no manual token needed).

For full details on the setup, see `code-lore/infrastructure/cloudflare-mcp-setup.md`.

### Legacy Setup (superseded)

The older approach used `mcp-remote` to proxy three separate Cloudflare MCP servers. This has been replaced by the single official endpoint above:

- `cloudflare-bindings` (Workers, D1, KV, R2, DO, Queues, AI, Pages, DNS, Zones, Routing, Cron, Secrets, Bindings, Workflows)
- `cloudflare-observability` (Logs, analytics, debugging)
- `cloudflare-docs` (Query Cloudflare documentation)

---

## D1 CLI (when MCP unavailable)

For D1 operations when Cloudflare MCP is not available, use `wrangler d1`:

```bash
# List databases
wrangler d1 list

# Execute SQL
wrangler d1 execute shelf-scanner-db-dev --remote --command "SELECT * FROM product"

# Apply migration
wrangler d1 execute shelf-scanner-db-dev --remote --file=migrations/001_init.sql
```

---

## Git MCP Server Tools

(NOTE: git MCP runs via `uvx mcp-server-git` — if `uvx` is unavailable, fall back to `git` CLI.)

Typical git MCP tools include:
- `git_status` — Show working tree status
- `git_diff` — Show changes (unstaged or staged)
- `git_log` — Show commit log
- `git_show` — Show commit details
- `git_branch` — List branches
- `git_checkout` — Switch branches
- `git_add` — Stage files
- `git_commit` — Create a commit
- `git_push` — Push commits
- `git_pull` — Pull from remote
- `git_stash` — Stash changes
- `git_blame` — Blame a file
- `git_revert` — Revert a commit

---

## When to Use Shell Instead

Some tasks are better done via shell:
- Installing npm packages (`npm install`)
- Running git operations when MCP is unavailable
- File operations that MCP doesn't support
- Complex multi-step shell pipelines
- When MCP server is unavailable or errors out
