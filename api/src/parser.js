import { parse } from 'csv-parse/sync'
import * as XLSX from 'xlsx'

export async function parseFile(content, filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const buffer = Buffer.from(content, 'base64')

  if (ext === 'csv') {
    return parseCsv(buffer.toString('utf-8'), filename)
  }
  if (ext === 'json') {
    return parseJson(buffer.toString('utf-8'))
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsx(buffer)
  }
  if (ext === 'db' || ext === 'sqlite' || ext === 'sqlite3') {
    return parseSqlite(buffer)
  }
  throw new Error(`Unsupported file type: .${ext}`)
}

function detectDelimiter(firstLine) {
  const comma = (firstLine.match(/,/g) || []).length
  const semicolon = (firstLine.match(/;/g) || []).length
  if (semicolon > comma) return ';'
  return ','
}

function parseCsv(text, filename) {
  const firstLine = text.split('\n')[0] || ''
  const delimiter = detectDelimiter(firstLine)
  const isEuropean = delimiter === ';'

  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
    relax_column_count: true
  })

  if (records.length === 0) {
    return { columns: [], rows: [], row_count: 0, detected_delimiter: delimiter }
  }

  const columns = Object.keys(records[0])
  const rows = isEuropean ? records.map(r => {
    const row = {}
    for (const [k, v] of Object.entries(r)) {
      row[k] = v.replace(/\./g, '').replace(',', '.')
    }
    return row
  }) : records

  return { columns, rows, row_count: rows.length, detected_delimiter: delimiter }
}

function parseJson(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON file')
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return { columns: [], rows: [], row_count: 0 }
    const columns = Object.keys(data[0])
    return { columns, rows: data, row_count: data.length }
  }

  if (data.products && Array.isArray(data.products)) {
    const columns = Object.keys(data.products[0] || {})
    return { columns, rows: data.products, row_count: data.products.length }
  }

  throw new Error('JSON must be an array or have a "products" key')
}

function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (rows.length === 0) return { columns: [], rows: [], row_count: 0, sheets: workbook.SheetNames }

  const columns = Object.keys(rows[0])
  return { columns, rows, row_count: rows.length, sheets: workbook.SheetNames }
}

function parseSqlite(buffer) {
  throw new Error('SQLite file parsing is not supported in Workers runtime. Use CSV or XLSX format instead.')
}

export function autoDetectMapping(columns) {
  const mapping = { barcode: '', name: '', price: '' }

  const lower = columns.map(c => c.toLowerCase())

  const bcIdx = lower.findIndex(c =>
    c === 'barcode' || c === 'code' || c === 'ean' || c === 'upc' ||
    c === 'cod_bar' || c === 'code_barre' || c === 'codigo'
  )
  if (bcIdx >= 0) mapping.barcode = columns[bcIdx]

  const nmIdx = lower.findIndex(c =>
    c === 'name' || c === 'product_name' || c === 'product' ||
    c === 'description' || c === 'nom' || c === 'nombre' || c === 'designation'
  )
  if (nmIdx >= 0) mapping.name = columns[nmIdx]

  const prIdx = lower.findIndex(c =>
    c === 'price' || c === 'prix' || c === 'precio' || c === 'cost' ||
    c === 'unit_price' || c === 'amount'
  )
  if (prIdx >= 0) mapping.price = columns[prIdx]

  return mapping
}
