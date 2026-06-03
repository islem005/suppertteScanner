# Scanner Storage — IndexedDB + localStorage Fallback

## Overview

The `Storage` singleton (`js/storage.js`) persists scanned items using IndexedDB with a localStorage fallback. It provides a key-value store for scan history items.

---

## Database

- **DB name:** `shelf-scanner`
- **Store name:** `items`
- **Key path:** `id`
- **Version:** 1

## API

### `Storage.getAll()`
Returns array of all stored items. Falls back to `localStorage.getItem('scanned_items')` if IndexedDB unavailable.

### `Storage.put(item)`
Inserts or updates an item (matched by `item.id`). Falls back to `localStorage` array manipulation.

### `Storage.remove(id)`
Deletes an item by its `id`. Falls back to `localStorage` filter-out.

### `Storage.clear()`
Empties the entire store. Falls back to `localStorage.removeItem('scanned_items')`.

---

## Fallback

When IndexedDB is unavailable (private browsing, old browsers), the module transparently falls back to:
- `localStorage` key: `scanned_items`
- Format: JSON array of item objects
- All CRUD operations work identically
