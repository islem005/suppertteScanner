# Handoff v12 — 2026-06-14

## Branch
`main`

## Summary
Store duplicate feature for admin (copy org + branding + mapping + products + promotions + discounts), plus slug uniqueness fix on store creation endpoint, and test infrastructure fix for concurrent store slug collision.

## Recent Changes

### New Feature: Duplicate Store
- **`POST /api/stores/:id/duplicate`** (`api/src/routes/stores.js`) — Admin-only endpoint that copies a source store's entire configuration to a new store with different name/slug
  - Copies: `organization`, `store_branding`, `import_mapping`, `product`, `promotion`, `discount_item`
  - All rows get fresh UUIDs; timestamps set to current time
  - Uses D1 `batch()` for atomic insert of all rows
  - Fires subdomain registration + QR generation (fire-and-forget)
  - Application-level slug uniqueness check (409 on conflict)
- **`duplicateStore()`** (`admin/js/api.js`) — API client method
- **Admin UI** (`admin/js/app.js`) — "Duplicate" button per store row in table; modal pre-filled with `{name} Copy` / `{slug}-copy`; slug preview updates on input

### Bug Fix: Slug Uniqueness on Store Creation
- `POST /api/stores` now checks slug uniqueness at application level before DB insert, returning proper 409 instead of a cryptic 500 from the UNIQUE constraint violation

### Test Fix
- `test/api/setup.js` — Added random suffix to `TEST_STORE_SLUG` to prevent concurrent test file collision (was causing 409 when multiple test files initialized in the same ms)

## Next Tasks
1. Verify duplicate store flow end-to-end in admin.ivond.com
2. Verify BREVO email sending from admin panel
3. (Optional) Admin i18n — large task, admin pages are English-only

## Lore Flags
- No new cross-cutting patterns to document
