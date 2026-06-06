# Brainstorm: Loyalty Program

## Goal

Frictionless store loyalty program where customers earn points on purchases using **only their phone number** as identity. No app install, no passwords, no OTP, no email.

## Core Flow

1. **Cashier** inputs receipt total in Dashboard → clicks "Generate QR"
2. System creates a **one-time pending award** (expires in 5 min) with a secret token
3. QR code encodes: `https://{store}.ivond.com/loyalty/claim?t={token}`
4. **Customer** scans QR with phone camera (native camera or scanner app)
5. Claim page opens → checks `localStorage` for saved phone:
   - **Has phone** → auto-claims points instantly
   - **No phone** → prompts "Enter phone number" → saves → claims
6. Points awarded to customer account
7. Cashier screen updates: "Awarded +425 pts to 555-0100"
8. Customer sees: "You earned 425 points! Total: 1,200 pts"

## Design Principles

- **Frictionless** — No signup, no password, no OTP. Phone number is the account.
- **Phone IS identity** — Unique per store. Same phone can join multiple stores.
- **QR bridges gap** — Links cashier's purchase entry to customer's phone seamlessly.
- **No expiry** — Points never expire.
- **Platform-wide** — Admin controls the program settings, not per-store.

## Data Model

### `loyalty_customer`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `phone` | TEXT | Customer's phone number |
| `store_id` | TEXT FK | → organization |
| `total_points` | REAL | Current redeemable balance |
| `lifetime_points` | REAL | All-time earned |
| `visit_count` | INTEGER | Number of purchases |
| `last_visit_at` | TEXT | Last purchase timestamp |
| `created_at` / `updated_at` | TEXT | |
| UNIQUE(phone, store_id) | | |

### `loyalty_pending`
One-time QR token that expires in 5 minutes.
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID = QR token |
| `store_id` | TEXT FK | → organization |
| `purchase_amount` | REAL | Receipt total |
| `points_awarded` | REAL | Calculated at creation |
| `status` | TEXT | `'pending'` / `'claimed'` / `'expired'` |
| `customer_id` | TEXT FK | Set when claimed |
| `created_at` | TEXT | |
| `expires_at` | TEXT | created_at + 5 min |

### `loyalty_transaction`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `customer_id` | TEXT FK | → loyalty_customer |
| `store_id` | TEXT FK | → organization |
| `pending_id` | TEXT FK | → loyalty_pending (nullable) |
| `type` | TEXT | `'earn'` / `'redeem'` |
| `points` | REAL | +/- amount |
| `purchase_amount` | REAL | Receipt total (for earn) |
| `description` | TEXT | e.g., "Purchase at My Store" |
| `created_at` | TEXT | |

### `loyalty_program` (singleton)
Platform-wide config set by admin.
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Singleton |
| `points_per_dollar` | REAL | e.g., 10 |
| `active` | INTEGER | Toggle |
| `created_at` / `updated_at` | TEXT | |

### `loyalty_reward_tier`
Admin-configurable reward levels.
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | e.g., "$5 off", "Free coffee" |
| `points_required` | REAL | e.g., 1000 |
| `reward_type` | TEXT | `'discount'` or `'item'` |
| `reward_value` | TEXT | Discount amount or item name |
| `active` | INTEGER | |
| `sort_order` | INTEGER | Display order |

## API Endpoints

### Store (Dashboard) — requires staff auth

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/loyalty/pending` | Create pending award `{purchase_amount}` → `{token, qr_data}` |
| `GET` | `/api/loyalty/customer` | Lookup `?phone=X` → customer + balance + history |
| `POST` | `/api/loyalty/redeem` | Redeem `{phone, reward_id}` → deduct points |
| `GET` | `/api/loyalty/transactions` | Store's recent transactions |

### Public (no auth, rate-limited)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/loyalty/claim` | `?t=TOKEN&phone=PHONE` → award points |
| `GET` | `/api/loyalty/balance` | `?phone=X&store_id=Y` → balance + available rewards |

### Admin

| Method | Route | Purpose |
|---|---|---|
| `GET/PUT` | `/api/admin/loyalty/program` | Get/update config |
| `POST` | `/api/admin/loyalty/rewards` | Create reward tier |
| `PUT` | `/api/admin/loyalty/rewards/:id` | Update reward |
| `DELETE` | `/api/admin/loyalty/rewards/:id` | Delete reward |
| `GET` | `/api/admin/loyalty/customers` | List all customers (filterable) |
| `GET` | `/api/admin/loyalty/transactions` | Platform-wide transactions |

## Frontend Changes

### Dashboard — new "Loyalty" nav item

- **Award form**: Receipt amount input + big "Generate QR" button
- **QR display**: Large centered QR code with "Waiting for customer scan..."
- **Status**: Real-time update when claimed (phone number, points earned)
- **Customer lookup**: Search by phone → balance, history, redeem button
- **Recent claims**: List of today's claims with status

### Scanner PWA — `/loyalty/claim?t=TOKEN`

- **First visit**: Phone number input (stored in localStorage)
- **Return visit**: Auto-claims when URL has `?t=` token
- **Points badge**: Shows in top bar when phone is saved
- **Points popup**: Tap badge → balance, rewards progress, rewards list
- **Claim confirmation**: "You earned X points! Total: Y" animation

### Admin Panel — new "Loyalty" nav item

- **Settings**: points_per_dollar, on/off toggle
- **Rewards**: CRUD reward tiers
- **Customers**: Searchable table (phone, store, points, visits, last visit)
- **Transactions**: Full log with filters

## QR Code Strategy

- QR generated **client-side** in dashboard using lightweight canvas library
- API only returns the token (UUID), no server-side QR processing
- Token is a UUID stored in `loyalty_pending.id`
- URL format: `https://{store}.ivond.com/loyalty/claim?t={token}`
- Token expires in 5 minutes → cleaned up on claim or via cron

## Points Calculation

```
points = floor(purchase_amount × points_per_dollar)
```

Example with `points_per_dollar = 10`:
- $42.50 → 425 points
- $100.00 → 1000 points (exactly one reward at 1000 pt tier)
- $15.99 → 159 points

## Redemption Flow

1. Customer reaches reward threshold (e.g., 1000 pts)
2. Customer tells cashier "I want to redeem my points"
3. Cashier looks up phone → sees available rewards
4. Cashier clicks "Redeem" for chosen reward
5. System deducts points, logs transaction
6. Cashier applies discount at register manually
7. Customer sees updated balance in scanner app

## Implementation Order

1. Migration: `003_loyalty.sql`
2. DB helper integration
3. API routes: `/api/loyalty/*`
4. Admin API: `/api/admin/loyalty/*`
5. Dashboard loyalty view
6. Scanner PWA claim page + points badge
7. Admin panel loyalty view
