# Store Limits Pattern

## Overview

Per-store limits for promotions and discounts are stored in the organization's `metadata` JSON field and enforced server-side before create/update operations.

## Default Limits (`api/src/limits.js`)

```js
const DEFAULTS = {
  offersAlwaysShow: 3,    // Max "always show" offers (no trigger type)
  offersActive: 20,       // Max total active offers
  discountsFeatured: 10,  // Max featured discounts
  discountsActive: 100    // Max total active discounts
}
```

## Loading Limits

```js
import { getStoreLimits } from '../limits.js'

const limits = await getStoreLimits(env.DB, storeId)
// Returns DEFAULTS merged with any per-store overrides
```

Limits are read from `organization.metadata` parsed JSON:
```json
{
  "limits": {
    "offersAlwaysShow": 5,
    "activeOffers": 30,
    "discountsFeatured": 15,
    "discountsActive": 200
  }
}
```

## Enforcement

The limits module provides count functions that accept an optional `excludeId` parameter (for edit scenarios):

| Function | Counts |
|----------|--------|
| `countAlwaysShowOffers(db, storeId, excludeId?)` | Active offers with no trigger type |
| `countActiveOffers(db, storeId, excludeId?)` | All active offers |
| `countFeaturedDiscounts(db, storeId, excludeId?)` | Active + featured discounts |
| `countActiveDiscounts(db, storeId, excludeId?)` | All active discounts |

### Usage in Routes

In `api/src/routes/discounts.js`:
```js
const limits = await getStoreLimits(c.env.DB, storeId)
const featured = await countFeaturedDiscounts(c.env.DB, storeId, id)
if (featured >= limits.discountsFeatured) {
  return c.json({ error: `Max ${limits.discountsFeatured} featured discounts` }, 400)
}
```

Same pattern in `api/src/routes/promotions.js` for offer limits.

## Setting Limits

Limits are set by updating the organization's `metadata` field (admin-only). There is no dedicated UI in the current dashboard/admin — they are set directly in the database or via a future admin panel feature.
