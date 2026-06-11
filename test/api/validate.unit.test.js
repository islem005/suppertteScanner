import { describe, it, expect } from 'vitest'

const {
  validateBarcode,
  validateName,
  validatePrice,
  validateSlug,
  validateEmail,
  validateBody
} = await import('../../api/src/validate.js')

describe('validateBarcode', () => {
  it('accepts valid barcode', () => expect(validateBarcode('5901234567890')).toBeNull())
  it('rejects null', () => expect(validateBarcode(null)).toBe('Barcode is required'))
  it('rejects undefined', () => expect(validateBarcode(undefined)).toBe('Barcode is required'))
  it('rejects empty string', () => expect(validateBarcode('')).toBe('Barcode is required'))
  it('rejects whitespace-only', () => expect(validateBarcode('   ')).toBe('Barcode cannot be empty'))
  it('rejects too long', () => expect(validateBarcode('x'.repeat(51))).toBe('Barcode is too long (max 50 chars)'))
  it('accepts max length', () => expect(validateBarcode('x'.repeat(50))).toBeNull())
})

describe('validateName', () => {
  it('accepts valid name', () => expect(validateName('Product Name')).toBeNull())
  it('rejects null', () => expect(validateName(null)).toBe('Name is required'))
  it('uses custom field name', () => expect(validateName('', 'Title')).toBe('Title is required'))
  it('rejects whitespace-only', () => expect(validateName('   ')).toBe('Name cannot be empty'))
  it('rejects too long', () => expect(validateName('x'.repeat(201))).toBe('Name is too long (max 200 chars)'))
  it('accepts max length', () => expect(validateName('x'.repeat(200))).toBeNull())
})

describe('validatePrice', () => {
  it('accepts valid number', () => expect(validatePrice(10.99)).toBeNull())
  it('accepts string number', () => expect(validatePrice('10.99')).toBeNull())
  it('accepts zero', () => expect(validatePrice(0)).toBeNull())
  it('rejects null', () => expect(validatePrice(null)).toBe('Price is required'))
  it('rejects undefined', () => expect(validatePrice(undefined)).toBe('Price is required'))
  it('rejects negative', () => expect(validatePrice(-1)).toBe('Price cannot be negative'))
  it('rejects too high', () => expect(validatePrice(1000000)).toBe('Price is too high'))
  it('rejects NaN', () => expect(validatePrice('abc')).toBe('Price must be a number'))
})

describe('validateSlug', () => {
  it('accepts valid slug', () => expect(validateSlug('my-store')).toBeNull())
  it('rejects null', () => expect(validateSlug(null)).toBe('Slug is required'))
  it('rejects uppercase', () => expect(validateSlug('My-Store')).toBe('Slug can only contain lowercase letters, numbers, and hyphens'))
  it('rejects spaces', () => expect(validateSlug('my store')).toBe('Slug can only contain lowercase letters, numbers, and hyphens'))
  it('rejects too short', () => expect(validateSlug('a')).toBe('Slug must be at least 2 characters'))
  it('accepts 2 chars', () => expect(validateSlug('ab')).toBeNull())
  it('rejects too long', () => expect(validateSlug('a'.repeat(51))).toBe('Slug is too long (max 50 chars)'))
  it('accepts hyphens', () => expect(validateSlug('my-cool-store-42')).toBeNull())
})

describe('validateEmail', () => {
  it('accepts valid email', () => expect(validateEmail('user@example.com')).toBeNull())
  it('rejects null', () => expect(validateEmail(null)).toBe('Email is required'))
  it('rejects missing @', () => expect(validateEmail('userexample.com')).toBe('Invalid email format'))
  it('rejects missing domain', () => expect(validateEmail('user@')).toBe('Invalid email format'))
  it('rejects spaces', () => expect(validateEmail('user @example.com')).toBe('Invalid email format'))
  it('rejects too long', () => expect(validateEmail('a'.repeat(250) + '@b.co')).toBe('Email is too long'))
})

describe('validateBody', () => {
  const schema = {
    barcode: { required: true, validate: validateBarcode },
    name: { required: true, validate: validateName },
    price: { required: true, validate: validatePrice }
  }

  it('passes valid body', () => {
    const r = validateBody({ barcode: '123', name: 'Foo', price: 10 }, schema)
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('collects missing required fields', () => {
    const r = validateBody({}, schema)
    expect(r.valid).toBe(false)
    expect(r.errors).toContain('barcode is required')
    expect(r.errors).toContain('name is required')
    expect(r.errors).toContain('price is required')
  })

  it('validates present fields', () => {
    const r = validateBody({ barcode: '123', name: '', price: -1 }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it('skips validation for non-required missing fields', () => {
    const s = { name: { required: false, validate: validateName } }
    expect(validateBody({}, s).valid).toBe(true)
  })
})
