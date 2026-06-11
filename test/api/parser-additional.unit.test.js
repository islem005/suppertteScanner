import { describe, it, expect } from 'vitest'

const mod = await import('../../api/src/parser.js')
const { parseFile, autoDetectMapping } = mod

// Internal functions are not exported — test via parseFile and autoDetectMapping

describe('autoDetectMapping', () => {
  it('detects barcode column', () => {
    const m = autoDetectMapping(['name', 'barcode', 'price'])
    expect(m.barcode).toBe('barcode')
    expect(m.name).toBe('name')
    expect(m.price).toBe('price')
  })

  it('detects alternative barcode names', () => {
    expect(autoDetectMapping(['ean', 'name']).barcode).toBe('ean')
    expect(autoDetectMapping(['upc', 'name']).barcode).toBe('upc')
    expect(autoDetectMapping(['code', 'name']).barcode).toBe('code')
    expect(autoDetectMapping(['cod_bar', 'name']).barcode).toBe('cod_bar')
    expect(autoDetectMapping(['code_barre', 'name']).barcode).toBe('code_barre')
    expect(autoDetectMapping(['codigo', 'name']).barcode).toBe('codigo')
  })

  it('detects alternative name columns', () => {
    expect(autoDetectMapping(['barcode', 'product_name']).name).toBe('product_name')
    expect(autoDetectMapping(['barcode', 'product']).name).toBe('product')
    expect(autoDetectMapping(['barcode', 'description']).name).toBe('description')
    expect(autoDetectMapping(['barcode', 'nom']).name).toBe('nom')
    expect(autoDetectMapping(['barcode', 'nombre']).name).toBe('nombre')
    expect(autoDetectMapping(['barcode', 'designation']).name).toBe('designation')
  })

  it('detects alternative price columns', () => {
    expect(autoDetectMapping(['barcode', 'name', 'prix']).price).toBe('prix')
    expect(autoDetectMapping(['barcode', 'name', 'precio']).price).toBe('precio')
    expect(autoDetectMapping(['barcode', 'name', 'cost']).price).toBe('cost')
    expect(autoDetectMapping(['barcode', 'name', 'unit_price']).price).toBe('unit_price')
    expect(autoDetectMapping(['barcode', 'name', 'amount']).price).toBe('amount')
  })

  it('returns empty strings for missing columns', () => {
    const m = autoDetectMapping(['foo', 'bar', 'baz'])
    expect(m.barcode).toBe('')
    expect(m.name).toBe('')
    expect(m.price).toBe('')
  })

  it('is case-insensitive', () => {
    const m = autoDetectMapping(['Barcode', 'Name', 'Price'])
    expect(m.barcode).toBe('Barcode')
    expect(m.name).toBe('Name')
    expect(m.price).toBe('Price')
  })
})

describe('parseFile CSV', () => {
  it('parses a simple CSV with comma delimiter', async () => {
    const csv = 'barcode,name,price\n123,Product A,10.99\n456,Product B,5.50'
    const content = Buffer.from(csv).toString('base64')
    const result = await parseFile(content, 'products.csv')
    expect(result.row_count).toBe(2)
    expect(result.columns).toEqual(['barcode', 'name', 'price'])
    expect(result.rows[0].name).toBe('Product A')
    expect(result.detected_delimiter).toBe(',')
  })

  it('parses CSV with semicolon delimiter (European)', async () => {
    const csv = 'barcode;name;price\n123;Product A;10,99\n456;Product B;5,50'
    const content = Buffer.from(csv).toString('base64')
    const result = await parseFile(content, 'products.csv')
    expect(result.row_count).toBe(2)
    expect(result.detected_delimiter).toBe(';')
  })

  it('handles empty CSV (header only, no data rows)', async () => {
    const csv = 'barcode,name,price'
    const content = Buffer.from(csv).toString('base64')
    const result = await parseFile(content, 'products.csv')
    expect(result.row_count).toBe(0)
    expect(result.columns).toEqual([])
  })

  it('throws for unsupported file type', async () => {
    await expect(parseFile('', 'data.pdf')).rejects.toThrow('Unsupported file type: .pdf')
  })
})

describe('parseFile JSON', () => {
  it('parses a JSON array of products', async () => {
    const data = JSON.stringify([{ barcode: '123', name: 'A', price: 10 }])
    const result = await parseFile(Buffer.from(data).toString('base64'), 'products.json')
    expect(result.row_count).toBe(1)
    expect(result.rows[0].barcode).toBe('123')
  })

  it('parses JSON with products key', async () => {
    const data = JSON.stringify({ products: [{ barcode: '123', name: 'A' }] })
    const result = await parseFile(Buffer.from(data).toString('base64'), 'products.json')
    expect(result.row_count).toBe(1)
  })

  it('rejects invalid JSON', async () => {
    await expect(parseFile(Buffer.from('not json').toString('base64'), 'data.json'))
      .rejects.toThrow('Invalid JSON file')
  })
})
