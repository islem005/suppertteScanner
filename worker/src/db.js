import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY

// Use SQLite by default (no env vars or local/dev URLs).
// Set SUPABASE_URL to a real supabase.co project for production.
const useSupabase = SUPABASE_URL && SUPABASE_KEY &&
  (SUPABASE_URL.includes('supabase.co') || process.env.USE_SUPABASE === 'true')

let supabase

if (useSupabase) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
} else {
  const Database = (await import('better-sqlite3')).default
  supabase = createSqliteClient(Database)
}

export { supabase }

function createSqliteClient(Database) {
  const db = new Database('scanner.db')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    create table if not exists stores (
      id text primary key default (lower(hex(randomblob(16)))),
      name text not null,
      slug text unique not null,
      created_at text default (datetime('now'))
    );
    create table if not exists store_users (
      id text primary key default (lower(hex(randomblob(16)))),
      email text unique not null,
      password_hash text not null,
      display_name text not null,
      store_id text references stores(id) on delete cascade,
      role text not null check (role in ('admin','manager','staff')) default 'staff',
      created_at text default (datetime('now'))
    );
    create table if not exists products (
      id text primary key default (lower(hex(randomblob(16)))),
      store_id text not null references stores(id) on delete cascade,
      barcode text not null,
      name text not null,
      price real not null,
      category text,
      created_at text default (datetime('now')),
      updated_at text default (datetime('now')),
      unique(store_id, barcode)
    );
    create table if not exists scan_events (
      id text primary key default (lower(hex(randomblob(16)))),
      store_id text not null references stores(id) on delete cascade,
      product_id text references products(id) on delete set null,
      barcode text not null,
      scanned_at text default (datetime('now'))
    );
    create index if not exists idx_products_store_barcode on products(store_id, barcode);
    create index if not exists idx_scan_events_store on scan_events(store_id);
    create index if not exists idx_scan_events_scanned_at on scan_events(scanned_at);
    create table if not exists store_branding (
      store_id text primary key references stores(id) on delete cascade,
      logo_url text,
      primary_color text default '#00c8ff',
      accent_color text default '#00c875',
      display_name text,
      contact_email text,
      contact_phone text,
      footer_text text,
      instagram_url text,
      tiktok_url text,
      website_url text
    );
    create table if not exists import_mappings (
      id text primary key default (lower(hex(randomblob(16)))),
      store_id text not null references stores(id) on delete cascade,
      column_mapping text not null,
      parser_options text,
      is_verified integer default 0,
      created_at text default (datetime('now')),
      updated_at text default (datetime('now')),
      unique(store_id)
    );
    create table if not exists pending_imports (
      id text primary key default (lower(hex(randomblob(16)))),
      store_id text not null references stores(id) on delete cascade,
      original_filename text not null,
      file_type text not null,
      raw_content text not null,
      row_count integer default 0,
      detected_columns text,
      sample_rows text,
      mapping_id text references import_mappings(id) on delete set null,
      status text not null default 'pending',
      created_at text default (datetime('now')),
      imported_at text
    );
  `)

  function rowToObj(row) {
    if (!row) return null
    const obj = {}
    const keys = Object.keys(row)
    for (let i = 0; i < keys.length; i++) {
      obj[keys[i]] = row[keys[i]]
    }
    return obj
  }

  class QueryBuilder {
    constructor(table) {
      this._table = table
      this._selectCols = '*'
      this._filters = []
      this._orderCol = null
      this._orderDir = 'ASC'
      this._single = false
      this._count = false
      this._head = false
      this._insertData = null
      this._upsertData = null
      this._upsertConflict = null
      this._deleteMode = false
      this._updateData = null
      this._gteFilters = []
    }

    select(cols, opts) {
      this._selectCols = cols || '*'
      if (opts) {
        if (opts.count === 'exact') this._count = true
        if (opts.head) this._head = true
      }
      return this
    }

    eq(col, val) {
      this._filters.push({ op: '=', col, val })
      return this
    }

    in(col, vals) {
      this._filters.push({ op: 'IN', col, val: vals })
      return this
    }

    gte(col, val) {
      this._gteFilters.push({ col, val })
      return this
    }

    order(col, dir) {
      this._orderCol = col
      this._orderDir = dir || 'ASC'
      return this
    }

    single() {
      this._single = true
      return this
    }

    insert(data) {
      this._insertData = data
      this._returning = true
      return this
    }

    upsert(data, opts) {
      this._upsertData = data
      this._upsertConflict = opts?.onConflict || ''
      this._returning = true
      return this
    }

    update(data) {
      this._updateData = data
      return this
    }

    delete() {
      this._deleteMode = true
      return this
    }

    then(resolve) {
      try {
        resolve(this._execute())
      } catch (e) {
        resolve({ data: null, error: { message: e.message || String(e) } })
      }
    }

    _execute() {
      if (this._deleteMode) return this._doDelete()
      if (this._updateData) return this._doUpdate()
      if (this._upsertData) return this._doUpsert()
      if (this._insertData) return this._doInsert()
      return this._doSelect()
    }

    _buildWhere() {
      const clauses = []
      const params = []
      for (const f of this._filters) {
        if (f.op === 'IN') {
          const placeholders = Array.isArray(f.val) ? f.val.map(() => '?').join(',') : '?'
          clauses.push(`${this._quote(f.col)} IN (${placeholders})`)
          if (Array.isArray(f.val)) params.push(...f.val)
          else params.push(f.val)
        } else {
          clauses.push(`${this._quote(f.col)} ${f.op} ?`)
          params.push(f.val)
        }
      }
      for (const f of this._gteFilters) {
        clauses.push(`${this._quote(f.col)} >= ?`)
        params.push(f.val)
      }
      return { clause: clauses.length ? 'where ' + clauses.join(' and ') : '', params }
    }

    _quote(col) {
      if (col.includes('(') || col === '*') return col
      return `"${col}"`
    }

    _doSelect() {
      let sql = `select ${this._selectCols} from "${this._table}"`
      const { clause, params } = this._buildWhere()
      sql += ' ' + clause

      if (this._orderCol) {
        sql += ` order by "${this._orderCol}" ${this._orderDir}`
      }
      if (this._single) {
        sql += ' limit 1'
      }

      const stmt = db.prepare(sql)
      const rows = this._single ? stmt.get(...params) : stmt.all(...params)

      if (this._count) {
        return { data: null, count: rows ? (Array.isArray(rows) ? rows.length : 1) : 0, error: null }
      }
      if (this._head) {
        return { data: null, error: null }
      }

      if (this._single) {
        const row = rowToObj(rows)
        return { data: row || null, error: row ? null : { message: 'No rows found' } }
      }

      return { data: (rows || []).map(rowToObj), error: null }
    }

    _doInsert() {
      const data = this._insertData
      const items = Array.isArray(data) ? data : [data]
      const results = []

      const insertStmt = db.prepare(
        `insert into "${this._table}" (${Object.keys(items[0]).map(k => `"${k}"`).join(',')}) values (${Object.keys(items[0]).map(() => '?').join(',')})`
      )

      const selectStmt = db.prepare(
        `select ${this._selectCols || '*'} from "${this._table}" where rowid = ?`
      )

      const insertMany = db.transaction((rows) => {
        for (const row of rows) {
          const vals = Object.values(row)
          const info = insertStmt.run(...vals)
          const inserted = selectStmt.get(info.lastInsertRowid)
          results.push(rowToObj(inserted))
        }
      })

      insertMany(items)

      return { data: this._single ? results[0] : results, error: null }
    }

    _doUpsert() {
      const data = this._upsertData
      const items = Array.isArray(data) ? data : [data]
      const conflictCols = this._upsertConflict ? this._upsertConflict.split(',') : []
      const results = []

      for (const item of items) {
        const existing = conflictCols.length > 0
          ? this._findExisting(item, conflictCols)
          : null

        if (existing) {
          const conflictSet = new Set(conflictCols.map(c => c.trim()))
          const sets = Object.keys(item).filter(k => !conflictSet.has(k))
            .map(k => `"${k}" = ?`).join(',')
          const vals = Object.keys(item).filter(k => !conflictSet.has(k))
            .map(k => item[k])
          const whereClauses = conflictCols.map(c => `"${c.trim()}" = ?`).join(' and ')
          const whereVals = conflictCols.map(c => existing[c.trim()])
          const stmt = db.prepare(
            `update "${this._table}" set ${sets} where ${whereClauses}`
          )
          stmt.run(...vals, ...whereVals)
          const updated = db.prepare(`select * from "${this._table}" where ${whereClauses}`).get(...whereVals)
          results.push(rowToObj(updated))
        } else {
          const keys = Object.keys(item)
          const stmt = db.prepare(
            `insert into "${this._table}" (${keys.map(k => `"${k}"`).join(',')}) values (${keys.map(() => '?').join(',')})`
          )
          stmt.run(...keys.map(k => item[k]))
          const inserted = db.prepare(`select * from "${this._table}" where rowid = ?`).get(stmt.lastInsertRowid)
          results.push(rowToObj(inserted))
        }
      }

      return { data: this._single ? results[0] : results, error: null }
    }

    _findExisting(item, conflictCols) {
      const clauses = conflictCols.map(c => `"${c.trim()}" = ?`)
      const vals = conflictCols.map(c => item[c.trim()])
      if (vals.some(v => v === undefined)) return null
      const row = db.prepare(`select * from "${this._table}" where ${clauses.join(' and ')} limit 1`).get(...vals)
      return row ? rowToObj(row) : null
    }

    _doDelete() {
      const { clause, params } = this._buildWhere()
      if (!clause) {
        db.prepare(`delete from "${this._table}"`).run()
      } else {
        db.prepare(`delete from "${this._table}" ${clause}`).run(...params)
      }
      return { data: null, error: null }
    }

    _doUpdate() {
      const data = this._updateData
      if (!data || Object.keys(data).length === 0) return { data: null, error: { message: 'No data to update' } }
      const { clause, params } = this._buildWhere()
      if (!clause) return { data: null, error: { message: 'Update requires a where clause' } }

      const sets = Object.keys(data).map(k => `"${k}" = ?`).join(', ')
      const vals = Object.keys(data).map(k => data[k])
      db.prepare(`update "${this._table}" set ${sets} ${clause}`).run(...vals, ...params)
      return { data: null, error: null }
    }
  }

  return {
    from(table) {
      return new QueryBuilder(table)
    },
    rpc() {
      return { then: (resolve) => resolve({ data: null, error: null }) }
    }
  }
}
