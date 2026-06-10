-- ─── Client Tracking Schema ──────────────────────────────────────────
-- Migration 003: Device registry, page views, scan_event extensions
-- Apply: wrangler d1 execute shelf-scanner-db --file=migrations/003_client_tracking.sql
-- ────────────────────────────────────────────────────────────────────────

-- Client device registry (auto-populated on first sighting)
CREATE TABLE IF NOT EXISTS client_device (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_user_agent TEXT,
  last_ip TEXT,
  last_device_type TEXT,
  total_visits INTEGER DEFAULT 1,
  total_scans INTEGER DEFAULT 0
);

-- Page views (visit tracking)
CREATE TABLE IF NOT EXISTS page_view (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  client_id TEXT,
  session_id TEXT NOT NULL,
  referrer TEXT,
  device_type TEXT,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Extend scan_event with client tracking columns
ALTER TABLE scan_event ADD COLUMN client_id TEXT;
ALTER TABLE scan_event ADD COLUMN session_id TEXT;

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_page_view_store ON page_view(store_id);
CREATE INDEX IF NOT EXISTS idx_page_view_client ON page_view(client_id);
CREATE INDEX IF NOT EXISTS idx_page_view_viewed_at ON page_view(viewed_at);
CREATE INDEX IF NOT EXISTS idx_client_device_store ON client_device(store_id);
CREATE INDEX IF NOT EXISTS idx_scan_event_client ON scan_event(client_id);
