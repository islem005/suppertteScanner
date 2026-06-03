-- ─── Shelf Scanner ─── Migration 002: Store Registrations
-- Table for prospective store owners to submit account requests.
-- Admin reviews and approves/rejects to create store + manager user.
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_registration (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  store_slug TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_registration_status ON store_registration(status);
CREATE INDEX IF NOT EXISTS idx_store_registration_email ON store_registration(contact_email);
