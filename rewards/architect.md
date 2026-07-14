# Rewards — ivond Loyalty Program

- **Subdomain:** `rewards.ivond.com`
- **Status:** Separate project from SKANER (scanner)
- **Auth:** Fully self-contained (no shared auth with scanner)
- **Identity model:** QR-as-identity (server-generated UUID)

---

## Identity Model: QR as Loyalty Card

Each customer gets a unique QR code that serves as their persistent identity. The QR encodes a URL that acts purely as a lookup key — the server is the source of truth for all data.

```
QR content: https://rewards.ivond.com/card/{uuid}
```

### Customer Flow

1. **First visit** to `rewards.ivond.com`
   - `POST /api/customers` → server generates UUID, inserts customer row, returns `{ uuid, points: 0, tier: "Bronze" }`
   - UUID cached in `localStorage`
   - QR code rendered client-side encoding `https://rewards.ivond.com/card/{uuid}`
   - Customer taps "Save to gallery" to keep a backup

2. **Subsequent visits**
   - Read UUID from `localStorage`
   - `GET /api/customers/:uuid` → updated points, tier, transaction history

3. **At checkout** (shop staff terminal)
   - Staff opens `rewards.ivond.com/dashboard/` → "Scan QR" view
   - `BarcodeDetector` scans customer's QR on their phone
   - Extracts UUID from scanned URL
   - `GET /api/customers/:uuid` → shows customer card (name, points, tier)
   - Staff adds points or redeems a reward

4. **Lost phone recovery**
   - Customer saved the QR screenshot to their gallery
   - On new phone, customer visits `rewards.ivond.com`
   - Shows shop staff the saved QR → staff scans it → account restored
   - Customer can also bookmark `rewards.ivond.com/card/{uuid}` on a new device

### Why This Is Secure

- The QR is just a **key** — all data lives server-side in D1
- A screenshot from last week still shows the **current** balance when scanned
- Customers cannot manipulate their points by editing the QR
- Rate limiting protects against brute-force enumeration of UUIDs

---

## Architecture

```
                          ┌─────────────────────────┐
                          │  scanner-frontend        │  (existing Worker)
                          │    rewards.ivond.com/*   │────→ Workers Assets
                          └─────────────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          │  rewards-api             │  (new Worker)
                          │  Hono + Better Auth + D1 │
                          │  routes:                 │
                          │   rewards.ivond.com       │
                          │   /api/*                 │
                          └────────────┬────────────┘
                                       │
                              ┌────────┴────────┐
                              │  loyalty-db (D1) │
                              │  (separate DB)   │
                              └─────────────────┘
```

### Workers

| Worker | Purpose | New/Existing |
|---|---|---|
| `scanner-frontend` | Serves all frontend SPAs via Workers Assets, routes by hostname | Existing |
| `rewards-api` | Hono API + Better Auth for staff, customer endpoints, D1 for loyalty data | **New** |

### D1 Database

| Name | Purpose |
|---|---|
| `loyalty-db` | All loyalty data: customers, staff, rewards, tiers, redemptions, transactions |

### Domain Routing

| Pattern | Target Worker |
|---|---|
| `rewards.ivond.com/*` | `scanner-frontend` (serves SPAs) |
| `rewards.ivond.com/api/*` | `rewards-api` (API) |

### Frontend Routing (in `scanner-frontend`)

| Path | SPA Served | Purpose |
|---|---|---|
| `/card/:uuid` | `/loyalty-card/index.html` | Public points card (minimal) |
| `/dashboard/*` | `/loyalty-dashboard/index.html` | Shop scanning terminal (staff) |
| `/admin/*` | `/loyalty-admin/index.html` | Platform admin panel (staff) |
| `/*` | `/loyalty/index.html` | Customer wallet (default) |

---

## Auth Model

### Customers (shoppers) — No Auth

There is no customer authentication. The UUID is the identity. Security comes from:
- Random UUIDv4 (unguessable)
- Server-side source of truth
- Rate limiting on all public endpoints

### Staff (admins, managers) — Better Auth

Separate Better Auth instance in `rewards-api` with its own `staff_user` table in `loyalty-db`.

| Role | Access |
|---|---|
| `admin` | Full access: manage rewards, tiers, all customers, reports |
| `manager` | Per-store access: scan customers, add points, redeem rewards, view own store's customers |

Staff login at:
- `rewards.ivond.com/dashboard/login` — for managers (shop staff)
- `rewards.ivond.com/admin/login` — for admins (platform)

---

## Data Model

### `loyalty-db` Tables

```sql
staff_user (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'manager',  -- 'admin' | 'manager'
  store_id      TEXT,                             -- NULL for admins
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
)

staff_session (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES staff_user(id),
  token      TEXT NOT NULL,
  expires_at TEXT NOT NULL
)

customer (
  id              TEXT PRIMARY KEY,
  uuid            TEXT UNIQUE NOT NULL,         -- public-facing identifier
  store_id        TEXT NOT NULL,                 -- store that "owns" this customer
  display_name    TEXT,                          -- optional, set by customer
  points_balance  INTEGER NOT NULL DEFAULT 0,
  tier_id         TEXT REFERENCES tier(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at    TEXT
)

tier (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL,
  name        TEXT NOT NULL,                     -- e.g. "Bronze", "Silver", "Gold"
  min_points  INTEGER NOT NULL,
  multiplier  REAL NOT NULL DEFAULT 1.0,         -- points earning multiplier
  color       TEXT,                              -- hex color for badge
  sort_order  INTEGER NOT NULL DEFAULT 0
)

reward (
  id            TEXT PRIMARY KEY,
  store_id      TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  points_cost   INTEGER NOT NULL,
  image_url     TEXT,
  stock         INTEGER,                        -- NULL = unlimited
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
)

redemption (
  id            TEXT PRIMARY KEY,
  customer_id   TEXT NOT NULL REFERENCES customer(id),
  reward_id     TEXT NOT NULL REFERENCES reward(id),
  points_spent  INTEGER NOT NULL,
  staff_user_id TEXT REFERENCES staff_user(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
)

transaction (
  id            TEXT PRIMARY KEY,
  customer_id   TEXT NOT NULL REFERENCES customer(id),
  store_id      TEXT NOT NULL,
  type          TEXT NOT NULL,                   -- 'earn' | 'spend' | 'adjust'
  amount        INTEGER NOT NULL,                -- positive always
  balance_after INTEGER NOT NULL,
  description   TEXT,
  staff_user_id TEXT REFERENCES staff_user(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
)
```

---

## API Endpoints

### Public (rate-limited)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/customers` | Create customer, returns `{ uuid, qr_url }` |
| `GET` | `/api/customers/:uuid` | Get customer (points, tier, display_name) |
| `GET` | `/api/customers/:uuid/transactions` | Last 20 transactions |

### Staff Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/staff/sign-in` | Staff email/password login |
| `POST` | `/api/staff/sign-out` | Staff logout |
| `GET` | `/api/staff/me` | Current staff profile |

### Staff-Only (auth required)

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/api/customers/:uuid/points` | manager+ | Add/remove points `{ amount: +10 or -10 }` |
| `POST` | `/api/customers/:uuid/redeem` | manager+ | Redeem reward `{ reward_id }` |
| `GET` | `/api/customers/search` | manager+ | Search by name or UUID `?q=` |
| `GET` | `/api/rewards` | manager+ | List rewards for store |
| `POST` | `/api/rewards` | admin | Create reward |
| `PUT` | `/api/rewards/:id` | admin | Update reward |
| `DELETE` | `/api/rewards/:id` | admin | Delete reward |
| `GET` | `/api/tiers` | admin | List tiers |
| `POST` | `/api/tiers` | admin | Create tier |
| `PUT` | `/api/tiers/:id` | admin | Update tier |
| `DELETE` | `/api/tiers/:id` | admin | Delete tier |
| `GET` | `/api/stats/dashboard` | manager+ | Today's stats: redemptions, top customers |

---

## SPAs

### `loyalty/` — Customer Wallet

- Entry: `loyalty/index.html`
- Displays: QR code (using `qrcodejs`), display name (editable), tier badge, points balance, transaction history
- "Save QR to gallery" button
- First visit: auto-create customer via `POST /api/customers`
- Dependencies: `qrcodejs` (CDN or bundled)

### `loyalty-card/` — Public Card Page

- Entry: `loyalty-card/index.html`
- Minimal page: fetch UUID from URL path, `GET /api/customers/:uuid`, show name + points
- No interactivity — what opens when QR URL is visited directly

### `loyalty-dashboard/` — Shop Scanning Terminal

- Entry: `loyalty-dashboard/index.html`
- Staff login via Better Auth (inline form)
- Main view: QR scanner using `BarcodeDetector` API (same pattern as SKANER's `scanner.html`)
- On scan: extract UUID from URL → `GET /api/customers/:uuid` → customer card
- Actions: "Add 10 pts", "Add 25 pts", "Custom amount", "Redeem reward" (dropdown)
- Transaction log for current customer
- Customer search

### `loyalty-admin/` — Platform Admin

- Entry: `loyalty-admin/index.html`
- Staff login via Better Auth (admin role only)
- Views: Rewards CRUD, Tiers CRUD, All customers (table), Reports/stats

---

## Integration with SKANER (Scanner)

Both projects share the `ivond.com` domain zone and the `scanner-frontend` Worker, but are otherwise fully independent.

### Shared

- `scanner-frontend` Worker (routes `rewards.ivond.com` → loyalty SPAs)
- CSS token system (`css/tokens.css`) — loyalty SPAs should use the same design tokens for brand consistency
- Feature detection patterns (`BarcodeDetector` API usage)

### NOT Shared

- No shared auth (separate Better Auth instances, separate D1 databases)
- No shared user tables
- No shared API endpoints
- No shared middleware
- No shared deployment cycle

---

## Directory Structure

```
rewards/
  architect.md                       ← This file

  rewards-api/                       # Hono Workers API
    package.json
    wrangler.toml
    migrations/
      001_init.sql
    src/
      index.js                       # Hono app, CORS, middleware registration
      middleware.js                  # Staff session loader, role gates
      auth/
        index.js                     # Better Auth instance (staff only)
      routes/
        staff-auth.js                # Better Auth route handler
        customers.js                 # POST /api/customers, GET /:uuid
        points.js                    # POST /:uuid/points
        redemptions.js               # POST /:uuid/redeem, GET /:uuid/transactions
        rewards.js                   # CRUD /api/rewards
        tiers.js                     # CRUD /api/tiers
        stats.js                     # GET /api/stats/dashboard

  loyalty/                           # Customer wallet SPA
    index.html
    js/app.js
    css/style.css

  loyalty-card/                      # Public card page
    index.html
    js/app.js
    css/style.css

  loyalty-dashboard/                 # Shop scanning terminal
    index.html
    js/app.js
    css/style.css

  loyalty-admin/                     # Platform admin panel
    index.html
    js/app.js
    css/style.css
```

---

## Build & Deploy

### Vite Build

Add to `vite.config.js` rollup input:

```js
loyalty: resolve(__dirname, 'rewards/loyalty/index.html'),
loyaltyCard: resolve(__dirname, 'rewards/loyalty-card/index.html'),
loyaltyDashboard: resolve(__dirname, 'rewards/loyalty-dashboard/index.html'),
loyaltyAdmin: resolve(__dirname, 'rewards/loyalty-admin/index.html')
```

### Frontend Worker Routing

Add to `frontend-worker/src/index.js` before the `*.ivond.com` catch-all:

```js
if (host === 'rewards.ivond.com') {
  if (isAsset) return addSecurityToResponse(await env.ASSETS.fetch(request))
  if (url.pathname.startsWith('/card/')) {
    return addSecurityToResponse(await env.ASSETS.fetch(new URL('/loyalty-card/index.html', request.url).href))
  }
  if (url.pathname.startsWith('/dashboard/')) {
    return addSecurityToResponse(await env.ASSETS.fetch(new URL('/loyalty-dashboard/index.html', request.url).href))
  }
  if (url.pathname.startsWith('/admin/')) {
    return addSecurityToResponse(await env.ASSETS.fetch(new URL('/loyalty-admin/index.html', request.url).href))
  }
  return addSecurityToResponse(await env.ASSETS.fetch(new URL('/loyalty/index.html', request.url).href))
}
```

### Deploy Steps

1. Create `loyalty-db` D1 database
2. Apply migration: `wrangler d1 execute loyalty-db --remote --file=rewards-api/migrations/001_init.sql`
3. Set secrets: `wrangler secret put BETTER_AUTH_SECRET`
4. Deploy API: `cd rewards-api && wrangler deploy`
5. Register `rewards.ivond.com` custom domain on `scanner-frontend` Worker
6. Add route `rewards.ivond.com/api/*` → `rewards-api` Worker
7. Build + deploy frontend (existing `npm run build` + `cd frontend-worker && wrangler deploy`)

### CI/CD

Add a job to `.github/workflows/deploy.yml` (or a separate workflow) that:

- Triggers on changes to `rewards/` directory
- Builds loyalty SPAs
- Deploys `rewards-api` Worker
- Runs loyalty test suite

---

## Open Questions / Future Considerations

- **Integration with scanner PWA:** Points could auto-earn when a customer's barcode is scanned in the scanner. Currently out of scope — points are manual only.
- **Receipt printing:** Future enhancement for the dashboard terminal.
- **Customer analytics:** Trends, visit frequency, points velocity — future admin feature.
- **Email notifications:** If a customer provides an email (optional), send monthly point balance reminders.
- **Multi-language:** Same i18n approach as SKANER dashboard if needed.

---

## Design Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-07 | QR-as-identity model | Zero friction for customer, no auth needed, screenshot-based recovery eliminates need for passkeys/WebAuthn |
| 2026-07-07 | Server-side UUID generation | Source of truth lives on server from first moment, avoids UUID collisions |
| 2026-07-07 | Separate D1 database (loyalty-db) | True isolation from SKANER, independent migrations, no schema coupling |
| 2026-07-07 | Separate Better Auth for staff | Fully self-contained project, staff accounts are loyalty-specific |
| 2026-07-07 | Manual point earning at terminal | Simpler v1; auto-earn from scanner can be added later as integration |
| 2026-07-07 | Per-store points scope | Each store has its own loyalty program, customers have separate balances per store |
| 2026-07-07 | Separate loyalty admin + dashboard SPAs | Loyalty is a separate project with its own management interfaces |
