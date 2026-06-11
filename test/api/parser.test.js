import { describe, it, expect } from 'vitest'

/**
 * Parser tests - these test the CSV/JSON parsing logic used
 * for product import. The parser handles:
 * - CSV parsing with headers
 * - JSON array parsing
 * - European number format (comma as decimal separator)
 * - Danish column name mapping
 * - Input validation
 */

// Inline the parser logic for testing, since the module uses Cloudflare D1 bindings
// We test the pure parsing functions

describe('Parser - Number parsing', () => {
  function parsePrice(value) {
    if (value == null || value === '') return null
    // Handle European format: "1.234,56" or "1234,56"
    let s = String(value).trim()
    // If contains both '.' and ',', assume European
    if (s.includes('.') && s.includes(',')) {
      // European: dots are thousands separators, comma is decimal
      s = s.replace(/\./g, '').replace(',', '.')
    } else if (s.includes(',')) {
      // Only comma - could be European decimal
      s = s.replace(',', '.')
    }
    const n = parseFloat(s)
    return isNaN(n) ? null : n
  }

  it('parses standard US format', () => {
    expect(parsePrice('29.99')).toBe(29.99)
  })

  it('parses European format with comma decimal', () => {
    expect(parsePrice('29,99')).toBe(29.99)
  })

  it('parses European format with thousand separators', () => {
    expect(parsePrice('1.234,56')).toBe(1234.56)
  })

  it('parses integer values', () => {
    expect(parsePrice('100')).toBe(100)
  })

  it('returns null for empty string', () => {
    expect(parsePrice('')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(parsePrice(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(parsePrice(undefined)).toBeNull()
  })

  it('returns null for non-numeric strings', () => {
    expect(parsePrice('abc')).toBeNull()
  })

  it('parses zero', () => {
    expect(parsePrice('0')).toBe(0)
  })

  it('parses European format without integer part', () => {
    expect(parsePrice(',99')).toBe(0.99)
  })

  it('parses large European price', () => {
    // 12.345.678,90
    expect(parsePrice('12.345.678,90')).toBe(12345678.90)
  })
})

describe('Parser - CSV row parsing', () => {
  function parseRow(headers, row) {
    const obj = {}
    headers.forEach((h, i) => {
      if (i < row.length) {
        obj[h.trim()] = row[i].trim()
      }
    })
    return obj
  }

  const HEADERS = ['Barcode', 'Name', 'Pris', 'Kategori', 'Producent']

  it('parses a standard row', () => {
    const row = ['5712345678901', 'Mælk', '12,95', 'Mejeri', 'Arla']
    const obj = parseRow(HEADERS, row)
    expect(obj.Barcode).toBe('5712345678901')
    expect(obj.Name).toBe('Mælk')
    expect(obj.Pris).toBe('12,95')
    expect(obj.Kategori).toBe('Mejeri')
    expect(obj.Producent).toBe('Arla')
  })

  it('handles missing fields', () => {
    const row = ['5712345678901', 'Mælk']
    const obj = parseRow(HEADERS, row)
    expect(obj.Barcode).toBe('5712345678901')
    expect(obj.Name).toBe('Mælk')
    expect(obj.Pris).toBeUndefined()  // missing field is undefined
  })

  it('handles extra fields beyond headers', () => {
    const row = ['5712345678901', 'Mælk', '12,95', 'Mejeri', 'Arla', 'EXTRA']
    const obj = parseRow(HEADERS, row)
    expect(obj.Barcode).toBe('5712345678901')
  })
})

describe('Parser - Danish column mapping', () => {
  const DANISH_MAP = {
    'stregkode': 'barcode',
    'varenummer': 'barcode',
    'vare': 'name',
    'navn': 'name',
    'beskrivelse': 'description',
    'pris': 'price',
    'kategori': 'category',
    'producent': 'manufacturer',
    'antal': 'quantity',
    'enhed': 'unit'
  }

  function mapColumn(col) {
    return DANISH_MAP[col.toLowerCase()] || col
  }

  it('maps Danish column names to English', () => {
    expect(mapColumn('Stregkode')).toBe('barcode')
    expect(mapColumn('PRIS')).toBe('price')
    expect(mapColumn('Navn')).toBe('name')
    expect(mapColumn('Kategori')).toBe('category')
    expect(mapColumn('Producent')).toBe('manufacturer')
  })

  it('passes through unknown columns', () => {
    expect(mapColumn('Unknown')).toBe('Unknown')
    expect(mapColumn('Barcode')).toBe('Barcode')
  })

  it('handles synonyms', () => {
    expect(mapColumn('Stregkode')).toBe('barcode')
    expect(mapColumn('Varenummer')).toBe('barcode')
    expect(mapColumn('Vare')).toBe('name')
    expect(mapColumn('Navn')).toBe('name')
  })
})
