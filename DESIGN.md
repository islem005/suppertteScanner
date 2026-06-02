# Shelf Scanner — Google Stitch Design Prompt

## Product Overview

Shelf Scanner is a SaaS platform that lets stores publish their product catalogs as scannable barcode lookups. Customers visit `/{store-slug}` on their phone, point the camera at a product barcode, and instantly see the name and price.

**Tagline:** In-store barcode scanning made simple — no app download required.

---

## Target Users

- **Store owners** — create a store, upload products via CSV, customize branding, view scan analytics
- **Customers** — scan barcodes in-store to see product info instantly via phone browser
- **Platform admins** — manage all stores, users, branding, monitor platform activity

---

## Visual Identity & Design Style

| Attribute | Value |
|---|---|
| **Theme** | Dark mode |
| **Base background** | `#0c0c0d` (near-black) with subtle indigo accent gradients |
| **Surface** | `#18181b` |
| **Elevated surface** | `#1f1f23` |
| **Primary color** | `#6366f1` (indigo) |
| **Primary hover** | `#818cf8` |
| **Accent/success** | `#10b981` (emerald green) |
| **Danger** | `#f43f5e` (rose) |
| **Warning** | `#f59e0b` (amber) |
| **Text primary** | `#fafafa` |
| **Text secondary** | `#a1a1aa` |
| **Text tertiary** | `#71717a` |
| **Border default** | `rgba(255,255,255,0.10)` |
| **Border subtle** | `rgba(255,255,255,0.06)` |
| **Font** | Inter, weights 400-800 |
| **Icons** | Feather Icons (stroke style, 16-24px) |
| **Border radius** | 8px (buttons/inputs), 12px (cards), 16px (modals) |
| **Shadows** | Subtle dark shadows: `0 1px 2px rgba(0,0,0,0.3)` to `0 8px 30px rgba(0,0,0,0.5)` |
| **Transitions** | 150ms ease (fast), 200ms ease (base), 300ms cubic-bezier (slow) |

### Spacing scale
4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px

---

## Pages / Screens

### 1. Scanner Page — `/{slug}`
**Purpose:** Customer-facing barcode scanner. Continuous live camera view.

**Layout:**
- Full-screen camera background (black)
- **Top bar:** "Ivond Scanner" title (left), install app button (download icon, right)
- **Center:** Corner-bracket scan frame (indigo, 4 corner brackets, no full border) with animated scan line
- **Below frame:** "Point camera at barcode" hint text (tertiary color)
- **Store profile section** (below top bar, centered):
  - Round logo (60px, bordered)
  - Store name (bold, primary text)
  - Social links row (icons only — Instagram/camera, TikTok/music, Website/globe, Email/mail, Phone/phone)
- **Result overlay** (bottom, slide-up card):
  - Green border + tint for found products: shows product name + price in DA
  - Red border for unknown: shows "Unknown product" + barcode
  - Auto-hides after 2-2.5s
- **Bottom controls:** Torch toggle button (zap icon)

**Behavior:**
- Uses `BarcodeDetector` API for continuous scanning
- Torch toggle supported on compatible devices
- PWA installable via install button in top bar (shown on `beforeinstallprompt` event)
- Logo, colors, social links pulled from store branding API
- Scan result shows for 2.5s then auto-dismisses
- No scanned items list — pure scan + display only

### 2. Marketing Homepage — `/`
**Purpose:** Public landing page to promote the platform.

**Sections:**
- **Nav:** Fixed top bar with "Shelf Scanner" logo, nav links (Features, How It Works, Pricing, Sign In, Get Started CTA). Mobile hamburger toggle.
- **Hero:** Two-column grid. Left: headline "Modern In-Store Barcode Scanning" with indigo highlight, subtitle, "Create Your Free Store" CTA button. Right: Phone mockup showing scanner in action (dark frame with scan line, result showing product name + price).
- **Features grid** (3-column): Cards with icon + title + description. Features: Instant Scanning, Your Brand Your Colors, Analytics Dashboard, CSV Import, Multi-Store Support, No App Required.
- **How It Works** (3 steps with arrows): Create Store → Upload Products → Go Live. Numbered circles with indigo fill.
- **Pricing** (3 cards): Free (0 DA), Pro (5,000 DA/month, featured with "Popular" badge), Enterprise (Custom). Each has feature list with checkmarks and CTA button.
- **Sign Up:** CTA section "Create your store — free" with Get Started button.
- **Footer:** Brand name + tagline, links row, copyright.

### 3. Store Dashboard — `/dashboard/`
**Purpose:** Store operators manage products, branding, view scan activity.

**Layout:**
- **Sidebar** (220px, left): Collapsible on mobile. Active item has left indigo border accent. Nav items with Feather icons:
  - Overview (bar-chart-2 icon)
  - Products (package icon)
  - Branding (palette icon)
  - Activity (clock icon)
  - Profile (user icon)
  - Sign Out (log-out icon, bottom)
- **Main content area:** Clean dark background with content cards.

**Views:**

#### Overview
- Stats row (4 cards): Scans Today, Total Scans, Product Count, Top Product
- Each card: icon + number (large bold) + label

#### Products
- Search bar + "Upload File" button
- Table with columns: Barcode, Name, Price, Category, Actions (delete)
- Upload modal: file picker (CSV/XLSX/DB/JSON) → if mapping exists, auto-map + show preview → confirm → import
- Loading state, empty state ("No products yet"), error state

#### Branding
- Form fields in a card:
  - Logo URL (text input with preview)
  - Display Name
  - Primary Color (color picker)
  - Accent Color (color picker)
  - Instagram URL
  - TikTok URL
  - Website URL
  - Contact Email
  - Contact Phone
  - Footer Text
- **Phone mockup preview** — live preview of how the scanner page looks with current branding settings (shows logo, store name, social icons, color changes in real time)
- Save button

#### Activity
- Stats cards (scans today, total scans)
- Top 10 scanned products table (rank, barcode, name, scan count)

#### Profile
- Current user info: email, display name, role, store name
- Change password form (current password, new password, confirm)

### 4. Admin Panel — `/admin/`
**Purpose:** Platform-wide management of stores, users, branding, imports.

**Layout:**
- Same sidebar layout as dashboard but different nav items:
  - Overview (bar-chart-2 icon) — platform stats
  - Stores (home icon)
  - Users (users icon)
  - Branding (palette icon)
  - Activity (clock icon)
  - Profile (user icon)
  - Sign Out (log-out icon)

**Views:**

#### Overview
- Stats cards: Total Stores, Total Users, Total Products, Total Scans
- Big numbers with labels

#### Stores
- Table: Name, Slug, Products count, Scans count, Created date, Actions (Delete, Explore)
- "Explore" button → drills into Store Detail view
- Store Detail:
  - Back button + store name header
  - Stats cards: Products count, Scans count, Users count
  - **Mapping card:** Shows mapping status (active/not mapped), column mapping summary (barcode, name, price fields), Edit/Test/Remove buttons
  - **Pending imports table:** File list with filename, type, row count, status, date, actions (Preview, Map & Import, Verify, Reject)
  - **Import history table:** Past imports with filename, type, rows, date
  - **Mapping editor modal:**
    - File preview table (first rows of data)
    - Column selector dropdowns (map source columns → barcode, name, price, category)
    - Live preview of mapped data
    - Test Mapping button (shows valid/invalid counts)
    - Save & Import / Save Mapping Only buttons
  - Create Store button (opens modal with name + slug fields)

#### Users
- Table: Email, Display Name, Role, Store, Created, Actions (Delete)
- Create User button (opens modal: email, password, display name, store selector, role selector)

#### Branding
- Store selector dropdown (top)
- Same branding form as dashboard + phone mockup preview
- Apply to any store

#### Activity
- Recent scan events table across all stores
- Columns: Store, Barcode, Product, Time

#### Profile
- Same as dashboard profile view

### 5. Auth Page — `/auth/`
**Purpose:** Login and registration.

**Layout:**
- Centered card (max 380px) with subtle border + shadow
- Tab toggle: Sign In / Sign Up
- **Login form:** Email, Password, Sign In button
- **Signup form:** Email, Password, Display Name, Store Name, Store Slug (auto-generated preview like "my-store"), Role (admin/manager/staff), Sign Up button
- Error messages below form (red)
- Loading state on submit button
- No logo/emojis — clean plain text header

---

## UI Components

### Buttons
| Variant | Style |
|---|---|
| Primary | Indigo bg `#6366f1`, white text, hover `#818cf8` |
| Secondary | `#27272a` bg, white text, hover `#1f1f23` |
| Ghost | Transparent, secondary text, hover bg |
| Danger | Rose tinted bg `rgba(244,63,94,0.15)`, rose text `#f43f5e` |
| Sizes | Default (8px 16px), sm (4px 12px), lg (16px 32px) |
| All | 8px radius, 600 weight, 0.875rem, active scale 0.97 |

### Form Inputs
- Full width, 12px 16px padding, 8px radius
- `#101012` inset background, `rgba(255,255,255,0.10)` border
- On focus: indigo border + 3px indigo glow ring
- Labels: uppercase, 0.75rem, 600 weight, secondary text, letter-spaced

### Cards
- `#18181b` bg, `rgba(255,255,255,0.06)` border, 12px radius, 20px padding
- Elevated variant: `#1f1f23` bg with subtle shadow

### Tables
- Wrapper: surface bg, 12px radius, overflow hidden
- Header: sticky, uppercase 0.75rem, tertiary text
- Rows: subtle bottom border, hover row highlight `#27272a`

### Modals
- Dark overlay `rgba(0,0,0,0.7)`, centered, fade in (150ms)
- Elevated bg `#1f1f23`, 16px radius, 16px padding, scale in animation (200ms)
- Close X button top right

### Sidebar
- 220px width, `#18181b` bg with right border
- Active item: left indigo border (2px) instead of bg fill
- Icons 16px, labels 14px
- User section at bottom with avatar circle + name + sign out
- Mobile: slides in as overlay, toggle button

### Stats Cards
- Icon + large number (2rem, 800 weight) + small label
- One per metric in a flex row

### Dashboard Card (generic)
- Header with title + optional action button
- Content area with padding

---

## UX Flows

### Customer Scan Flow
1. Customer opens `https://shelfscanner.com/my-store` on phone
2. Camera permission prompt → allowed
3. Live camera view with scan frame appears
4. Store branding loaded: logo, name, social links shown
5. Customer points camera at barcode
6. Overlay slides up: "Organic Honey — 8.99 DA" (green, 2.5s)
7. Scan logged to backend automatically
8. Repeat for next item
9. Can toggle torch for dark aisles

### Store Onboarding Flow
1. Visit homepage → click "Create Your Free Store"
2. Sign up form: email, password, store name, store slug
3. Dashboard loads with empty state
4. Go to Products → Upload file (CSV)
5. File auto-mapped if mapping exists, else waits for admin
6. Confirm preview → products imported
7. Go to Branding → set logo, colors, social links
8. Share store URL with customers

### Admin Import Flow
1. Store uploads file → status "pending" in admin
2. Admin sees pending in Store Detail
3. Click Preview → sees file data + suggested mapping
4. Open Mapping Editor → map columns using dropdowns
5. Test Mapping → see valid/invalid counts
6. Click "Save & Import" → products upserted
7. Store owner notified of completion

---

## States

Every view/page must handle:
- **Loading:** Skeleton cards or spinner (indigo accent)
- **Empty:** Centered message with descriptive text and action CTA
- **Error:** Inline error message (rose color) with retry option
- **Edge cases:** Long text truncated with ellipsis, network failures show toast, invalid barcodes show "Unknown product"

---

## Animations & Transitions

- Buttons: hover (bg change 150ms), active (scale 0.97)
- Cards: subtle hover lift (-2px translateY)
- Modals: fade in overlay (150ms) + scale in content (200ms)
- Scan line: 2s ease-in-out infinite (scanner page)
- Page transitions: fadeIn 200ms for dashboard views
- `prefers-reduced-motion`: all animations disabled
- `:focus-visible` indigo outline on all interactive elements
