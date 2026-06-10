# Admin Panel Patterns

## Overview

The admin panel SPA (`admin/index.html`, `admin/js/app.js`) is the platform administration interface. It runs at `/admin/` and requires admin role (checked both client-side and server-side).

---

## App Structure

### Auth Flow (see `auth-flow.md` for full details)
- On load: checks `localStorage` for cached user, verifies session, checks role
- If `role !== 'admin'`: clears user, shows login view
- Login form on the same page (not redirect) — posts to `/api/auth/sign-in/email`, checks role
- On logout: redirects to login view (not /auth/)

### Sidebar Navigation
- 10 nav items: Overview, Analytics, Stores, Registrations, Users, Promotions, Discounts, Branding, Activity, Profile
- Nav built dynamically from `navItems` array with Feather icons
- Active nav item via left border accent
- Sidebar toggle on mobile
- Navigation closes sidebar automatically on mobile

### View Routing
- Hash-based routing
- Each view is a `.dash-view` element
- Initial view from hash or defaults to `overview`

---

## Views

### Overview
- Date display
- Platform-wide stat cards: Stores, Users, Products, Today's Scans, All Scans
- Store stats table: Store name, slug, products count, scans count, users count
- Data from: `API.getAdminStats()`
- Quick-link card: Pending Registrations → switches to Registrations view

### Analytics
- Platform-wide analytics dashboard
- Chart/table of top stores by scan activity
- Date range filtering
- Export CSV button
- Data from: `API.getPlatformAnalytics()`, `API.exportAnalytics()`

### Registrations
- Pending store sign-up requests table
- Each row: store name, slug, requestor email, date
- **Approve** / **Reject** buttons with confirmation
- Data from: `API.getRegistrations()`, `API.approveRegistration()`, `API.rejectRegistration()`

### Stores
- Store table: name, slug, created date, Explore + Delete buttons
- **New Store** modal: name + slug input with live URL preview (`ivond.com/{slug}`)
- **Delete Store** modal: confirmation with warning about products & scans deletion
- **Explore** → opens Store Detail view (see below)
- Data from: `API.getStores()`

### Store Detail
Drill-in view accessible from Stores table. Shows:
- **Stats cards:** products, scans, users for this store
- **Mapping card:** displays current column mapping status:
  - "✓ Active Mapping" with barcode/name/price column mapping, parser options, saved date, verification status
  - "○ Not Mapped" if no mapping exists
  - Action buttons: Edit Mapping, Test Mapping, Remove Mapping, Save Mapping Only
- **Pending imports table:** files awaiting action with Preview, Map & Import, Verify, Reject buttons
- **Import history table:** past imports with status and Preview button
- Back button to return to Stores list

### Mapping Editor Modal (Store Detail)
Opened from pending imports or Edit Mapping button:
1. **File preview table** — sample rows (first 5) showing detected columns
2. **Column selectors** — dropdowns for Barcode, Name, Price columns
3. **Live preview** — shows first row's values for selected columns in real-time
4. **Test Mapping button** — sends mapping to API, returns valid/total row count
5. **Save & Import** (default confirm) — saves mapping + imports products
6. **Save Mapping Only** button — saves mapping without importing

### Users
- User table: display name, email, role (styled tag), store name, Delete button
- Only non-admin users show Delete button
- **New User** modal: email, password, display name, store selector, role selector (staff/manager/admin)
- **Delete User** modal: confirmation
- Data from: `API.getAdminUsers()`

### Promotions (Banners + Offers)
- Store selection table: each store with banner/offer counts
- **Manage** → opens per-store promotion editor:
  - **Banners section:** table with image thumbnail, title, active status, Edit/Delete buttons. "+ New Banner" button opens modal with image crop at 800x300 (8:3), title, active toggle. GIF images supported.
  - **Offers section:** table with image, title, trigger type/value, active, Edit/Delete buttons. "+ New Offer" button opens modal with image crop at 400x200 (2:1), title, trigger type dropdown (category/product), trigger value, active toggle.
  - Data from: `API.getBanner()`, `API.getOffers()`, `API.getStorePromotions()` etc.

### Discounts
- Store selection table: each store with discount item count
- **Manage** → opens per-store discount editor:
  - Table: image thumbnail, name, barcode, category, price with strikethrough, discount %, featured star, active, Edit/Delete buttons
  - CRUD modal: image picker + crop at 300x400 (3:4), barcode, name, category, original price, discount type (percent/fixed), featured/active toggles, live price preview calculator
  - Data from: `API.getDiscounts()`, `API.getDiscount()`, etc.

### Branding
- Store selection table with status column: ✓ Configured / ○ Default / ✗ Error
- **Modify Branding** → opens per-store branding editor (same as dashboard branding but admin can edit any store)
  - Phone mockup preview with live updates
  - Fields: display name, logo, primary/accent colors, contact info, footer text, social links
  - Back button returns to store list

### Activity
- Recent scan events across all stores
- Table: store name, slug, products count, scans, users, created date
- Data from: `API.getAdminActivity(50)`

### Profile
- User email, display name, role (styled tag), store name

---

## Shared Utilities

### API Client (`admin/js/api.js`)
- Same pattern as dashboard API client but with additional admin-specific methods:
  - `getPendingImports()`, `mapImport()`, `remapImport()`, `testImport()`, `verifyImport()`, `rejectImport()`, `saveMapping()`, `deleteMapping()`
  - `getBanner()`, `getOffers()`
- Auto-redirects to `/admin/` on 401

### Modal (`window.showModal`)
- Same pattern as dashboard
- Confirm button labeled "Delete" in danger mode

### Toast (`showToast`)
- Same pattern as dashboard

### Helpers
- `esc(str)` — HTML entity escape
- `escReg(str)` — regex escape for user-provided strings
- `$(id)` — element shorthand
