# Shelf Scanner — Free Deployment Guide

## Cost: $0/mo (Forever)

| Service | Tier | What It Hosts | Limits |
|---|---|---|---|
| **Supabase Cloud** | Free | PostgreSQL database | 500 MB DB, 2 GB bandwidth, 50K rows |
| **Supabase Local** | CLI + Docker | Local dev database | Unlimited (your machine) |
| **Cloudflare Pages** | Free | Frontend (Vite build) | Unlimited requests, 500 builds/mo |
| **Cloudflare Workers** | Free | API backend (Hono) | 100K req/day, 10ms CPU, 128 MB |
| **Cloudflare R2** | Free | Product images / catalog | 10 GB storage, 1M writes/mo |
| **GitHub Actions** | Free | CI/CD pipeline | 2000 min/mo |
| **GitHub** | Free | Source code | Unlimited repos |

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Cloudflare Pages             │
                    │  https://scanner.pages.dev           │
                    │  https://scanner.pages.dev/my-store  │
                    │  https://scanner.pages.dev/dashboard │
                    │  https://scanner.pages.dev/admin     │
                    └──────────────┬──────────────────────┘
                                   │ /api/*
                    ┌──────────────┴──────────────────────┐
                    │      Cloudflare Workers (Hono)       │
                    │  https://api.scanner.workers.dev      │
                    │  Auth → Stores → Products → Scans    │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────┴──────────────────────┐
                    │       Supabase (PostgreSQL)          │
                    │  Cloud: https://db.supabase.co       │
                    │  Local: http://127.0.0.1:54321       │
                    └─────────────────────────────────────┘
```

---

## Account Configuration

| Resource | Value |
|---|---|
| Cloudflare Account | `Islemhassini@gmail.com's Account` (`c1a9c77e-...`) |
| Domain | `ivond.com` (Free plan, active) |
| Zone ID | `ec6bafffc316940075e3082acc58b08b` |
| Existing Workers | `ivond-app` (routes `ivond.com/*`), `ivond-admin` |
| Existing R2 Buckets | `ivond`, `souqlive`, `souqlive-preview` |

**Deployment target:** `scanner.ivond.com` → Cloudflare Pages (frontend) + `scanner-api` Worker (backend API via `/api/*` route)

## Prerequisites

```bash
# 1. Supabase CLI (for local dev)
# Windows (PowerShell):
winget install supabase.cli
# or: scoop install supabase

# 2. Node.js 18+
node -v

# 3. Docker Desktop (for local Supabase)
docker --version

# 4. Wrangler CLI (for Cloudflare deploy)
npm install -g wrangler

# 5. Git + GitHub account
git --version
```

---

## Phase 1: Local Development with Supabase

### 1.1 Start Local Supabase

```bash
cd E:\projects\suppertteScanner

# Start Supabase services (Docker containers)
supabase start
```

This starts:
- PostgreSQL on port 54322
- Supabase API on port 54321
- Studio (web UI) on port 54323
- Auth, Storage, Realtime, etc.

> **First run** pulls Docker images (~2 GB). Subsequent starts are instant.

### 1.2 Apply Schema

```bash
# Apply the SQL schema to local Supabase
supabase db push
# Or paste supabase/schema.sql into Studio → SQL Editor
```

Or via the Supabase MCP (requires connection):

```sql
-- Run in Studio SQL Editor (http://127.0.0.1:54323)
\i supabase/schema.sql
```

### 1.3 Configure Environment

Edit `worker/.env`:

```env
# Local Supabase (Docker)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZXYiLCJyb2xlIjoiYW5vbiIsImV4cCI6NDc2OTM2OTYwMH0.some-key
USE_SUPABASE=true
JWT_SECRET=dev-secret-change-in-prod
```

> The anon key is printed by `supabase start` under `API URL` and `anon key`.

### 1.4 Run Locally

```bash
# Terminal 1: Backend (Express + Supabase)
cd worker
npm run dev

# Terminal 2: Frontend (Vite)
npm run dev
```

The app now uses **real PostgreSQL** via local Supabase instead of SQLite.

### 1.5 Local Supabase Commands

| Command | Purpose |
|---|---|
| `supabase start` | Start all services |
| `supabase stop` | Stop all services |
| `supabase status` | Show service URLs and keys |
| `supabase db push` | Apply schema migrations |
| `supabase db diff` | Show local vs remote schema diff |
| `supabase migration new <name>` | Create a new migration file |
| `supabase db reset` | Reset database to clean state |
| `supabase completion` | Generate shell completion |

### 1.6 Local Supabase via MCP

With `supabase start` running, the `supabase-local` MCP server at `http://localhost:54321/mcp` becomes available. Use it to inspect and modify your local database:

```javascript
// List local tables
supabase_local__list_tables({ schemas: ["public"] })

// Run queries against local DB
supabase_local__execute_sql({ sql: "select * from products limit 5" })

// Apply schema changes locally
supabase_local__apply_migration({ sql: "alter table products add column unit text" })

// Generate types local dev
supabase_local__generate_typescript_types()
```

> The local MCP is pre-configured in `.opencode/opencode.json` as `"supabase-local"` with `enabled: true`.

---

## Phase 2: Supabase Cloud (Free Tier)

### 2.1 Create Project

Use the **Supabase MCP Server** (`@supabase/mcp-server-supabase`) — already configured in this project:

```javascript
// The `supabase` MCP provides these tools for project management:

// 1. Create a new Supabase project
supabase__create_project({
  name: "shelf-scanner",
  organization_id: "<your-org-id>",
  region: "eu-west-1",
  plan: "free"  // ⚠️ never change this
})

// 2. Wait for initialization, then verify
supabase__get_project({ project_ref: "<ref>" })

// 3. Get project credentials
supabase__get_publishable_keys({ project_ref: "<ref>" })
// Returns: [{ name: "anon key", api_key: "eyJhbGci..." }]

supabase__get_project_url({ project_ref: "<ref>" })
// Returns: "https://<ref>.supabase.co"
```

Alternatively, use the Supabase Dashboard at https://supabase.com → **New project**.

### 2.2 Apply Schema

```javascript
// Via Supabase MCP — apply the schema file
supabase__apply_migration({
  project_ref: "<ref>",
  sql: `-- Paste contents of supabase/schema.sql here`
})

// Or execute schema as SQL
supabase__execute_sql({
  project_ref: "<ref>",
  sql: `select * from information_schema.tables where table_schema = 'public'`
})

// Verify tables were created
supabase__list_tables({
  project_ref: "<ref>",
  schemas: ["public"]
})
```

Or paste `supabase/schema.sql` into the Supabase Dashboard → SQL Editor.

### 2.3 Get Connection Credentials

In Supabase Dashboard → **Project Settings** → **API**:

```
Project URL:  https://<ref>.supabase.co
anon public:  eyJhbGciOi... (copy this)
service_role: eyJhbGciOi... (keep secret)
```

### 2.4 Free Tier Limits

| Resource | Free Limit | Mitigation |
|---|---|---|
| Database size | 500 MB | Products are text-only; ~1M rows = ~100 MB |
| Bandwidth | 2 GB/month | API responses are small JSON |
| API requests | 50K/day | Hard limit — plan queries carefully |
| Auth users | Unlimited | JWT auth handled by Express/Hono |
| Row count | ~50K (practical) | Use pagination on all list endpoints |

> **If you hit limits**: The DB is paused until the next billing cycle (no overage charges).

---

## Phase 3: Cloudflare Workers (Free Tier)

### 3.1 Rewrite Express to Hono

> **Why**: Express uses Node.js built-ins (`fs`, `crypto`, `http`) unavailable in Workers.
> The migration is mechanical — same routes, same business logic, different framework.

```bash
# Create Cloudflare API backend
mkdir -p api
cd api
npm init -y
npm install hono jose bcryptjs @supabase/supabase-js papaparse xlsx
npm install -D wrangler
```

Key rewrite differences:

| Express | Hono (Workers) |
|---|---|
| `import { Router } from 'express'` | `import { Hono } from 'hono'` |
| `res.json({})` | `return c.json({})` |
| `req.params.id` | `c.req.param('id')` |
| `jwt.verify()` | `jwtVerify()` from `jose` |
| `process.env.X` | `c.env.X` or global env |
| `express-rate-limit` | Cloudflare WAF or `RateLimit` |

### 3.2 File Layout

```
api/
├── index.js              # Hono app entry point
├── db.js                 # @supabase/supabase-js client (no SQLite fallback)
├── middleware.js          # JWT auth via jose
├── auth.js               # Login / register
├── stores.js             # CRUD stores
├── products.js           # CRUD products + CSV
├── lookup.js             # Barcode lookup
├── scans.js              # Scan logging + stats
├── branding.js           # Store branding
├── admin.js              # Admin endpoints
├── imports.js            # File import (no SQLite DB support)
├── parser.js             # CSV/JSON/XLSX only (no Node built-ins)
├── promotions.js         # Promotions/banners/offers
├── discounts.js          # Discount items
├── package.json
├── wrangler.toml
└── .env.example
```

### 3.3 Configure Wrangler

```toml
# api/wrangler.toml
name = "scanner-api"
main = "index.js"
compatibility_date = "2025-12-01"

[vars]
SUPABASE_URL = ""
SUPABASE_ANON_KEY = ""
JWT_SECRET = ""

[[r2_buckets]]
binding = "CATALOGS"
bucket_name = "store-catalogs"
```

### 3.4 Deploy to Workers

```bash
cd api
npm run build  # Bundle with esbuild or wrangler
npx wrangler deploy
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put JWT_SECRET
```

**Or deploy via Cloudflare MCP** (the `cloudflare-workers-bindings` server):

```javascript
// The `cloudflare-workers-bindings` MCP provides:

// 1. List existing workers
cloudflare_workers_bindings_workers_list()

// 2. Get current worker code (to verify deployment)
cloudflare_workers_bindings_workers_get_worker_code({ scriptName: "scanner-api" })

// 3. Deploy via Cloudflare API MCP (multipart upload with bindings)
cloudflare_api_execute({
  method: "PUT",
  path: `/accounts/${accountId}/workers/scripts/scanner-api`,
  contentType: "multipart/form-data; boundary=...",
  rawBody: true,
  body: multipartFormData(workerCode, {
    bindings: [
      { type: "secret_text", name: "SUPABASE_URL" },
      { type: "secret_text", name: "SUPABASE_ANON_KEY" },
      { type: "secret_text", name: "JWT_SECRET" }
    ]
  })
})

// 4. Set up R2 bucket for catalog images
cloudflare_workers_bindings_r2_bucket_create({ name: "store-catalogs" })

// 5. Create KV namespace for session cache (optional)
cloudflare_workers_bindings_kv_namespace_create({ title: "scanner-sessions" })
```

### 3.5 Free Tier Limits

| Resource | Free Limit | Mitigation |
|---|---|---|
| Requests | 100K/day | Cache branding/lookups at edge |
| CPU time | 10ms/request | Keep queries simple; use D1/D1? No, Supabase. |
| Memory | 128 MB | Plenty for JSON API |
| Subrequests | 50/invocation | Batching for bulk imports |
| Duration | 30s (free) | Long imports → chunk into batches |
| Scripts | 100 | We deploy 1 |
| Cron triggers | 5 | Optional: daily scan report |

> Workers Free returns `Error 1027` if you exceed daily limits. No auto-billing.

---

## Phase 4: Cloudflare Pages (Free Tier)

### 4.1 Frontend Build

```bash
# From project root
npm install
npm run build   # outputs to dist/
```

### 4.2 Deploy via Wrangler or MCP

```bash
wrangler pages deploy dist/ --project-name shelf-scanner
# https://shelf-scanner.pages.dev
```

**Or deploy via Cloudflare MCP:**

```javascript
// Cloudflare Workers Bindings MCP — deploy frontend
cloudflare_api_execute({
  method: "POST",
  path: `/accounts/${accountId}/pages/projects`,
  body: { name: "shelf-scanner", production_branch: "main" }
})
```

### 4.3 Custom Domain (Same Account)

Since `ivond.com` is in this Cloudflare account, add the custom domain directly in Pages settings:

**Via MCP:**
```javascript
// Add scanner.ivond.com to Pages project
cloudflare_api_execute({
  method: "POST",
  path: `/accounts/${accountId}/pages/projects/shelf-scanner/domains`,
  body: { name: "scanner.ivond.com" }
})
```

**Or via Dashboard:**
Cloudflare Dashboard → Pages → `shelf-scanner` → **Custom domains** → `scanner.ivond.com`

Cloudflare will add the necessary DNS records automatically. Then the scanner app is live at `https://scanner.ivond.com`.

For the **Worker API**, add a route so `scanner.ivond.com/api/*` hits the Worker:

```javascript
cloudflare_api_execute({
  method: "POST",
  path: `/zones/${zoneId}/workers/routes`,
  body: { pattern: "scanner.ivond.com/api/*", script: "scanner-api" }
})
```

### 4.4 Configure Frontend for Production

Create `dist/_routes.json` for proper SPA routing:

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/api/*"]
}
```

This ensures all frontend routes (`/my-store`, `/dashboard/`, `/admin/`) serve the SPA, while `/api/*` requests go to the Worker.

### 4.5 Custom Domain on the Same Account (Alternative)

If you **transfer the domain** to this Cloudflare account, you can add it directly in Pages:

Cloudflare Dashboard → Pages → `shelf-scanner` → **Custom domains** → `scanner.yourdomain.com`

DNS is managed automatically. This only works if the domain and Pages project are in the same account.

Pages provides `*.pages.dev` for free either way — custom domain is optional.

### 4.5 Free Tier Limits

| Resource | Free Limit | Notes |
|---|---|---|
| Bandwidth | Unlimited | No cap |
| Builds | 500/month | Plenty for development |
| Build time | 20 min/build | Our build is ~30s |
| Sites | Unlimited | We deploy 1 |

---

## Phase 5: CI/CD with GitHub Actions

### 5.1 GitHub Secrets

Add these in GitHub repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | From Cloudflare Dashboard → API Tokens |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | From Supabase Dashboard → API |
| `JWT_SECRET` | Random 64-char string |

### 5.2 Workflow File

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      # Frontend: Build + Deploy to Pages
      - run: npm ci
      - run: npm run build

      - name: Deploy Frontend to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy dist/ --project-name shelf-scanner

      # Backend: Deploy to Workers
      - name: Deploy Backend to Cloudflare Workers
        working-directory: api
        run: |
          npm ci
          echo "${{ secrets.SUPABASE_URL }}" | npx wrangler secret put SUPABASE_URL
          echo "${{ secrets.SUPABASE_ANON_KEY }}" | npx wrangler secret put SUPABASE_ANON_KEY
          echo "${{ secrets.JWT_SECRET }}" | npx wrangler secret put JWT_SECRET
          npx wrangler deploy index.js
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### 5.3 Alternative: Deploy via MCP from Your Editor

The CI/CD pipeline handles automated deploys. For manual/ad-hoc deploys during development, use the MCP tools directly:

```javascript
// 1. Use Supabase MCP to check the project status
const project = await supabase__get_project({ project_ref: "<ref>" })

// 2. Check for any security advisories before deploying
const advisories = await supabase__get_advisors({ project_ref: "<ref>" })

// 3. Build and deploy
await $`npm run build`

// 4. Deploy Worker via Cloudflare API MCP
await cloudflare_api_execute({
  method: "PUT",
  path: `/accounts/${accountId}/workers/scripts/scanner-api`,
  ...
})

// 5. Verify with Worker logs
const logs = await supabase__get_logs({ project_ref: "<ref>", service: "api" })
```

---

## Phase 6: MCP Tool Reference

The project has **8 MCP servers** configured in `.opencode/opencode.json`. Here's exactly what each provides and how to use them.

### Supabase MCP — `supabase` (local process)

Runs `npx @supabase/mcp-server-supabase` with your `SUPABASE_ACCESS_TOKEN`.

**Project management:**

| Tool | Purpose |
|---|---|
| `supabase__list_projects` | List all Supabase projects |
| `supabase__get_project` | Get project status/details |
| `supabase__create_project` | Create new project (Free plan) |
| `supabase__pause_project` | Pause project (save resources) |
| `supabase__restore_project` | Restore a paused project |
| `supabase__delete_project` | Delete a project |

**Database operations:**

| Tool | Purpose |
|---|---|
| `supabase__execute_sql` | Run raw SQL queries |
| `supabase__apply_migration` | Apply DDL migration (tracked) |
| `supabase__list_tables` | List all tables in schemas |
| `supabase__list_extensions` | List DB extensions |
| `supabase__list_migrations` | List migration history |
| `supabase__generate_typescript_types` | Generate TypeScript types from schema |

**Debugging & monitoring:**

| Tool | Purpose |
|---|---|
| `supabase__get_logs` | Get logs by service (api, postgres, auth, etc.) |
| `supabase__get_advisors` | Security & performance advisories |
| `supabase__get_project_url` | Get project API URL |
| `supabase__get_publishable_keys` | Get anon/publishable API keys |

**Edge Functions & Storage:**

| Tool | Purpose |
|---|---|
| `supabase__deploy_edge_function` | Deploy a Supabase Edge Function |
| `supabase__list_edge_functions` | List Edge Functions |
| `supabase__get_edge_function` | Get Edge Function code |
| `supabase__list_storage_buckets` | List storage buckets |
| `supabase__get_storage_config` | Get storage config |

### Supabase Local MCP — `supabase-local` (remote)

Connects to `http://localhost:54321/mcp` — the local Supabase instance's MCP endpoint.
Provides the same tools as above but scoped to your local Docker-based Supabase.

```javascript
// Check local Supabase is running
supabase_local__list_tables({ schemas: ["public"] })

// Apply schema to local DB
supabase_local__apply_migration({
  sql: `-- Paste supabase/schema.sql here`
})

// Run ad-hoc queries against local DB
supabase_local__execute_sql({
  sql: `select * from stores`
})

// Generate TypeScript types for your local schema
supabase_local__generate_typescript_types()
```

> Local Supabase must be running (`supabase start` in terminal) for this MCP to respond.

### Cloudflare API MCP — `cloudflare-api` (remote)

Single MCP server covering the entire Cloudflare API (2,500+ endpoints).

```javascript
// Deploy a Worker (multipart upload with bindings)
cloudflare_api_execute({
  method: "PUT",
  path: `/accounts/${accountId}/workers/scripts/scanner-api`,
  contentType: "multipart/form-data; boundary=BOUNDARY",
  rawBody: true,
  body: multipartPayload  // JS code + binding metadata
})

// Set Worker secret
cloudflare_api_execute({
  method: "PUT",
  path: `/accounts/${accountId}/workers/scripts/scanner-api/secrets`,
  body: { name: "SUPABASE_URL", text: "https://<ref>.supabase.co" },
  contentType: "application/json"
})

// Create Pages project
cloudflare_api_execute({
  method: "POST",
  path: `/accounts/${accountId}/pages/projects`,
  body: { name: "shelf-scanner", production_branch: "main" }
})
```

### Cloudflare Workers Bindings MCP — `cloudflare-workers-bindings` (remote)

Focused management of Workers, KV, R2, D1, Queues, Hyperdrive.

| Tool | Purpose |
|---|---|
| `cloudflare_workers_bindings_workers_list` | List all Workers |
| `cloudflare_workers_bindings_workers_get_worker` | Get Worker metadata |
| `cloudflare_workers_bindings_workers_get_worker_code` | Get deployed JS code |
| `cloudflare_workers_bindings_kv_namespaces_list` | List KV namespaces |
| `cloudflare_workers_bindings_kv_namespace_create` | Create KV namespace |
| `cloudflare_workers_bindings_kv_namespace_get` | Get KV namespace details |
| `cloudflare_workers_bindings_r2_buckets_list` | List R2 buckets |
| `cloudflare_workers_bindings_r2_bucket_create` | Create R2 bucket |
| `cloudflare_workers_bindings_r2_bucket_get` | Get R2 bucket details |
| `cloudflare_workers_bindings_d1_databases_list` | List D1 databases |
| `cloudflare_workers_bindings_d1_database_query` | Query D1 database |
| `cloudflare_workers_bindings_d1_database_create` | Create D1 database |
| `cloudflare_workers_bindings_hyperdrive_configs_list` | List Hyperdrive configs |

### Other Cloudflare MCPs

| Server | URL | What It Does |
|---|---|---|
| `cloudflare-docs` | `docs.mcp.cloudflare.com/mcp` | Search Cloudflare docs |
| `cloudflare-observability` | `observability.mcp.cloudflare.com/mcp` | Worker logs & metrics |
| `cloudflare-radar` | `radar.mcp.cloudflare.com/mcp` | Internet traffic data |
| `cloudflare-browser` | `browser.mcp.cloudflare.com/mcp` | Browser automation for testing |

### End-to-End Deploy via MCP Session

```javascript
// ─── STEP 1: Create Supabase project ───
const project = await supabase__create_project({
  name: "shelf-scanner", plan: "free", region: "eu-west-1"
})
const ref = project.project_ref

// ─── STEP 2: Apply database schema ───
const schema = await readFile("supabase/schema.sql", "utf-8")
await supabase__apply_migration({ project_ref: ref, sql: schema })

// ─── STEP 3: Get connection credentials ───
const keys = await supabase__get_publishable_keys({ project_ref: ref })
const url = await supabase__get_project_url({ project_ref: ref })

// ─── STEP 4: Build frontend ───
await $`npm run build`

// ─── STEP 5: Deploy frontend to Pages ───
await cloudflare_api_execute({
  method: "POST",
  path: `/accounts/${accountId}/pages/projects/shelf-scanner/deploy`,
  body: { branch: "main" }
})

// ─── STEP 6: Create R2 bucket ───
await cloudflare_workers_bindings_r2_bucket_create({ name: "store-catalogs" })

// ─── STEP 7: Deploy backend Worker with secrets ───
await cloudflare_api_execute({
  method: "PUT",
  path: `/accounts/${accountId}/workers/scripts/scanner-api`,
  contentType: "multipart/form-data; boundary=BOUNDARY",
  rawBody: true,
  body: buildMultipart(workerCode, [
    { name: "SUPABASE_URL", text: url },
    { name: "SUPABASE_ANON_KEY", text: keys[0].api_key },
    { name: "JWT_SECRET", text: crypto.randomUUID() }
  ])
})

// ─── STEP 8: Verify ───
const worker = await cloudflare_workers_bindings_workers_get_worker({ scriptName: "scanner-api" })
const logs = await supabase__get_logs({ project_ref: ref, service: "api" })
```

---

## Phase 7: Development Workflow

### Local Dev — SQLite Mode (Default)

```bash
npm run start
# Vite + Express + SQLite
# No Docker or Supabase needed
```

### Local Dev — Supabase Mode

```bash
supabase start
# Edit worker/.env → USE_SUPABASE=true
npm run dev:backend
npm run dev
```

### Local Dev — Supabase + Cloudflare Mode

```bash
supabase start
cd api
npm run dev   # Hono dev with miniflare

# MCP tools are available during dev:
# - supabase-local → local DB queries via MCP
# - cloudflare-api → check Worker status, deploy
# - cloudflare-observability → view logs
```

### Production Deploy (Manual)

```bash
# 1. Build frontend
npm run build

# 2. Deploy frontend
wrangler pages deploy dist/ --project-name shelf-scanner

# 3. Deploy backend
cd api
wrangler deploy

# 4. Verify
curl https://scanner-api.<subdomain>.workers.dev/api/health
```

---

## Phase 8: What You Lose vs Express

| Feature | Express + SQLite (local) | Workers + Supabase (prod) | Workaround |
|---|---|---|---|
| SQLite DB file uploads | ✅ | ❌ | Admin converts to CSV/XLSX |
| `fs`, `path`, `crypto` | ✅ | ❌ | Use Web APIs + Supabase |
| `express-rate-limit` | ✅ | ❌ | Use Cloudflare WAF rate limiting |
| Session middleware | ✅ | ❌ | JWT-only (already using it) |
| Rate limiting customization | Full | Limited to WAF rules | Sufficient for 100K/day |
| Node modules with native addons | ✅ | ❌ | Already removed (no `better-sqlite3`) |

**Migration cost**: ~2-3 hours to rewrite 15 route files from Express to Hono.

**MCP advantage**: During and after migration, both Supabase MCP (`supabase__execute_sql`, `supabase__get_logs`) and Cloudflare MCPs (`cloudflare-workers-bindings`, `cloudflare-observability`) can be used to verify the migration, query the production DB, and monitor the live Worker — all from within the AI assistant.

---

## Phase 9: Free Tier Budget

### Monthly Budget Check

| Service | Expected Usage | Free Limit | Headroom |
|---|---|---|---|
| Workers requests | ~5,000/day (dev) | 100,000/day | 20x |
| Workers CPU | <1ms/req (simple lookups) | 10ms | 10x |
| Supabase DB | ~10 MB (starter data) | 500 MB | 50x |
| Supabase bandwidth | ~100 MB/month | 2 GB | 20x |
| Pages bandwidth | ~500 MB/month | Unlimited | ✅ |
| R2 storage | ~100 MB (logos) | 10 GB | 100x |
| GitHub Actions | ~200 min/month | 2,000 min | 10x |
| Supabase API | ~10,000 req/month | 50,000/day | Massive |

### What Causes Exceedance

| Scenario | What Breaks | Fix |
|---|---|---|
| Viral launch (1M scans/day) | Workers (100K/day cap) | Add caching, rate limit |
| Large CSV import (100K rows) | Supabase writes (50K row limit) | Batch in chunks over days |
| Upload 5 GB of images | R2 (10 GB cap) | Compress, set max file size |
| CI/CD 500 builds/mo | Pages (500/mo cap) | Staged deploys only |

### Monitoring

- **Workers**: Cloudflare Dashboard → Workers & Pages → `scanner-api` → **Metrics**
- **Supabase**: Dashboard → Project → **Database** → **Reports**
- **R2**: Dashboard → R2 → **Usage**
- **Actions**: GitHub → Repo → **Actions** → **Usage**

---

## Quick Reference

### CLI Commands

```bash
# ── Local Supabase ──
supabase start                    # Start local Supabase (Docker)
supabase stop                     # Stop local Supabase
supabase db push                  # Apply schema
supabase db reset                 # Reset database
supabase status                   # Show service URLs + keys

# ── Local Dev (SQLite, no Docker) ──
npm run start                     # Vite + Express + SQLite
npm run dev:backend               # Express API only
npm run dev                       # Vite frontend only

# ── Local Dev (Supabase) ──
supabase start                    # Start Supabase first
npm run dev:backend               # Then start API with USE_SUPABASE=true
npm run dev                       # Then start frontend

# ── Build + Deploy ──
npm run build                     # Build to dist/
npx wrangler pages deploy dist/ --project-name shelf-scanner  # Deploy frontend
cd api && npx wrangler deploy     # Deploy backend Worker
npx wrangler secret put SUPABASE_URL  # Set Worker secrets
```

### MCP Tool Quick Reference

| What You Want | MCP Tool |
|---|---|
| Create Supabase project | `supabase__create_project({ name, plan: "free" })` |
| Apply DB schema | `supabase__apply_migration({ sql })` |
| Run SQL query | `supabase__execute_sql({ sql })` |
| Get API keys | `supabase__get_publishable_keys({ project_ref })` |
| Check advisories | `supabase__get_advisors({ project_ref })` |
| Generate TS types | `supabase__generate_typescript_types({ project_ref })` |
| Deploy Worker | `cloudflare_api_execute({ method: "PUT", path: "/accounts/.../workers/scripts/scanner-api" })` |
| List Workers | `cloudflare_workers_bindings_workers_list()` |
| Create R2 bucket | `cloudflare_workers_bindings_r2_bucket_create({ name: "store-catalogs" })` |
| List KV namespaces | `cloudflare_workers_bindings_kv_namespaces_list()` |
| Query D1 | `cloudflare_workers_bindings_d1_database_query({ database_id, sql })` |
| View Worker logs | `cloudflare_observability` tools |
| Test with browser | `cloudflare-browser` tools on `https://scanner.pages.dev/{slug}` |
| Search Cloudflare docs | `cloudflare-docs` tools |

---

## 💰 Reminders

- **Never upgrade to Workers Paid** ($5/mo min) — use Workers Free
- **Never upgrade to Supabase Pro** ($25/mo) — use Supabase Free
- **Never enable paid Cloudflare add-ons** — use the free alternatives listed in `CLOUDFLARE-USAGE.md`
- **Local Supabase** (`supabase start`) uses Docker Desktop (free) — no cloud costs
- GitHub Free includes **2000 min/month** of Actions — more than enough
- If you hit a free tier limit, optimize before considering a paid plan

## 🔌 MCP Configuration Summary

These 8 MCP servers are pre-configured in `.opencode/opencode.json`:

| MCP Server | Type | Endpoint |
|---|---|---|
| `supabase` | Local process | `npx @supabase/mcp-server-supabase` via `SUPABASE_ACCESS_TOKEN` |
| `supabase-local` | Remote | `http://localhost:54321/mcp` (requires `supabase start`) |
| `cloudflare-api` | Remote | `https://mcp.cloudflare.com/mcp` |
| `cloudflare-docs` | Remote | `https://docs.mcp.cloudflare.com/mcp` |
| `cloudflare-workers-bindings` | Remote | `https://bindings.mcp.cloudflare.com/mcp` |
| `cloudflare-observability` | Remote | `https://observability.mcp.cloudflare.com/mcp` |
| `cloudflare-radar` | Remote | `https://radar.mcp.cloudflare.com/mcp` |
| `cloudflare-browser` | Remote | `https://browser.mcp.cloudflare.com/mcp` |

All enabled, all free. No additional setup needed.
