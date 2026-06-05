# Cloudflare API MCP Server — OpenCode Configuration

## Overview

Cloudflare provides an official remote MCP server that exposes the full Cloudflare API (Workers, D1, R2, KV, DO, Queues, AI, Pages, DNS, Zones, Routing, Cron, Secrets, Bindings, Workflows, and more) as structured tools for AI agents.

This replaces the older `mcp-remote` proxy approach that used three separate Cloudflare MCP URLs (`bindings`, `observability`, `docs`). The single official endpoint covers all Cloudflare API operations.

## Configuration

The Cloudflare API MCP server is configured in **OpenCode's global user config**. The project-level config (`.opencode/opencode.json`) must NOT contain a `cloudflare` entry — it would override the global config with a broken local server.

| Item | Value |
|---|---|
| **Config file path** | `C:\Users\pc1\.config\opencode\opencode.jsonc` |
| **Scope** | Global (user-level) — available to all OpenCode projects |
| **Type** | `remote` (Cloudflare-hosted, no local process) |
| **Auth method** | OAuth (via browser) |

### Global config content (`opencode.jsonc`)

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

### Known issue (fixed 2026-06-04)

The project config (`.opencode/opencode.json`) previously had a broken `cloudflare` entry using `type: "local"` with `@cloudflare/mcp-server-cloudflare` — an uninstalled package with an empty API token. This overrode the global config and broke MCP. **Fix:** removed the `cloudflare` key from the project config. Only `supabase` and `git` remain as project-level MCP entries.

## Authentication

- The server uses **OAuth-based authentication**.
- On first use (or when the session expires), OpenCode opens a browser window to complete the OAuth flow via the user's Cloudflare account.
- The token is cached locally for subsequent sessions.
- No manual API token is needed. A `CLOUDFLARE_API_TOKEN` env var was previously set at the user level but is unused with this OAuth-based setup.

## What it covers

The single `cloudflare-api` MCP server provides tools for:

| Category | Resources |
|---|---|
| **Compute** | Workers, Pages, Workflows, Cron Triggers |
| **Storage** | D1, R2, KV, Durable Objects, Queues |
| **AI** | Workers AI, Vectorize |
| **Networking** | DNS, Zones, Routing, Custom Domains |
| **Security** | API Tokens, Secrets, Access |
| **Management** | Deployments, Logs, Observability |

## Relationship to `tool-preferences.md`

For usage conventions (when to prefer MCP over CLI, how to decide between MCP tools and shell commands), see `code-lore/patterns/tool-preferences.md`.

The older `mcp-remote`-based Cloudflare MCP servers (`cloudflare-bindings`, `cloudflare-observability`, `cloudflare-docs`) are superseded by this official single-endpoint server.
