# Tool Preferences — MCP First

## Rule

**When an MCP server is available for a task, use it instead of a direct shell command.**

MCP servers provide structured, safe access to infrastructure APIs. Prefer them over `wrangler`, `gh`, `supabase`, or any CLI that duplicates their functionality.

## Available MCP Servers

| Server | What it's for | Prefer over |
|---|---|---|
| **cloudflare-bindings** | Workers, D1, R2, KV, DO, Queues, AI, Pages, DNS, Zones, Routing, Cron, Secrets, Bindings, Workflows | `wrangler`, `curl`, Cloudflare dashboard |
| **cloudflare-observability** | Logs, analytics, debugging | `wrangler tail`, Cloudflare dashboard |
| **cloudflare-docs** | Query Cloudflare documentation | Web search, docs.cloudflare.com |
| **Git** | Commits, branches, status, diffs, logs | `git` CLI (for read operations) |

---

## Cloudflare MCP Server

Configured in `opencode.jsonc` using `mcp-remote` to proxy Cloudflare's remote MCP servers:

```jsonc
{
  "mcp_servers": {
    "cloudflare-bindings": {
      "command": "npx",
      "args": ["mcp-remote", "https://bindings.mcp.cloudflare.com/mcp"]
    },
    "cloudflare-observability": {
      "command": "npx",
      "args": ["mcp-remote", "https://observability.mcp.cloudflare.com/mcp"]
    },
    "cloudflare-docs": {
      "command": "npx",
      "args": ["mcp-remote", "https://docs.mcp.cloudflare.com/mcp"]
    }
  }
}
```

These are **remote MCP servers** hosted by Cloudflare. On first use, they trigger an OAuth flow in the browser (via `wrangler login` session). The token is cached locally for subsequent sessions.

Tools available via `cloudflare-bindings` (covers Workers, D1, KV, R2, DO, Queues, AI, Pages, DNS, Zones, Routing, Cron, Secrets, Bindings, Workflows).

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
- Running the app stack (use `@app-launcher`)
- Installing npm packages (`npm install`)
- File operations that MCP doesn't support
- Complex multi-step shell pipelines
- When MCP server is unavailable or errors out
