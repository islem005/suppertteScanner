// ─── File Import Routes ──────────────────────────────────────────────
// Multi-format file upload, column mapping, preview, import.
// ────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { queryAll, queryOne, execute, uuid } from '../db.js'
import { authenticate, adminOnly } from '../middleware.js'
import { parseFile, autoDetectMapping } from '../parser.js'

const router = new Hono()

async function importProducts(db, storeId, rows, columnMapping) {
  const bcCol = columnMapping.barcode
  const nmCol = columnMapping.name
  const prCol = columnMapping.price
  if (!bcCol || !nmCol || !prCol) throw new Error('Incomplete mapping: barcode, name, and price columns required')

  const now = new Date().toISOString()
  let count = 0

  for (const r of rows) {
    const barcode = String(r[bcCol] || '').trim()
    const name = String(r[nmCol] || '').trim()
    if (!barcode || !name) continue

    const price = parseFloat(String(r[prCol] || '0').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0

    const existing = await queryOne(db,
      'SELECT id FROM product WHERE store_id = ? AND barcode = ?',
      [storeId, barcode]
    )

    if (existing) {
      await execute(db,
        'UPDATE product SET name = ?, price = ?, updated_at = ? WHERE id = ?',
        [name, price, now, existing.id]
      )
    } else {
      await execute(db,
        'INSERT INTO product (id, store_id, barcode, name, price, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid(), storeId, barcode, name, price, now]
      )
    }
    count++
  }

  return count
}

function applyMappingToRows(rows, columnMapping) {
  return rows.slice(0, 3).map(r => ({
    barcode: String(r[columnMapping.barcode] || ''),
    name: String(r[columnMapping.name] || ''),
    price: String(r[columnMapping.price] || '')
  }))
}

router.post('/upload', authenticate, async (c) => {
  const user = c.get('user')

  try {
    const { content, filename } = await c.req.json()
    if (!content || !filename) return c.json({ error: 'content (base64) and filename required' }, 400)

    const parsed = await parseFile(content, filename)
    if (parsed.row_count === 0) return c.json({ error: 'No data rows found in file' }, 400)

    const sampleRows = parsed.rows.slice(0, 3)
    const detectedColumns = parsed.columns

    const existingMapping = await queryOne(c.env.DB,
      'SELECT * FROM import_mapping WHERE store_id = ?', [user.store_id]
    )

    const fileType = filename.split('.').pop().toLowerCase()
    const extra = {}
    if (parsed.detected_delimiter) extra.detected_delimiter = parsed.detected_delimiter
    if (parsed.tables) extra.tables = parsed.tables
    if (parsed.sheets) extra.sheets = parsed.sheets

    // Create pending import record
    const pendingId = uuid()
    await execute(c.env.DB,
      `INSERT INTO pending_import (id, store_id, original_filename, file_type, raw_content,
       row_count, detected_columns, sample_rows, mapping_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pendingId, user.store_id, filename, fileType, content,
       parsed.row_count, JSON.stringify(detectedColumns), JSON.stringify(sampleRows),
       existingMapping?.id || null,
       existingMapping ? 'auto-mapped' : 'pending']
    )

    if (existingMapping) {
      const columnMapping = JSON.parse(existingMapping.column_mapping)
      const previewMapped = applyMappingToRows(parsed.rows, columnMapping)
      return c.json({
        id: pendingId, status: 'auto-mapped', requires_confirmation: true,
        preview: {
          columns: detectedColumns, sample_rows: sampleRows,
          mapped_preview: previewMapped, mapping_used: columnMapping,
          suggested_mapping: columnMapping
        },
        row_count: parsed.row_count
      })
    }

    const suggestedMapping = autoDetectMapping(detectedColumns)
    return c.json({
      id: pendingId, status: 'pending', requires_admin: true,
      preview: {
        columns: detectedColumns, sample_rows: sampleRows,
        row_count: parsed.row_count, suggested_mapping: suggestedMapping,
        ...extra
      }
    })
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

router.get('/pending', authenticate, adminOnly, async (c) => {
  const imports = await queryAll(c.env.DB,
    "SELECT * FROM pending_import WHERE status IN ('pending', 'auto-mapped') ORDER BY created_at DESC"
  )

  const stores = await queryAll(c.env.DB, 'SELECT id, name, slug FROM organization')
  const storeMap = {}
  for (const s of stores) storeMap[s.id] = s

  const result = imports.map(i => ({
    ...i,
    store_name: storeMap[i.store_id]?.name || 'Unknown',
    store_slug: storeMap[i.store_id]?.slug || ''
  }))

  return c.json(result)
})

router.get('/store/:storeId', authenticate, async (c) => {
  const user = c.get('user')
  const storeId = c.req.param('storeId')

  if (user.role !== 'admin' && user.store_id !== storeId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const [imports, mapping, productCountRow] = await Promise.all([
    queryAll(c.env.DB,
      'SELECT * FROM pending_import WHERE store_id = ? ORDER BY created_at DESC',
      [storeId]
    ),
    queryOne(c.env.DB,
      'SELECT * FROM import_mapping WHERE store_id = ?', [storeId]
    ),
    queryOne(c.env.DB,
      'SELECT COUNT(*) as count FROM product WHERE store_id = ?', [storeId]
    )
  ])

  return c.json({
    imports: imports || [],
    mapping: mapping || null,
    product_count: productCountRow?.count || 0
  })
})

router.get('/:id', authenticate, async (c) => {
  const user = c.get('user')
  const imp = await queryOne(c.env.DB,
    'SELECT * FROM pending_import WHERE id = ?', [c.req.param('id')]
  )

  if (!imp) return c.json({ error: 'Import not found' }, 404)
  if (user.role !== 'admin' && imp.store_id !== user.store_id) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  return c.json(imp)
})

router.get('/:id/preview', authenticate, async (c) => {
  const user = c.get('user')
  const imp = await queryOne(c.env.DB,
    'SELECT * FROM pending_import WHERE id = ?', [c.req.param('id')]
  )

  if (!imp) return c.json({ error: 'Import not found' }, 404)
  if (user.role !== 'admin' && imp.store_id !== user.store_id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  try {
    const parsed = await parseFile(imp.raw_content, imp.original_filename)
    const suggestedMapping = autoDetectMapping(parsed.columns)
    const extra = {}
    if (parsed.detected_delimiter) extra.detected_delimiter = parsed.detected_delimiter
    if (parsed.tables) extra.tables = parsed.tables
    if (parsed.sheets) extra.sheets = parsed.sheets

    return c.json({
      columns: parsed.columns,
      sample_rows: parsed.rows.slice(0, 8),
      row_count: parsed.row_count,
      suggested_mapping: suggestedMapping,
      ...extra
    })
  } catch (err) {
    return c.json({ error: 'Failed to re-parse file: ' + err.message }, 400)
  }
})

router.post('/:id/preview-mapped', authenticate, async (c) => {
  const user = c.get('user')
  const imp = await queryOne(c.env.DB,
    'SELECT * FROM pending_import WHERE id = ?', [c.req.param('id')]
  )

  if (!imp) return c.json({ error: 'Import not found' }, 404)
  if (user.role !== 'admin' && imp.store_id !== user.store_id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const mapping = await queryOne(c.env.DB,
    'SELECT * FROM import_mapping WHERE store_id = ?', [imp.store_id]
  )

  if (!mapping) return c.json({ error: 'No saved mapping for this store' }, 400)

  try {
    const parsed = await parseFile(imp.raw_content, imp.original_filename)
    const columnMapping = JSON.parse(mapping.column_mapping)
    const previewMapped = applyMappingToRows(parsed.rows, columnMapping)

    return c.json({
      mapping_used: columnMapping,
      mapped_preview: previewMapped,
      row_count: parsed.row_count,
      valid_count: parsed.rows.filter(r => r[columnMapping.barcode] && r[columnMapping.name]).length
    })
  } catch (err) {
    return c.json({ error: 'Failed to apply mapping: ' + err.message }, 400)
  }
})

router.post('/:id/confirm', authenticate, async (c) => {
  const user = c.get('user')
  const imp = await queryOne(c.env.DB,
    'SELECT * FROM pending_import WHERE id = ?', [c.req.param('id')]
  )

  if (!imp) return c.json({ error: 'Import not found' }, 404)
  if (imp.store_id !== user.store_id) return c.json({ error: 'Forbidden' }, 403)
  if (imp.status !== 'auto-mapped') return c.json({ error: `Cannot confirm import with status '${imp.status}'` }, 400)

  const mapping = await queryOne(c.env.DB,
    'SELECT * FROM import_mapping WHERE store_id = ?', [imp.store_id]
  )

  if (!mapping) return c.json({ error: 'No saved mapping for this store' }, 400)

  try {
    const parsed = await parseFile(imp.raw_content, imp.original_filename)
    const columnMapping = JSON.parse(mapping.column_mapping)
    const count = await importProducts(c.env.DB, imp.store_id, parsed.rows, columnMapping)

    await execute(c.env.DB,
      "UPDATE pending_import SET status = 'imported', imported_at = ? WHERE id = ?",
      [new Date().toISOString(), imp.id]
    )

    return c.json({ imported: count, status: 'imported' })
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

router.post('/:id/map', authenticate, adminOnly, async (c) => {
  const { column_mapping, parser_options } = await c.req.json()

  if (!column_mapping || !column_mapping.barcode || !column_mapping.name || !column_mapping.price) {
    return c.json({ error: 'column_mapping with barcode, name, and price required' }, 400)
  }

  const imp = await queryOne(c.env.DB,
    'SELECT * FROM pending_import WHERE id = ?', [c.req.param('id')]
  )

  if (!imp) return c.json({ error: 'Import not found' }, 404)

  try {
    const existingMapping = await queryOne(c.env.DB,
      'SELECT id FROM import_mapping WHERE store_id = ?', [imp.store_id]
    )

    let mappingId
    const now = new Date().toISOString()

    if (existingMapping) {
      await execute(c.env.DB,
        'UPDATE import_mapping SET column_mapping = ?, parser_options = ?, is_verified = 1, updated_at = ? WHERE id = ?',
        [JSON.stringify(column_mapping), parser_options ? JSON.stringify(parser_options) : null, now, existingMapping.id]
      )
      mappingId = existingMapping.id
    } else {
      mappingId = uuid()
      await execute(c.env.DB,
        'INSERT INTO import_mapping (id, store_id, column_mapping, parser_options, is_verified) VALUES (?, ?, ?, ?, 1)',
        [mappingId, imp.store_id, JSON.stringify(column_mapping), parser_options ? JSON.stringify(parser_options) : null]
      )
    }

    const parsed = await parseFile(imp.raw_content, imp.original_filename)
    const count = await importProducts(c.env.DB, imp.store_id, parsed.rows, column_mapping)

    await execute(c.env.DB,
      "UPDATE pending_import SET status = 'imported', mapping_id = ?, imported_at = ? WHERE id = ?",
      [mappingId, now, imp.id]
    )

    return c.json({ imported: count, status: 'imported', mapping_id: mappingId })
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

router.post('/:id/re-map', authenticate, adminOnly, async (c) => {
  const { column_mapping, parser_options } = await c.req.json()

  if (!column_mapping || !column_mapping.barcode || !column_mapping.name || !column_mapping.price) {
    return c.json({ error: 'column_mapping with barcode, name, and price required' }, 400)
  }

  const imp = await queryOne(c.env.DB,
    'SELECT * FROM pending_import WHERE id = ?', [c.req.param('id')]
  )

  if (!imp) return c.json({ error: 'Import not found' }, 404)

  try {
    const existingMapping = await queryOne(c.env.DB,
      'SELECT id FROM import_mapping WHERE store_id = ?', [imp.store_id]
    )

    let mappingId
    const now = new Date().toISOString()

    if (existingMapping) {
      await execute(c.env.DB,
        'UPDATE import_mapping SET column_mapping = ?, parser_options = ?, is_verified = 1, updated_at = ? WHERE id = ?',
        [JSON.stringify(column_mapping), parser_options ? JSON.stringify(parser_options) : null, now, existingMapping.id]
      )
      mappingId = existingMapping.id
    } else {
      mappingId = uuid()
      await execute(c.env.DB,
        'INSERT INTO import_mapping (id, store_id, column_mapping, parser_options, is_verified) VALUES (?, ?, ?, ?, 1)',
        [mappingId, imp.store_id, JSON.stringify(column_mapping), parser_options ? JSON.stringify(parser_options) : null]
      )
    }

    const parsed = await parseFile(imp.raw_content, imp.original_filename)
    const count = await importProducts(c.env.DB, imp.store_id, parsed.rows, column_mapping)

    await execute(c.env.DB,
      "UPDATE pending_import SET status = 'imported', mapping_id = ?, imported_at = ? WHERE id = ?",
      [mappingId, now, imp.id]
    )

    return c.json({ imported: count, status: 'imported', mapping_id: mappingId })
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

router.post('/:id/test', authenticate, adminOnly, async (c) => {
  const { column_mapping } = await c.req.json()
  if (!column_mapping) return c.json({ error: 'column_mapping required' }, 400)

  const imp = await queryOne(c.env.DB,
    'SELECT * FROM pending_import WHERE id = ?', [c.req.param('id')]
  )

  if (!imp) return c.json({ error: 'Import not found' }, 404)

  try {
    const parsed = await parseFile(imp.raw_content, imp.original_filename)
    const bcCol = column_mapping.barcode
    const nmCol = column_mapping.name
    const prCol = column_mapping.price

    const preview = parsed.rows.slice(0, 3).map(r => ({
      barcode: String(r[bcCol] || ''),
      name: String(r[nmCol] || ''),
      price: String(r[prCol] || '')
    }))

    const validCount = parsed.rows.filter(r => r[bcCol] && r[nmCol]).length

    return c.json({
      success: true, preview,
      total_rows: parsed.row_count,
      valid_rows: validCount,
      invalid_rows: parsed.row_count - validCount,
      mapping_applied: column_mapping
    })
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

router.post('/:id/verify', authenticate, adminOnly, async (c) => {
  const imp = await queryOne(c.env.DB,
    'SELECT * FROM pending_import WHERE id = ?', [c.req.param('id')]
  )

  if (!imp) return c.json({ error: 'Import not found' }, 404)
  if (imp.status !== 'auto-mapped' && imp.status !== 'imported') {
    return c.json({ error: `Cannot verify import with status '${imp.status}'` }, 400)
  }

  await execute(c.env.DB,
    'UPDATE import_mapping SET is_verified = 1, updated_at = ? WHERE store_id = ?',
    [new Date().toISOString(), imp.store_id]
  )

  return c.json({ ok: true, status: 'verified' })
})

router.post('/:id/reject', authenticate, adminOnly, async (c) => {
  const imp = await queryOne(c.env.DB,
    'SELECT * FROM pending_import WHERE id = ?', [c.req.param('id')]
  )

  if (!imp) return c.json({ error: 'Import not found' }, 404)

  await execute(c.env.DB,
    "UPDATE pending_import SET status = 'rejected' WHERE id = ?",
    [imp.id]
  )

  return c.json({ ok: true, status: 'rejected' })
})

router.get('/mapping/:storeId', authenticate, async (c) => {
  const user = c.get('user')
  const storeId = c.req.param('storeId')

  if (user.role !== 'admin' && user.store_id !== storeId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const mapping = await queryOne(c.env.DB,
    'SELECT * FROM import_mapping WHERE store_id = ?', [storeId]
  )

  if (mapping) {
    mapping.column_mapping = JSON.parse(mapping.column_mapping)
    if (mapping.parser_options) mapping.parser_options = JSON.parse(mapping.parser_options)
  }

  return c.json(mapping || null)
})

router.post('/mapping/:storeId', authenticate, adminOnly, async (c) => {
  const storeId = c.req.param('storeId')
  const { column_mapping, parser_options } = await c.req.json()

  if (!column_mapping) return c.json({ error: 'column_mapping required' }, 400)

  const existing = await queryOne(c.env.DB,
    'SELECT id FROM import_mapping WHERE store_id = ?', [storeId]
  )

  const now = new Date().toISOString()

  if (existing) {
    await execute(c.env.DB,
      'UPDATE import_mapping SET column_mapping = ?, parser_options = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(column_mapping), parser_options ? JSON.stringify(parser_options) : null, now, existing.id]
    )
  } else {
    await execute(c.env.DB,
      'INSERT INTO import_mapping (id, store_id, column_mapping, parser_options, is_verified) VALUES (?, ?, ?, ?, 0)',
      [uuid(), storeId, JSON.stringify(column_mapping), parser_options ? JSON.stringify(parser_options) : null]
    )
  }

  const saved = await queryOne(c.env.DB,
    'SELECT * FROM import_mapping WHERE store_id = ?', [storeId]
  )

  if (saved) {
    saved.column_mapping = JSON.parse(saved.column_mapping)
    if (saved.parser_options) saved.parser_options = JSON.parse(saved.parser_options)
  }

  return c.json(saved)
})

router.delete('/mapping/:storeId', authenticate, adminOnly, async (c) => {
  await execute(c.env.DB,
    'DELETE FROM import_mapping WHERE store_id = ?',
    [c.req.param('storeId')]
  )
  return c.json({ ok: true })
})

export { router as importsRouter }
