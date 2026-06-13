-- ─── Categories Table ─────────────────────────────────────────────────
-- Stores global base categories (store_id IS NULL) and per-store custom
-- categories. The `name` column is the canonical value stored in
-- product.category and discount_item.category. Translations in name_en,
-- name_fr, name_ar enable language-aware display in dashboard/admin.
-- Apply: wrangler d1 execute shelf-scanner-db --file=migrations/005_categories.sql
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS category (
  id TEXT PRIMARY KEY,
  store_id TEXT,               -- NULL = global base category (all stores inherit)
  name TEXT NOT NULL,          -- canonical name; unique per store_id (including NULL)
  name_en TEXT,                -- English display name
  name_fr TEXT,                -- French display name
  name_ar TEXT,                -- Arabic display name
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_category_store ON category(store_id);
