# Categories Pattern

## Overview

The category system uses a **base + per-store** model. Global base categories (created by admin) are inherited by all stores. Store managers can add custom categories for their store only.

## Schema (`api/migrations/005_categories.sql`)

```sql
CREATE TABLE category (
  id TEXT PRIMARY KEY,
  store_id TEXT,          -- NULL = global base category
  name TEXT NOT NULL,     -- canonical key; unique per store_id
  name_en TEXT,           -- English display name
  name_fr TEXT,           -- French display name
  name_ar TEXT,           -- Arabic display name
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(store_id, name)
);
```

- `store_id IS NULL` = global base category (all stores inherit)
- `name` is the canonical value stored in `product.category` and `discount_item.category`
- `name_en`, `name_fr`, `name_ar` enable language-aware display
- Unique constraint per `(store_id, name)` prevents duplicates

## API Routes (`api/src/routes/categories.js`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/categories?store_id=X` | authenticate | Returns global (store_id=NULL) + per-store categories, tagged `global: true/false` |
| POST | `/api/categories` | authenticate | Create category — managers can only create for own store |
| PUT | `/api/categories/:id` | authenticate | Update — global cats editable by admin only |
| DELETE | `/api/categories/:id` | authenticate | Cannot delete global base categories (400) |

### Listing Logic
```js
SELECT * FROM category WHERE store_id IS NULL OR store_id = ?
ORDER BY sort_order, name
// Results tagged: { ...row, global: row.store_id === null }
```

### Role Enforcement
- **Global categories** (store_id IS NULL): only admin role can create/edit; cannot be deleted
- **Per-store categories**: manager/admins for that store can CRUD
- Associate role is blocked by `authenticate` middleware (not admin/manager)

## Frontend Consumption

### API Client Methods (both `dashboard/js/api.js` and `admin/js/api.js`)
```js
getCategories: (storeId) => get('/categories?store_id=' + storeId),
createCategory: (data) => post('/categories', data),
updateCategory: (id, data) => put('/categories/' + id, data),
deleteCategory: (id) => del('/categories/' + id)
```

### Category Dropdown Population
Both dashboard and admin use `populateCategoryDropdown(selectId, selectedValue, storeId)` which:
1. Fetches categories via `API.getCategories(storeId)`
2. Sorts: global categories first, then per-store
3. Renders `<option>` elements with `name_en` (or `name` fallback) as text
4. Pre-selects `selectedValue` if provided

### Inline Category Creation
A "+" button next to category dropdowns opens a quick modal (inline modal) to create a category without leaving the current form:

```html
<button id="btn-add-cat-prod" class="btn small" type="button">+</button>
```

Pattern (`dashboard/js/app.js:502-530`):
1. Click "+" → opens modal with single input `#mod-inline-cat-name`
2. Confirm → calls `API.createCategory({ store_id, name })`
3. On success → re-populates dropdown + selects the new category
4. On error → shows toast with error message

### Caching
Categories are cached per store in-memory:
- Dashboard: `window._cachedCategories`
- Admin: `window._cachedAdminCats`
Cache is invalidated after create/update/delete operations.
