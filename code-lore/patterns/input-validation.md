# Input Validation

## Overview

Server-side validation helpers in `api/src/validate.js`. Each validator returns `null` for valid input or an error message string for invalid.

## Validators

| Function | Validates |
|---|---|
| `validateBarcode(val)` | Required, max 50 chars, trimmed |
| `validateName(val, field)` | Required, max 200 chars, trimmed. Field name customizable |
| `validatePrice(val)` | Required, number, non-negative, max 999999.99 |
| `validateSlug(val)` | Required, lowercase+digits+hyphens, 2-50 chars |
| `validateEmail(val)` | Required, basic email format, max 254 chars |

## Schema Validation

```js
validateBody(body, {
  barcode: { required: true, validate: validateBarcode },
  name:    { required: true, validate: (v) => validateName(v, 'Product name') },
  price:   { required: true, validate: validatePrice }
})
// Returns: { valid: boolean, errors: string[] }
```

- Required fields must be non-null, non-undefined, non-empty-string
- Optional fields are skipped if absent/empty
- Returns all validation errors (not just the first)
