/**
 * Server-side input validation helpers.
 * Returns null if valid, or an error message string if invalid.
 */

export function validateBarcode(val) {
  if (!val || typeof val !== 'string') return 'Barcode is required'
  val = val.trim()
  if (val.length === 0) return 'Barcode cannot be empty'
  if (val.length > 50) return 'Barcode is too long (max 50 chars)'
  return null
}

export function validateName(val, field = 'Name') {
  if (!val || typeof val !== 'string') return `${field} is required`
  val = val.trim()
  if (val.length === 0) return `${field} cannot be empty`
  if (val.length > 200) return `${field} is too long (max 200 chars)`
  return null
}

export function validatePrice(val) {
  if (val === undefined || val === null) return 'Price is required'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return 'Price must be a number'
  if (n < 0) return 'Price cannot be negative'
  if (n > 999999.99) return 'Price is too high'
  return null
}

export function validateSlug(val) {
  if (!val || typeof val !== 'string') return 'Slug is required'
  if (!/^[a-z0-9-]+$/.test(val)) return 'Slug can only contain lowercase letters, numbers, and hyphens'
  if (val.length < 2) return 'Slug must be at least 2 characters'
  if (val.length > 50) return 'Slug is too long (max 50 chars)'
  return null
}

export function validateEmail(val) {
  if (!val || typeof val !== 'string') return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Invalid email format'
  if (val.length > 254) return 'Email is too long'
  return null
}

/**
 * Validate request body against a schema.
 * @param {object} body - The request body
 * @param {object} schema - { fieldName: { required?: boolean, validate: (value) => string|null } }
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBody(body, schema) {
  const errors = []
  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field]
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`)
      continue
    }
    if (value !== undefined && value !== null && value !== '' && rules.validate) {
      const err = rules.validate(value)
      if (err) errors.push(err)
    }
  }
  return { valid: errors.length === 0, errors }
}
