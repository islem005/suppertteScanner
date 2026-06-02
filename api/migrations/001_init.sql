-- ─── Shelf Scanner D1 Schema ──────────────────────────────────────────
-- Migration 001: Initial schema (Better Auth + app tables)
-- All columns match what Better Auth v1.6 expects (core + admin + org plugins).
-- Apply: wrangler d1 execute shelf-scanner-db --file=migrations/001_init.sql
-- For local: wrangler d1 execute shelf-scanner-db --local --file=migrations/001_init.sql
-- ────────────────────────────────────────────────────────────────────────

-- ─── Better Auth Core Tables ──────────────────────────────────────────
-- Schema based on @better-auth/kysely-adapter + admin plugin + org plugin

CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  -- Admin plugin fields
  role TEXT NOT NULL DEFAULT 'staff',
  banned INTEGER NOT NULL DEFAULT 0,
  banReason TEXT,
  banExpires TEXT,
  -- Custom Shelf Scanner fields (snake_case for our code)
  display_name TEXT,
  store_id TEXT
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  -- Organization plugin field
  activeOrganizationId TEXT,
  -- Admin plugin field
  impersonatedBy TEXT
);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt TEXT,
  refreshTokenExpiresAt TEXT,
  scope TEXT,
  password TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Organization Plugin Tables ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT,
  metadata TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organizationId, userId)
);

CREATE TABLE IF NOT EXISTS invitation (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  inviterId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Indexes for Better Auth tables ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
CREATE INDEX IF NOT EXISTS idx_member_organizationId ON member(organizationId);
CREATE INDEX IF NOT EXISTS idx_member_userId ON member(userId);
CREATE INDEX IF NOT EXISTS idx_invitation_organizationId ON invitation(organizationId);
CREATE INDEX IF NOT EXISTS idx_invitation_email ON invitation(email);

-- ─── Application Tables ────────────────────────────────────────────────

-- Products catalog
CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  barcode TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scan events (analytics)
CREATE TABLE IF NOT EXISTS scan_event (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  product_id TEXT,
  barcode TEXT NOT NULL,
  scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Store branding (appearance + social links)
CREATE TABLE IF NOT EXISTS store_branding (
  store_id TEXT PRIMARY KEY,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  accent_color TEXT DEFAULT '#10b981',
  display_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  footer_text TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  website_url TEXT,
  facebook_url TEXT,
  twitter_url TEXT,
  youtube_url TEXT
);

-- Promotions (banners/offers)
CREATE TABLE IF NOT EXISTS promotion (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('banner', 'offer')),
  title TEXT,
  image_data TEXT,
  trigger_type TEXT,
  trigger_value TEXT,
  active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Discount items (sales items)
CREATE TABLE IF NOT EXISTS discount_item (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  image_data TEXT,
  category TEXT,
  original_price REAL NOT NULL DEFAULT 0,
  new_price REAL NOT NULL DEFAULT 0,
  discount_percent REAL,
  featured INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Import mappings (one per store)
CREATE TABLE IF NOT EXISTS import_mapping (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL UNIQUE,
  column_mapping TEXT NOT NULL,
  parser_options TEXT,
  is_verified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pending imports (uploaded files awaiting admin or auto-map confirmation)
CREATE TABLE IF NOT EXISTS pending_import (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  row_count INTEGER DEFAULT 0,
  detected_columns TEXT,
  sample_rows TEXT,
  mapping_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'auto-mapped', 'imported', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  imported_at TEXT
);

-- ─── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_product_store_barcode ON product(store_id, barcode);
CREATE INDEX IF NOT EXISTS idx_scan_event_store ON scan_event(store_id);
CREATE INDEX IF NOT EXISTS idx_scan_event_scanned_at ON scan_event(scanned_at);
CREATE INDEX IF NOT EXISTS idx_promotion_store ON promotion(store_id);
CREATE INDEX IF NOT EXISTS idx_promotion_type ON promotion(type);
CREATE INDEX IF NOT EXISTS idx_discount_item_store ON discount_item(store_id);
CREATE INDEX IF NOT EXISTS idx_discount_item_category ON discount_item(category);
CREATE INDEX IF NOT EXISTS idx_pending_import_store ON pending_import(store_id);
CREATE INDEX IF NOT EXISTS idx_pending_import_status ON pending_import(status);
