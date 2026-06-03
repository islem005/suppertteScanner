-- ─── R2 File Storage Migration ──────────────────────────────────────────
-- Adds image_url columns for R2-backed file storage, replacing base64 in D1.
-- All columns are nullable — old base64 data stays in image_data for fallback.
-- ────────────────────────────────────────────────────────────────────────

-- Promotion images: store R2 URL instead of base64 in image_data
ALTER TABLE promotion ADD COLUMN image_url TEXT;

-- Discount item images: store R2 URL instead of base64 in image_data
ALTER TABLE discount_item ADD COLUMN image_url TEXT;
