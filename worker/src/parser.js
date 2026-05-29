import { parse } from 'csv-parse/sync'
import XLSX from 'xlsx'
import Database from 'better-sqlite3'
import { tmpdir } from 'os'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

export function parseFile(content, filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const raw = Buffer.from(content, 'base64')
  switch (ext) {
    case 'csv': return parseCSV(raw)
    case 'xlsx':
    case 'xls': return parseXLSX(raw)
    case 'db':
    case 'sqlite':
    case 'sqlite3': return parseSQLite(raw)
    case 'json': return parseJSON(raw)
    default: throw new Error(`Unsupported file type: .${ext}`)
  }
}

function detectDelimiter(raw) {
  const text = raw.toString('utf-8')
  const firstLine = text.split('\n')[0]
  const delimiters = [',', ';', '\t', '|']
  let best = ',', bestCount = 0
  for (const d of delimiters) {
    const count = firstLine.split(d).length
    if (count > bestCount) { bestCount = count; best = d }
  }
  return best
}

function parseCSV(raw) {
  const text = raw.toString('utf-8')
  const delimiter = detectDelimiter(raw)
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true, delimiter })
  const columns = records.length > 0 ? Object.keys(records[0]) : []
  return { columns, rows: records, row_count: records.length, detected_delimiter: delimiter }
}

function parseXLSX(raw) {
  const wb = XLSX.read(raw, { type: 'buffer' })
  const sheets = wb.SheetNames
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]], { defval: '' })
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  return { columns, rows, row_count: rows.length, sheets }
}

function parseSQLite(raw) {
  const tmpPath = join(tmpdir(), `upload-${randomBytes(8).toString('hex')}.db`)
  writeFileSync(tmpPath, raw)
  const db = new Database(tmpPath)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
  if (tables.length === 0) { db.close(); unlinkSync(tmpPath); throw new Error('No tables found') }
  const rows = db.prepare(`SELECT * FROM "${tables[0]}"`).all()
  db.close()
  unlinkSync(tmpPath)
  const columns = rows.length > 0 ? Object.keys(rows[0]).filter(k => k !== 'rowid') : []
  return { columns, rows, row_count: rows.length, tables }
}

function parseJSON(raw) {
  const text = raw.toString('utf-8')
  const data = JSON.parse(text)
  const arr = Array.isArray(data)
    ? data
    : data.data || data.items || data.products || (typeof Object.values(data)[0] === 'object' ? Object.values(data)[0] : null)
  if (!Array.isArray(arr)) throw new Error('JSON must contain an array at root or under data/items/products key')
  const columns = arr.length > 0 ? Object.keys(arr[0]) : []
  return { columns, rows: arr, row_count: arr.length }
}

export function autoDetectMapping(columns) {
  const lower = columns.map(c => c.toLowerCase().trim())
  let barcodeIdx = -1, nameIdx = -1, priceIdx = -1

  const barcodePatterns = ['barcode', 'code', 'ean', 'upc', 'sku', 'cod_bar', 'codbar', 'barcode_ean', 'ean13', 'ean_13', 'gtin', 'reference', 'ref']
  const namePatterns = ['name', 'product', 'title', 'description', 'nom', 'designation', 'product_name', 'item', 'label', 'libelle', 'productname', 'produit']
  const pricePatterns = ['price', 'prix', 'cost', 'amount', 'value', 'prix_vente', 'prixvente', 'selling_price', 'sale_price', 'unit_price', 'tarif', 'montant']

  barcodeIdx = lower.findIndex(c => barcodePatterns.some(p => c === p || c.startsWith(p + '_') || c.startsWith(p + ' ') || c.replace(/[^a-z0-9]/g, '') === p))
  nameIdx = lower.findIndex(c => namePatterns.some(p => c === p || c.startsWith(p + '_') || c.startsWith(p + ' ') || c.replace(/[^a-z0-9]/g, '') === p))
  priceIdx = lower.findIndex(c => pricePatterns.some(p => c === p || c.startsWith(p + '_') || c.startsWith(p + ' ') || c.replace(/[^a-z0-9]/g, '') === p))

  return {
    barcode: barcodeIdx >= 0 ? columns[barcodeIdx] : (columns[0] || ''),
    name: nameIdx >= 0 ? columns[nameIdx] : (columns[1] || columns[0] || ''),
    price: priceIdx >= 0 ? columns[priceIdx] : (columns[2] || columns[0] || '')
  }
}
