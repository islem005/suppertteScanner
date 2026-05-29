import { Router } from 'express'
import { supabase } from './db.js'
import { authenticate } from './middleware.js'
import { parseFile, autoDetectMapping } from './parser.js'

const router = Router()

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  next()
}

// Helper: upsert products from parsed rows using a mapping
async function importProducts(storeId, rows, columnMapping) {
  const bcCol = columnMapping.barcode
  const nmCol = columnMapping.name
  const prCol = columnMapping.price
  if (!bcCol || !nmCol || !prCol) throw new Error('Incomplete mapping: barcode, name, and price columns required')

  const products = rows.map(r => ({
    store_id: storeId,
    barcode: String(r[bcCol] || '').trim(),
    name: String(r[nmCol] || '').trim(),
    price: parseFloat(String(r[prCol] || '0').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
    updated_at: new Date().toISOString()
  })).filter(p => p.barcode && p.name)

  if (products.length === 0) throw new Error('No valid products found after applying mapping')

  const { data, error } = await supabase
    .from('products')
    .upsert(products, { onConflict: 'store_id,barcode' })
    .select()

  if (error) throw new Error(error.message)
  return data.length
}

// Helper: apply column mapping to rows and return preview
function applyMappingToRows(rows, columnMapping) {
  return rows.slice(0, 3).map(r => ({
    barcode: String(r[columnMapping.barcode] || ''),
    name: String(r[columnMapping.name] || ''),
    price: String(r[columnMapping.price] || '')
  }))
}

// ──────────────────────────────────────────────
//  UPLOAD — store uploads a file
// ──────────────────────────────────────────────
router.post('/upload', authenticate, async (req, res) => {
  try {
    const { content, filename } = req.body
    if (!content || !filename) return res.status(400).json({ error: 'content (base64) and filename required' })

    const parsed = parseFile(content, filename)
    if (parsed.row_count === 0) return res.status(400).json({ error: 'No data rows found in file' })

    const sampleRows = parsed.rows.slice(0, 3)
    const detectedColumns = parsed.columns

    // Check for existing mapping
    const { data: existingMapping } = await supabase
      .from('import_mappings')
      .select('*')
      .eq('store_id', req.user.store_id)
      .single()

    const fileType = filename.split('.').pop().toLowerCase()

    // Build extra info
    const extra = {}
    if (parsed.detected_delimiter) extra.detected_delimiter = parsed.detected_delimiter
    if (parsed.tables) extra.tables = parsed.tables
    if (parsed.sheets) extra.sheets = parsed.sheets

    const { data: pending } = await supabase
      .from('pending_imports')
      .insert({
        store_id: req.user.store_id,
        original_filename: filename,
        file_type: fileType,
        raw_content: content,
        row_count: parsed.row_count,
        detected_columns: JSON.stringify(detectedColumns),
        sample_rows: JSON.stringify(sampleRows),
        mapping_id: existingMapping ? existingMapping.id : null,
        status: existingMapping ? 'auto-mapped' : 'pending'
      })
      .select()
      .single()

    if (existingMapping) {
      const columnMapping = JSON.parse(existingMapping.column_mapping)
      const previewMapped = applyMappingToRows(parsed.rows, columnMapping)
      return res.json({
        id: pending.id,
        status: 'auto-mapped',
        requires_confirmation: true,
        preview: {
          columns: detectedColumns,
          sample_rows: sampleRows,
          mapped_preview: previewMapped,
          mapping_used: columnMapping,
          suggested_mapping: columnMapping
        },
        row_count: parsed.row_count
      })
    }

    const suggestedMapping = autoDetectMapping(detectedColumns)
    res.json({
      id: pending.id,
      status: 'pending',
      requires_admin: true,
      preview: {
        columns: detectedColumns,
        sample_rows: sampleRows,
        row_count: parsed.row_count,
        suggested_mapping: suggestedMapping,
        ...extra
      }
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ──────────────────────────────────────────────
//  PENDING LIST — admin views all pending
// ──────────────────────────────────────────────
router.get('/pending', authenticate, adminOnly, async (req, res) => {
  const { data: imports } = await supabase
    .from('pending_imports')
    .select('*')
    .in('status', ['pending', 'auto-mapped'])
    .order('created_at', 'DESC')

  const { data: stores } = await supabase.from('stores').select('id, name, slug')
  const storeMap = {}
  if (stores) for (const s of stores) storeMap[s.id] = s

  const result = (imports || []).map(i => ({
    ...i,
    store_name: storeMap[i.store_id]?.name || 'Unknown',
    store_slug: storeMap[i.store_id]?.slug || ''
  }))

  res.json(result)
})

// ──────────────────────────────────────────────
//  STORE IMPORTS — history + status for a store
// ──────────────────────────────────────────────
router.get('/store/:storeId', authenticate, async (req, res) => {
  const storeId = req.params.storeId
  if (req.user.role !== 'admin' && req.user.store_id !== storeId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data: imports } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', 'DESC')

  const { data: mapping } = await supabase
    .from('import_mappings')
    .select('*')
    .eq('store_id', storeId)
    .single()

  const { data: productData, count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)

  res.json({
    imports: imports || [],
    mapping: mapping || null,
    product_count: productCount || productData?.length || 0
  })
})

// ──────────────────────────────────────────────
//  GET SINGLE IMPORT
// ──────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  const { data: imp, error } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Import not found' })
  if (req.user.role !== 'admin' && imp.store_id !== req.user.store_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  res.json(imp)
})

// ──────────────────────────────────────────────
//  PREVIEW — re-parse and show raw file content
// ──────────────────────────────────────────────
router.get('/:id/preview', authenticate, async (req, res) => {
  const { data: imp, error } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Import not found' })
  if (req.user.role !== 'admin' && imp.store_id !== req.user.store_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const parsed = parseFile(imp.raw_content, imp.original_filename)
    const suggestedMapping = autoDetectMapping(parsed.columns)
    const extra = {}
    if (parsed.detected_delimiter) extra.detected_delimiter = parsed.detected_delimiter
    if (parsed.tables) extra.tables = parsed.tables
    if (parsed.sheets) extra.sheets = parsed.sheets

    res.json({
      columns: parsed.columns,
      sample_rows: parsed.rows.slice(0, 8),
      row_count: parsed.row_count,
      suggested_mapping: suggestedMapping,
      ...extra
    })
  } catch (err) {
    res.status(400).json({ error: 'Failed to re-parse file: ' + err.message })
  }
})

// ──────────────────────────────────────────────
//  PREVIEW MAPPED — apply saved mapping, return preview
// ──────────────────────────────────────────────
router.post('/:id/preview-mapped', authenticate, async (req, res) => {
  const { data: imp, error } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Import not found' })
  if (req.user.role !== 'admin' && imp.store_id !== req.user.store_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data: mapping } = await supabase
    .from('import_mappings')
    .select('*')
    .eq('store_id', imp.store_id)
    .single()
  if (!mapping) return res.status(400).json({ error: 'No saved mapping for this store' })

  try {
    const parsed = parseFile(imp.raw_content, imp.original_filename)
    const columnMapping = JSON.parse(mapping.column_mapping)
    const previewMapped = applyMappingToRows(parsed.rows, columnMapping)

    res.json({
      mapping_used: columnMapping,
      mapped_preview: previewMapped,
      row_count: parsed.row_count,
      valid_count: parsed.rows.filter(r => r[columnMapping.barcode] && r[columnMapping.name]).length
    })
  } catch (err) {
    res.status(400).json({ error: 'Failed to apply mapping: ' + err.message })
  }
})

// ──────────────────────────────────────────────
//  CONFIRM — store confirms auto-mapped import
// ──────────────────────────────────────────────
router.post('/:id/confirm', authenticate, async (req, res) => {
  const { data: imp, error } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Import not found' })
  if (imp.store_id !== req.user.store_id) return res.status(403).json({ error: 'Forbidden' })
  if (imp.status !== 'auto-mapped') return res.status(400).json({ error: `Cannot confirm import with status '${imp.status}'` })

  const { data: mapping } = await supabase
    .from('import_mappings')
    .select('*')
    .eq('store_id', imp.store_id)
    .single()
  if (!mapping) return res.status(400).json({ error: 'No saved mapping for this store' })

  try {
    const parsed = parseFile(imp.raw_content, imp.original_filename)
    const columnMapping = JSON.parse(mapping.column_mapping)
    const count = await importProducts(imp.store_id, parsed.rows, columnMapping)

    await supabase.from('pending_imports').update({
      status: 'imported',
      imported_at: new Date().toISOString()
    }).eq('id', imp.id)

    res.json({ imported: count, status: 'imported' })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ──────────────────────────────────────────────
//  MAP — admin creates mapping + imports
// ──────────────────────────────────────────────
router.post('/:id/map', authenticate, adminOnly, async (req, res) => {
  const { column_mapping, parser_options } = req.body
  if (!column_mapping || !column_mapping.barcode || !column_mapping.name || !column_mapping.price) {
    return res.status(400).json({ error: 'column_mapping with barcode, name, and price required' })
  }

  const { data: imp, error } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Import not found' })

  try {
    // Save or update mapping
    const { data: existingMapping } = await supabase
      .from('import_mappings')
      .select('id')
      .eq('store_id', imp.store_id)
      .single()

    let mappingId
    if (existingMapping) {
      await supabase.from('import_mappings').update({
        column_mapping: JSON.stringify(column_mapping),
        parser_options: parser_options ? JSON.stringify(parser_options) : null,
        is_verified: 1,
        updated_at: new Date().toISOString()
      }).eq('id', existingMapping.id)
      mappingId = existingMapping.id
    } else {
      const { data: newMapping } = await supabase
        .from('import_mappings')
        .insert({
          store_id: imp.store_id,
          column_mapping: JSON.stringify(column_mapping),
          parser_options: parser_options ? JSON.stringify(parser_options) : null,
          is_verified: 1
        })
        .select()
        .single()
      mappingId = newMapping.id
    }

    // Parse and import
    const parsed = parseFile(imp.raw_content, imp.original_filename)
    const count = await importProducts(imp.store_id, parsed.rows, column_mapping)

    await supabase.from('pending_imports').update({
      status: 'imported',
      mapping_id: mappingId,
      imported_at: new Date().toISOString()
    }).eq('id', imp.id)

    res.json({ imported: count, status: 'imported', mapping_id: mappingId })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ──────────────────────────────────────────────
//  RE-MAP — admin updates mapping + re-imports
// ──────────────────────────────────────────────
router.post('/:id/re-map', authenticate, adminOnly, async (req, res) => {
  const { column_mapping, parser_options } = req.body
  if (!column_mapping || !column_mapping.barcode || !column_mapping.name || !column_mapping.price) {
    return res.status(400).json({ error: 'column_mapping with barcode, name, and price required' })
  }

  const { data: imp, error } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Import not found' })

  try {
    const { data: existingMapping } = await supabase
      .from('import_mappings')
      .select('id')
      .eq('store_id', imp.store_id)
      .single()

    let mappingId
    if (existingMapping) {
      await supabase.from('import_mappings').update({
        column_mapping: JSON.stringify(column_mapping),
        parser_options: parser_options ? JSON.stringify(parser_options) : null,
        is_verified: 1,
        updated_at: new Date().toISOString()
      }).eq('id', existingMapping.id)
      mappingId = existingMapping.id
    } else {
      const { data: newMapping } = await supabase
        .from('import_mappings')
        .insert({
          store_id: imp.store_id,
          column_mapping: JSON.stringify(column_mapping),
          parser_options: parser_options ? JSON.stringify(parser_options) : null,
          is_verified: 1
        })
        .select()
        .single()
      mappingId = newMapping.id
    }

    const parsed = parseFile(imp.raw_content, imp.original_filename)
    const count = await importProducts(imp.store_id, parsed.rows, column_mapping)

    await supabase.from('pending_imports').update({
      status: 'imported',
      mapping_id: mappingId,
      imported_at: new Date().toISOString()
    }).eq('id', imp.id)

    res.json({ imported: count, status: 'imported', mapping_id: mappingId })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ──────────────────────────────────────────────
//  TEST — apply mapping to preview (no upsert)
// ──────────────────────────────────────────────
router.post('/:id/test', authenticate, adminOnly, async (req, res) => {
  const { column_mapping } = req.body
  if (!column_mapping) return res.status(400).json({ error: 'column_mapping required' })

  const { data: imp } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (!imp) return res.status(404).json({ error: 'Import not found' })

  try {
    const parsed = parseFile(imp.raw_content, imp.original_filename)
    const bcCol = column_mapping.barcode
    const nmCol = column_mapping.name
    const prCol = column_mapping.price

    const preview = parsed.rows.slice(0, 3).map(r => ({
      barcode: String(r[bcCol] || ''),
      name: String(r[nmCol] || ''),
      price: String(r[prCol] || '')
    }))

    const validCount = parsed.rows.filter(r => r[bcCol] && r[nmCol]).length

    res.json({
      success: true,
      preview,
      total_rows: parsed.row_count,
      valid_rows: validCount,
      invalid_rows: parsed.row_count - validCount,
      mapping_applied: column_mapping
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ──────────────────────────────────────────────
//  VERIFY — admin confirms auto-mapped import
// ──────────────────────────────────────────────
router.post('/:id/verify', authenticate, adminOnly, async (req, res) => {
  const { data: imp, error } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Import not found' })
  if (imp.status !== 'auto-mapped' && imp.status !== 'imported') {
    return res.status(400).json({ error: `Cannot verify import with status '${imp.status}'` })
  }

  await supabase.from('import_mappings').update({
    is_verified: 1,
    updated_at: new Date().toISOString()
  }).eq('store_id', imp.store_id)

  res.json({ ok: true, status: 'verified' })
})

// ──────────────────────────────────────────────
//  REJECT — admin rejects pending import
// ──────────────────────────────────────────────
router.post('/:id/reject', authenticate, adminOnly, async (req, res) => {
  const { data: imp, error } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Import not found' })

  await supabase.from('pending_imports').update({ status: 'rejected' }).eq('id', imp.id)
  res.json({ ok: true, status: 'rejected' })
})

// ──────────────────────────────────────────────
//  GET MAPPING — get mapping for a store
// ──────────────────────────────────────────────
router.get('/mapping/:storeId', authenticate, async (req, res) => {
  const storeId = req.params.storeId
  if (req.user.role !== 'admin' && req.user.store_id !== storeId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data: mapping } = await supabase
    .from('import_mappings')
    .select('*')
    .eq('store_id', storeId)
    .single()

  if (mapping) {
    mapping.column_mapping = JSON.parse(mapping.column_mapping)
    if (mapping.parser_options) mapping.parser_options = JSON.parse(mapping.parser_options)
  }

  res.json(mapping || null)
})

// ──────────────────────────────────────────────
//  SAVE MAPPING — save mapping only (no import)
// ──────────────────────────────────────────────
router.post('/mapping/:storeId', authenticate, adminOnly, async (req, res) => {
  const storeId = req.params.storeId
  const { column_mapping, parser_options } = req.body
  if (!column_mapping) return res.status(400).json({ error: 'column_mapping required' })

  const { data: existing } = await supabase
    .from('import_mappings')
    .select('id')
    .eq('store_id', storeId)
    .single()

  if (existing) {
    await supabase.from('import_mappings').update({
      column_mapping: JSON.stringify(column_mapping),
      parser_options: parser_options ? JSON.stringify(parser_options) : null,
      updated_at: new Date().toISOString()
    }).eq('id', existing.id)
  } else {
    await supabase.from('import_mappings').insert({
      store_id: storeId,
      column_mapping: JSON.stringify(column_mapping),
      parser_options: parser_options ? JSON.stringify(parser_options) : null,
      is_verified: 0
    }).select().single()
  }

  const { data: saved } = await supabase
    .from('import_mappings')
    .select('*')
    .eq('store_id', storeId)
    .single()

  if (saved) { saved.column_mapping = JSON.parse(saved.column_mapping); if (saved.parser_options) saved.parser_options = JSON.parse(saved.parser_options) }
  res.json(saved)
})

// ──────────────────────────────────────────────
//  DELETE MAPPING — remove mapping
// ──────────────────────────────────────────────
router.delete('/mapping/:storeId', authenticate, adminOnly, async (req, res) => {
  await supabase.from('import_mappings').delete().eq('store_id', req.params.storeId)
  res.json({ ok: true })
})

export { router as importsRouter }
