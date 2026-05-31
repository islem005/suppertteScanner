(function() {
  if (typeof feather !== 'undefined') feather.replace()
  let user = null, stores = []

  const navItems = [
    { id: 'overview',    icon: 'bar-chart-2', label: 'Overview' },
    { id: 'stores',      icon: 'home', label: 'Stores' },
    { id: 'users',       icon: 'users', label: 'Users' },
    { id: 'promotions',  icon: 'gift', label: 'Promotions' },
    { id: 'discounts',   icon: 'tag', label: 'Discounts' },
    { id: 'branding',    icon: 'droplet', label: 'Branding' },
    { id: 'activity',    icon: 'clock', label: 'Activity' },
    { id: 'profile',     icon: 'user', label: 'Profile' },
  ]

  const $ = (id)     => { const e = document.getElementById(id); if (!e) console.warn('Missing #'+id); return e }
  const qs = (s, p)  => (p||document).querySelector(s)

  function saveAuth(u, t) { user = u; localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)) }
  function loadAuth() {
    const t = localStorage.getItem('token'), r = localStorage.getItem('user')
    if (t && r) {
      try {
        const payload = JSON.parse(atob(t.split('.')[1]))
        if (payload.exp * 1000 < Date.now()) { localStorage.removeItem('token'); localStorage.removeItem('user'); return false }
      } catch { return false }
      user = JSON.parse(r); return true
    }
    return false
  }
  function logout() { localStorage.removeItem('token'); localStorage.removeItem('user'); user = null; showLoginView() }

  function showLoginView() {
    showView('view-login')
    document.getElementById('view-dash').classList.remove('active')
    document.getElementById('view-dash').style.display = 'none'
    const loginView = document.getElementById('view-login')
    loginView.style.display = 'flex'
    loginView.classList.add('active')
    if (typeof feather !== 'undefined') feather.replace()
  }

  // ─── Admin Login Form ───
  const adminLoginForm = document.getElementById('admin-login-form')
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = adminLoginForm.querySelector('button[type="submit"]')
      btn.disabled = true; btn.textContent = 'Signing in...'
      const errorEl = document.getElementById('admin-login-error')
      errorEl.textContent = ''

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('admin-email').value,
            password: document.getElementById('admin-password').value
          })
        })
        let data = {}
        try { data = await res.json() } catch { data = {} }
        if (!res.ok) throw new Error(data.error || 'Login failed')

        if (data.user.role !== 'admin') {
          throw new Error('This login is for admin accounts only. Managers use the /auth/ page.')
        }

        saveAuth(data.user, data.token)
        API.getStores().then(s => { stores = s }).catch(() => {})
        routeDash()
        showToast('Welcome back, ' + (data.user.display_name || 'Admin'))
      } catch (err) {
        errorEl.textContent = err.message
        btn.disabled = false; btn.textContent = 'Sign In'
      }
    })
  }

  function showView(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id)) }
  function showDashView(id) {
    document.querySelectorAll('.dash-view').forEach(v => v.classList.toggle('active', v.id === 'view-' + id))
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === id))
    if (id === 'overview') loadAdminOverview()
    else if (id === 'stores') loadStores()
    else if (id === 'users') loadUsers()
    else if (id === 'branding') loadBranding()
    else if (id === 'promotions') loadPromotions()
    else if (id === 'discounts') loadDiscounts()
    else if (id === 'activity') loadActivity()
    else if (id === 'profile') loadProfile()
  }
  function navigateTo(id) {
    if (location.hash !== '#' + id) location.hash = id
    showDashView(id)
  }
  window.addEventListener('hashchange', () => {
    const id = location.hash.replace('#', '') || 'overview'
    showDashView(id)
  })

  function buildNav(items) {
    const nav = $('sidebar-nav'); nav.innerHTML = ''
    items.forEach(item => {
      const btn = document.createElement('button')
      btn.className = 'nav-item'; btn.dataset.view = item.id
      btn.innerHTML = `<i data-feather="${item.icon}"></i> ${item.label}`
      btn.onclick = () => navigateTo(item.id)
      nav.appendChild(btn)
    })
    if (typeof feather !== 'undefined') feather.replace()
  }

  function routeDash() {
    showView('view-dash')
    // Clear inline styles set by showLoginView so CSS .active class takes over
    document.getElementById('view-dash').style.display = ''
    document.getElementById('view-login').style.display = ''
    buildNav(navItems)
    $('sidebar-username').textContent = user.display_name || user.email
    const initial = location.hash.replace('#', '') || 'overview'
    if (navItems.some(i => i.id === initial)) showDashView(initial)
    else showDashView('overview')
  }

  $('btn-logout').addEventListener('click', logout)

  async function loadAdminOverview() {
    const s = await API.getAdminStats()
    $('ov-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    $('ov-cards').innerHTML = `
      <div class="stat-card"><span class="num">${s.totalStores}</span><span class="label">Stores</span></div>
      <div class="stat-card"><span class="num">${s.totalUsers}</span><span class="label">Users</span></div>
      <div class="stat-card"><span class="num">${s.totalProducts}</span><span class="label">Products</span></div>
      <div class="stat-card"><span class="num">${s.todayScans}</span><span class="label">Today's Scans</span></div>
      <div class="stat-card"><span class="num">${s.totalScans}</span><span class="label">All Scans</span></div>
    `
    if (!s.storeStats || s.storeStats.length === 0) {
      $('ov-store-table').innerHTML = '<div class="empty-state">No stores yet. Create one in Stores.</div>'
      return
    }
    let html = '<table><thead><tr><th>Store</th><th>Slug</th><th>Products</th><th>Scans</th><th>Users</th></tr></thead><tbody>'
    for (const st of s.storeStats) html += `<tr><td><strong>${esc(st.name)}</strong></td><td><span class="meta">/${esc(st.slug)}</span></td><td>${st.products}</td><td>${st.scans}</td><td>${st.users}</td></tr>`
    $('ov-store-table').innerHTML = html + '</tbody></table>'
  }

  async function loadStores() {
    stores = await API.getStores()
    if (stores.length === 0) { $('store-table').innerHTML = '<div class="empty-state">No stores. Click "+ New Store".</div>'; return }
    let html = '<table><thead><tr><th>Name</th><th>Slug</th><th>Created</th><th></th></tr></thead><tbody>'
    for (const s of stores) html += `<tr><td><strong>${esc(s.name)}</strong></td><td><span class="meta">/${esc(s.slug)}</span></td><td class="meta">${(s.created_at||'').slice(0,10)}</td><td class="actions-cell" style="display:flex;gap:4px"><button class="btn small" onclick="showStoreDetail('${s.id}')">Explore</button><button class="btn small danger" onclick="deleteStore('${s.id}','${esc(s.name)}')">Delete</button></td></tr>`
    $('store-table').innerHTML = html + '</tbody></table>'
  }

  $('btn-add-store').onclick = () => {
    showModal('New Store', `
      <div class="form">
        <input id="mod-store-name" placeholder="Store name" required>
        <input id="mod-store-slug" placeholder="Slug (e.g., store-nyc)" required oninput="document.getElementById('store-url-preview').textContent='ivond.com/'+this.value.replace(/\\s+/g,'-').toLowerCase()">
        <div id="store-url-preview" style="font-size:var(--text-sm);color:var(--text-secondary);padding:var(--space-1) var(--space-4) 0"></div>
      </div>
    `, async () => {
      const name = $('mod-store-name').value, slug = $('mod-store-slug').value
      if (!name || !slug) return
      await API.createStore(name, slug)
      closeModal(); loadStores(); if ($('view-overview').classList.contains('active')) loadAdminOverview()
    })
  }

  window.deleteStore = async (id, name) => {
    showModal('Delete Store', `Delete <strong>${name}</strong> and all its products & scans? This cannot be undone.`, async () => {
      await API.del(`/stores/${id}`)
      closeModal(); loadStores(); if ($('view-overview').classList.contains('active')) loadAdminOverview()
    }, true)
  }

  // ─── Store Detail View ───
  let currentStoreId = null

  window.showStoreDetail = async (storeId) => {
    currentStoreId = storeId
    document.querySelectorAll('.dash-view').forEach(v => v.classList.remove('active'))
    $('view-store-detail').style.display = 'block'
    $('view-store-detail').classList.add('active')
    loadStoreDetail()
  }

  $('btn-back-stores').onclick = () => {
    $('view-store-detail').style.display = 'none'
    $('view-store-detail').classList.remove('active')
    navigateTo('stores')
  }

  async function loadStoreDetail() {
    if (!currentStoreId) return
    const store = stores.find(s => s.id === currentStoreId)
    if (store) {
      $('sd-title').textContent = store.name
      $('sd-public-link').href = `/${store.slug}`
    }

    Promise.all([
      loadStoreStats(),
      loadMappingCard(),
      loadPendingImports(),
      loadImportHistory()
    ])
  }

  async function loadStoreStats() {
    try {
      const s = await API.getAdminStats()
      const st = (s.storeStats || []).find(st => st.id === currentStoreId)
      if (!st) { $('sd-stats').innerHTML = ''; return }
      $('sd-stats').innerHTML = `
        <div class="stat-card"><span class="num">${st.products}</span><span class="label">Products</span></div>
        <div class="stat-card"><span class="num">${st.scans}</span><span class="label">Scans</span></div>
        <div class="stat-card"><span class="num">${st.users}</span><span class="label">Users</span></div>
      `
    } catch { $('sd-stats').innerHTML = '' }
  }

  async function loadMappingCard() {
    const body = $('sd-mapping-body')
    const badge = $('sd-mapping-badge')

    try {
      const mapping = await API.getMapping(currentStoreId)
      if (mapping && mapping.column_mapping) {
        badge.innerHTML = '<span style="color:#00c875">✓ Active Mapping</span>'
        const cm = mapping.column_mapping
        const po = mapping.parser_options
        body.innerHTML = `
          <div style="font-size:var(--text-sm);line-height:1.8">
            <span class="meta">Barcode</span> ← <strong>${esc(cm.barcode)}</strong><br>
            <span class="meta">Name</span> ← <strong>${esc(cm.name)}</strong><br>
            <span class="meta">Price</span> ← <strong>${esc(cm.price)}</strong>
            ${po ? `<br><br><span class="meta">Options:</span> ${esc(JSON.stringify(po))}` : ''}
            <br><span class="meta">Saved:</span> ${mapping.created_at ? new Date(mapping.created_at).toLocaleString() : '—'}
            ${mapping.is_verified ? ' &nbsp; <span style="color:#00c875">✓ verified</span>' : ' &nbsp; <span style="color:#ffc107">○ not verified</span>'}
          </div>
        `
        $('btn-sd-edit-map').classList.remove('hidden')
        $('btn-sd-test-map').classList.remove('hidden')
        $('btn-sd-remove-map').classList.remove('hidden')
        $('btn-sd-save-map-only').classList.add('hidden')
      } else {
        badge.innerHTML = '<span style="color:#ffc107">○ Not Mapped</span>'
        body.innerHTML = '<div class="empty-state">No mapping configured yet. Upload a file for this store to get started.</div>'
        $('btn-sd-edit-map').classList.remove('hidden')
        $('btn-sd-test-map').classList.add('hidden')
        $('btn-sd-remove-map').classList.add('hidden')
        $('btn-sd-save-map-only').classList.add('hidden')
      }
    } catch {
      badge.innerHTML = '<span style="color:#ff4444">✗ Error</span>'
      body.innerHTML = '<div class="empty-state">Could not load mapping.</div>'
    }
  }

  async function loadPendingImports() {
    const list = $('sd-pending-list')
    try {
      const data = await API.getStoreImports(currentStoreId)
      const pending = (data.imports || []).filter(i => i.status === 'pending' || i.status === 'auto-mapped')
      if (pending.length === 0) {
        list.innerHTML = '<div class="empty-state">No pending imports.</div>'
        return
      }
      let html = '<table><thead><tr><th>File</th><th>Date</th><th>Rows</th><th>Status</th><th></th></tr></thead><tbody>'
      for (const p of pending) {
        html += `<tr>
          <td><strong>${esc(p.original_filename)}</strong></td>
          <td class="meta">${new Date(p.created_at).toLocaleString()}</td>
          <td>${p.row_count}</td>
          <td><span class="import-status ${p.status}">${p.status}</span></td>
          <td class="actions-cell" style="display:flex;gap:4px">
            <button class="btn small" onclick="previewImport('${p.id}')">Preview</button>
            ${p.status === 'pending' ? `<button class="btn small" onclick="openMapModal('${p.id}')">Map & Import</button><button class="btn small danger" onclick="rejectImport('${p.id}')">Reject</button>` : ''}
            ${p.status === 'auto-mapped' ? `<button class="btn small" onclick="openMapModal('${p.id}')">Re-map</button><button class="btn small" onclick="verifyImport('${p.id}')">Verify ✓</button>` : ''}
          </td>
        </tr>`
      }
      list.innerHTML = html + '</tbody></table>'
    } catch { list.innerHTML = '<div class="empty-state">Could not load pending imports.</div>' }
  }

  async function loadImportHistory() {
    const list = $('sd-history-list')
    try {
      const data = await API.getStoreImports(currentStoreId)
      const history = (data.imports || []).filter(i => i.status === 'imported' || i.status === 'rejected')
      if (history.length === 0) {
        list.innerHTML = '<div class="empty-state">No import history.</div>'
        return
      }
      let html = '<table><thead><tr><th>File</th><th>Date</th><th>Rows</th><th>Status</th><th></th></tr></thead><tbody>'
      for (const h of history) {
        html += `<tr>
          <td><strong>${esc(h.original_filename)}</strong></td>
          <td class="meta">${h.imported_at ? new Date(h.imported_at).toLocaleString() : new Date(h.created_at).toLocaleString()}</td>
          <td>${h.row_count}</td>
          <td><span class="import-status ${h.status}">${h.status}</span></td>
          <td class="actions-cell"><button class="btn small" onclick="previewImport('${h.id}')">Preview</button></td>
        </tr>`
      }
      list.innerHTML = html + '</tbody></table>'
    } catch { list.innerHTML = '<div class="empty-state">Could not load history.</div>' }
  }

  // ─── Preview Modal ───
  window.previewImport = async (id) => {
    try {
      const preview = await API.getImportPreview(id)
      let tableHtml = '<table id="import-preview-table"><thead><tr>'
      for (const col of preview.columns) tableHtml += `<th>${esc(col)}</th>`
      tableHtml += '</tr></thead><tbody>'
      for (const row of preview.sample_rows) {
        tableHtml += '<tr>'
        for (const col of preview.columns) tableHtml += `<td>${esc(String(row[col] || ''))}</td>`
        tableHtml += '</tr>'
      }
      tableHtml += '</tbody></table>'

      const suggested = preview.suggested_mapping
        ? `<div style="margin-top:12px;padding:8px;background:var(--bg-inset);border-radius:var(--radius-md);font-size:var(--text-sm)">
            <strong>Suggested mapping:</strong> Barcode ← ${esc(suggested.barcode)}, Name ← ${esc(suggested.name)}, Price ← ${esc(suggested.price)}
           </div>`
        : ''

      showModal('File Preview', `
        <div style="font-size:var(--text-sm);margin-bottom:8px;color:var(--text-secondary)">
          ${preview.row_count} rows · ${preview.columns.length} columns
          ${preview.detected_delimiter ? ` · delimiter: ${esc(preview.detected_delimiter)}` : ''}
          ${preview.sheets ? ` · sheets: ${preview.sheets.join(', ')}` : ''}
          ${preview.tables ? ` · tables: ${preview.tables.join(', ')}` : ''}
        </div>
        <div style="max-height:300px;overflow:auto">${tableHtml}</div>
        ${suggested}
      `, null)
      $('modal-confirm').style.display = 'none'
    } catch (err) { showToast('Error: ' + err.message) }
  }

  // ─── Map Modal ───
  window.openMapModal = async (id) => {
    try {
      const preview = await API.getImportPreview(id)
      const mapping = await API.getMapping(currentStoreId)
      const currentMap = mapping ? mapping.column_mapping : preview.suggested_mapping

      const cols = preview.columns
      const colOpts = cols.map(c => `<option value="${esc(c)}" ${currentMap.barcode === c ? 'selected' : ''}>${esc(c)}</option>`).join('')

      let tableHtml = '<table id="import-preview-table"><thead><tr>'
      for (const col of cols) tableHtml += `<th>${esc(col)}</th>`
      tableHtml += '</tr></thead><tbody>'
      for (const row of preview.sample_rows.slice(0, 5)) {
        tableHtml += '<tr>'
        for (const col of cols) tableHtml += `<td>${esc(String(row[col] || ''))}</td>`
        tableHtml += '</tr>'
      }
      tableHtml += '</tbody></table>'

      showModal('Column Mapping', `
        <div style="max-height:200px;overflow:auto;margin-bottom:12px">${tableHtml}</div>
        <div class="form" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div class="form-row">
            <label>Barcode column</label>
            <select class="mapping-select" id="map-bc">${colOpts}</select>
          </div>
          <div class="form-row">
            <label>Name column</label>
            <select class="mapping-select" id="map-nm">${colOpts.replace(new RegExp(escReg(currentMap.barcode), 'g'), 'PLACEHOLDER').replace(`selected>`, `>`).replace('PLACEHOLDER', esc(currentMap.barcode))}</select>  <!-- TEST: 'PLACEHOLDER' is a sentinel string for RegExp replacement -->
          </div>
          <div class="form-row">
            <label>Price column</label>
            <select class="mapping-select" id="map-pr">${colOpts}</select>
          </div>
        </div>
        <div id="map-live-preview" class="mapping-preview-card" style="margin-top:8px">
          <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">Live preview (first row):</div>
          <div class="row"><span class="label">Barcode:</span><span class="value" id="map-lv-bc">—</span></div>
          <div class="row"><span class="label">Name:</span><span class="value" id="map-lv-nm">—</span></div>
          <div class="row"><span class="label">Price:</span><span class="value" id="map-lv-pr">—</span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button id="btn-test-map" class="btn small">Test Mapping</button>
          <span id="map-test-result" style="font-size:var(--text-sm);flex:1;align-self:center"></span>
        </div>
      `, async () => {
        const cm = {
          barcode: $('map-bc').value,
          name: $('map-nm').value,
          price: $('map-pr').value
        }
        await API.mapImport(id, cm, null)
        closeModal()
        loadStoreDetail()
        showToast('Mapping saved and products imported!')
      })

      // Live preview
      function updateLivePreview() {
        const firstRow = preview.sample_rows[0] || {}
        document.getElementById('map-lv-bc').textContent = String(firstRow[document.getElementById('map-bc').value] || '—')
        document.getElementById('map-lv-nm').textContent = String(firstRow[document.getElementById('map-nm').value] || '—')
        document.getElementById('map-lv-pr').textContent = String(firstRow[document.getElementById('map-pr').value] || '—')
        document.getElementById('map-test-result').textContent = ''
      }

      $('map-bc').onchange = updateLivePreview
      $('map-nm').onchange = updateLivePreview
      $('map-pr').onchange = updateLivePreview
      updateLivePreview()

      document.getElementById('btn-test-map').onclick = async () => {
        const cm = {
          barcode: $('map-bc').value,
          name: $('map-nm').value,
          price: $('map-pr').value
        }
        try {
          const result = await API.testImport(id, cm)
          document.getElementById('map-test-result').innerHTML = `
            <span style="color:#00c875">✓ OK</span> ${result.valid_rows}/${result.total_rows} valid
          `
        } catch (err) {
          document.getElementById('map-test-result').innerHTML = `<span style="color:#ff4444">✗ ${esc(err.message)}</span>`
        }
      }

      const confirmBtn = $('modal-confirm')
      confirmBtn.style.display = ''

      // Show the save-mapping-only button
      const bodyEl = document.querySelector('#modal-body')
      const saveOnlyBtn = document.createElement('button')
      saveOnlyBtn.className = 'btn small'
      saveOnlyBtn.textContent = 'Save Mapping Only'
      saveOnlyBtn.style.marginRight = 'auto'
      saveOnlyBtn.onclick = async () => {
        const cm = {
          barcode: $('map-bc').value,
          name: $('map-nm').value,
          price: $('map-pr').value
        }
        try {
          await API.saveMapping(currentStoreId, cm, null)
          closeModal()
          loadStoreDetail()
          showToast('Mapping saved!')
        } catch (err) { showToast('Error: ' + err.message) }
      }
      document.querySelector('.modal-actions').prepend(saveOnlyBtn)
    } catch (err) { showToast('Error: ' + err.message) }
  }

  // ─── Verify Import ───
  window.verifyImport = async (id) => {
    try {
      await API.verifyImport(id)
      loadStoreDetail()
      showToast('Import verified!')
    } catch (err) { showToast('Error: ' + err.message) }
  }

  window.rejectImport = async (id) => {
    try {
      await API.rejectImport(id)
      loadStoreDetail()
      showToast('Import rejected.')
    } catch (err) { showToast('Error: ' + err.message) }
  }

  // ─── Mapping Action Buttons ───
  $('btn-sd-edit-map').onclick = async () => {
    try {
      const preview = await API.getImportPreview((await API.getStoreImports(currentStoreId)).imports[0]?.id)
      if (preview) openMapModal((await API.getStoreImports(currentStoreId)).imports[0].id)
      else showToast('Upload a file first to edit mapping')
    } catch { showToast('Upload a file first to edit mapping') }
  }

  $('btn-sd-test-map').onclick = async () => {
    try {
      const mapping = await API.getMapping(currentStoreId)
      if (!mapping) { showToast('No mapping to test'); return }
      const imports = await API.getStoreImports(currentStoreId)
      const lastImport = imports.imports[0]
      if (!lastImport) { showToast('No files uploaded yet'); return }

      const result = await API.testImport(lastImport.id, mapping.column_mapping)
      let msg = `Test: ${result.valid_rows}/${result.total_rows} valid rows`
      if (result.preview && result.preview[0]) {
        msg += ` · First: ${result.preview[0].barcode} → ${result.preview[0].name} → ${result.preview[0].price}`
      }
      showToast(msg)
    } catch (err) { showToast('Test failed: ' + err.message) }
  }

  $('btn-sd-remove-map').onclick = async () => {
    showModal('Remove Mapping', `Remove the mapping for <strong>${esc($('sd-title').textContent)}</strong>? Future uploads will need admin assistance again.`, async () => {
      await API.deleteMapping(currentStoreId)
      closeModal(); loadStoreDetail(); showToast('Mapping removed.')
    }, true)
  }

  // ─── Helper: escape for regex ───
  function escReg(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  async function loadUsers() {
    const users = await API.getAdminUsers()
    stores = await API.getStores()
    const storeMap = {}; stores.forEach(s => storeMap[s.id] = s.name)

    if (users.length === 0) { $('user-table').innerHTML = '<div class="empty-state">No users yet.</div>'; return }
    let html = '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Store</th><th></th></tr></thead><tbody>'
    for (const u of users) {
      const storeName = u.store_id ? (storeMap[u.store_id] || '—') : '—'
      html += `<tr><td>${esc(u.display_name)}</td><td class="meta">${esc(u.email)}</td><td><span class="tag ${u.role}">${u.role}</span></td><td class="meta">${esc(storeName)}</td><td class="actions-cell">${u.role !== 'admin' ? `<button class="btn small danger" onclick="deleteUser('${u.id}','${esc(u.display_name)}')">Delete</button>` : ''}</td></tr>`
    }
    $('user-table').innerHTML = html + '</tbody></table>'
  }

  $('btn-add-user').onclick = () => {
    const storeOpts = stores.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')
    showModal('New User', `
      <div class="form">
        <input id="mod-user-email" type="email" placeholder="Email" required>
        <input id="mod-user-pass" type="password" placeholder="Password" required>
        <input id="mod-user-name" placeholder="Display Name" required>
        <select id="mod-user-store"><option value="">— No store (admin) —</option>${storeOpts}</select>
        <select id="mod-user-role"><option value="staff">Staff</option><option value="manager">Manager</option><option value="admin">Admin</option></select>
      </div>
    `, async () => {
      await API.createUser({
        email: $('mod-user-email').value, password: $('mod-user-pass').value,
        displayName: $('mod-user-name').value, storeId: $('mod-user-store').value || null,
        role: $('mod-user-role').value
      })
      closeModal(); loadUsers()
    })
  }

  window.deleteUser = async (id, name) => {
    showModal('Delete User', `Delete <strong>${name}</strong>?`, async () => {
      await API.deleteUser(id); closeModal(); loadUsers()
    }, true)
  }

  let _editingStoreId = null

  async function loadBranding() {
    try {
      stores = await API.getStores()
    } catch { stores = [] }
    _editingStoreId = null
    $('brand-editor').classList.add('hidden')

    if (stores.length === 0) {
      $('brand-stores-table').innerHTML = '<div class="empty-state">No stores yet.</div>'
      return
    }
    let html = '<table><thead><tr><th>Store</th><th>Slug</th><th>Status</th><th></th></tr></thead><tbody>'
    for (const s of stores) {
      let status = ''
      try {
        const b = await API.getBranding(s.id)
        if (b.display_name || b.logo_url) status = '<span style="color:#00c875;font-size:12px">✓ Configured</span>'
        else status = '<span style="color:#ffc107;font-size:12px">○ Default</span>'
      } catch { status = '<span style="color:#ff4444;font-size:12px">✗ Error</span>' }
      html += `<tr><td><strong>${esc(s.name)}</strong></td><td class="meta">/${esc(s.slug)}</td><td>${status}</td><td class="actions-cell"><button class="btn small" onclick="openBrandingEditor('${s.id}')">Modify Branding</button></td></tr>`
    }
    $('brand-stores-table').innerHTML = html + '</tbody></table>'
  }

  window.openBrandingEditor = async (storeId) => {
    _editingStoreId = storeId
    const store = stores.find(s => s.id === storeId)
    $('brand-editor-title').textContent = store ? esc(store.name) : 'Branding'
    $('brand-stores-table').style.display = 'none'
    $('brand-editor').classList.remove('hidden')
    loadBrandingForm(storeId)
  }

  $('brand-editor-back').addEventListener('click', () => {
    _editingStoreId = null
    $('brand-editor').classList.add('hidden')
    $('brand-stores-table').style.display = ''
    loadBranding()
  })

  // ─── Logo picker ───
  function readLogoFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height
        const max = 300
        if (w > max || h > max) {
          const scale = Math.min(max / w, max / h)
          w = Math.round(w * scale); h = Math.round(h * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const resized = canvas.toDataURL('image/webp', 0.8)
        $('brand-logo').value = resized
        $('brand-logo-preview').src = resized
        $('brand-logo-preview').classList.remove('hidden')
        $('brand-logo-remove').classList.remove('hidden')
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }

  $('brand-logo-input').addEventListener('change', e => {
    if (e.target.files[0]) { readLogoFile(e.target.files[0]); updateBrandPreview() }
  })

  $('brand-logo-remove').addEventListener('click', () => {
    $('brand-logo').value = ''
    $('brand-logo-input').value = ''
    $('brand-logo-preview').classList.add('hidden')
    $('brand-logo-remove').classList.add('hidden')
    updateBrandPreview()
  })

  async function loadBrandingForm(storeId) {
    try {
      const b = await API.getBranding(storeId)
      $('brand-name').value = b.display_name || ''
      $('brand-logo').value = b.logo_url || ''
      if (b.logo_url) {
        $('brand-logo-preview').src = b.logo_url
        $('brand-logo-preview').classList.remove('hidden')
        $('brand-logo-remove').classList.remove('hidden')
      } else {
        $('brand-logo-preview').classList.add('hidden')
        $('brand-logo-remove').classList.add('hidden')
      }
      $('brand-primary').value = b.primary_color || '#6366f1'
      $('brand-primary-val').textContent = b.primary_color || '#6366f1'
      $('brand-accent').value = b.accent_color || '#10b981'
      $('brand-accent-val').textContent = b.accent_color || '#10b981'
      $('brand-email').value = b.contact_email || ''
      $('brand-phone').value = b.contact_phone || ''
      $('brand-footer').value = b.footer_text || ''
      $('brand-instagram').value = b.instagram_url || ''
      $('brand-tiktok').value = b.tiktok_url || ''
      $('brand-website').value = b.website_url || ''
      $('brand-facebook').value = b.facebook_url || ''
      $('brand-twitter').value = b.twitter_url || ''
      $('brand-youtube').value = b.youtube_url || ''
    } catch {}
    updateBrandPreview()
  }

  function updateBrandPreview() {                                   // TEST: preview phone mockup with live branding
    const name = $('brand-name').value || 'Your Store'
    const logo = $('brand-logo').value
    const primary = $('brand-primary').value || '#6366f1'
    const accent = $('brand-accent').value || '#10b981'
    const mockup = $('brand-mockup')                                 // TEST: CSS-only phone mockup element
    if (!mockup) return

    const titleEl = $('preview-title')
    if (logo) {
      titleEl.innerHTML = '<img src="' + logo.replace(/"/g, '&quot;') + '" alt="Logo">'
    } else {
      titleEl.textContent = name
    }

    const logoImg = $('preview-logo')
    if (logo) { logoImg.src = logo; logoImg.parentElement.classList.remove('hidden') }
    else logoImg.parentElement.classList.add('hidden')
    $('preview-profile-name').textContent = name

    const setSocial = function(id, val) {
      const el = $(id)
      if (val) { el.href = val; el.classList.remove('hidden') }
      else el.classList.add('hidden')
    }
    setSocial('preview-instagram', $('brand-instagram').value)
    setSocial('preview-tiktok', $('brand-tiktok').value)
    setSocial('preview-website', $('brand-website').value)
    setSocial('preview-facebook', $('brand-facebook').value)
    setSocial('preview-twitter', $('brand-twitter').value)
    setSocial('preview-youtube', $('brand-youtube').value)
    setSocial('preview-email', $('brand-email').value ? 'mailto:' + $('brand-email').value : '')
    setSocial('preview-phone', $('brand-phone').value ? 'tel:' + $('brand-phone').value : '')

    mockup.style.setProperty('--color-primary', primary)
    mockup.style.setProperty('--color-success', accent)
  }

  $('brand-primary').oninput = () => { $('brand-primary-val').textContent = $('brand-primary').value; updateBrandPreview() }
  $('brand-accent').oninput = () => { $('brand-accent-val').textContent = $('brand-accent').value; updateBrandPreview() }
  $('brand-name').oninput = updateBrandPreview
  $('brand-email').oninput = updateBrandPreview
  $('brand-phone').oninput = updateBrandPreview
  $('brand-instagram').oninput = updateBrandPreview
  $('brand-tiktok').oninput = updateBrandPreview
  $('brand-website').oninput = updateBrandPreview
  $('brand-facebook').oninput = updateBrandPreview
  $('brand-twitter').oninput = updateBrandPreview
  $('brand-youtube').oninput = updateBrandPreview

  $('branding-form').addEventListener('submit', async e => {
    e.preventDefault()
    const storeId = _editingStoreId
    if (!storeId) return
    try {
      await API.updateBranding(storeId, {
        display_name: $('brand-name').value,
        logo_url: $('brand-logo').value,
        primary_color: $('brand-primary').value,
        accent_color: $('brand-accent').value,
        contact_email: $('brand-email').value,
        contact_phone: $('brand-phone').value,
        footer_text: $('brand-footer').value,
        instagram_url: $('brand-instagram').value,
        tiktok_url: $('brand-tiktok').value,
        website_url: $('brand-website').value,
        facebook_url: $('brand-facebook').value,
        twitter_url: $('brand-twitter').value,
        youtube_url: $('brand-youtube').value
      })
      $('brand-msg').textContent = 'Branding saved!'
      setTimeout(() => $('brand-msg').textContent = '', 2000)
    } catch (err) { $('brand-msg').textContent = 'Error: ' + err.message; $('brand-msg').style.color = '#ff4444' }
  })

  async function loadActivity() {
    try {
      const activity = await API.getAdminActivity(50)
      if (!activity || activity.length === 0) {
        $('activity-list').innerHTML = '<div class="empty-state">No activity yet.</div>'; return
      }
      let html = '<div class="table-wrap"><table><thead><tr><th>Store</th><th>Slug</th><th>Products</th><th>Scans</th><th>Users</th><th>Created</th></tr></thead><tbody>'
      for (const a of activity) {
        const time = new Date(a.created_at).toLocaleDateString()
        html += `<tr><td><strong>${esc(a.store_name)}</strong></td><td>${esc(a.store_slug)}</td><td>${a.products}</td><td>${a.scans}</td><td>${a.users}</td><td>${time}</td></tr>`
      }
      $('activity-list').innerHTML = html + '</tbody></table></div>'
    } catch { $('activity-list').innerHTML = '<div class="empty-state">Could not load activity.</div>' }
  }

  // ══════════════════════════════════════════════
  //  PROMOTIONS (Banner + Offers)
  // ══════════════════════════════════════════════

  let _promoStoreId = null

  async function loadPromotions() {
    _promoStoreId = null
    $('promo-banner-editor').classList.add('hidden')
    try {
      stores = await API.getStores()
    } catch { stores = [] }

    if (stores.length === 0) {
      $('promo-stores-table').innerHTML = '<div class="empty-state">No stores yet.</div>'
      return
    }
    let html = '<table><thead><tr><th>Store</th><th>Slug</th><th>Banners</th><th>Offers</th><th></th></tr></thead><tbody>'
    for (const s of stores) {
      let bannerCount = 0
      let offerCount = 0
      try {
        const banners = await API.getBanner(s.id)
        bannerCount = Array.isArray(banners) ? banners.length : 0
        const offers = await API.getOffers(s.id)
        offerCount = offers.length
      } catch { /* ignore */ }
      html += `<tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td class="meta">/${esc(s.slug)}</td>
        <td>${bannerCount}</td>
        <td>${offerCount}</td>
        <td class="actions-cell"><button class="btn small" onclick="openPromoEditor('${s.id}')">Manage</button></td>
      </tr>`
    }
    $('promo-stores-table').innerHTML = html + '</tbody></table>'
  }

  $('btn-promo-refresh').onclick = loadPromotions

  window.openPromoEditor = async (storeId) => {
    _promoStoreId = storeId
    const store = stores.find(s => s.id === storeId)
    $('promo-banner-title').textContent = store ? esc(store.name) + ' — Promotions' : 'Promotions'
    $('promo-stores-table').style.display = 'none'
    $('promo-banner-editor').classList.remove('hidden')
    loadBannerForm(storeId)
    loadPromoOffersList(storeId)
  }

  $('promo-banner-back').onclick = () => {
    _promoStoreId = null
    $('promo-banner-editor').classList.add('hidden')
    $('promo-stores-table').style.display = ''
    loadPromotions()
  }

  // ─── Banners List + Editor ───
  async function loadBannerForm(storeId) {
    const wrap = $('promo-banner-form-wrap')
    try {
      let banners
      try { banners = await API.getBanner(storeId) } catch { banners = [] }
      if (!Array.isArray(banners)) banners = []

      let html = `
        <div class="card" style="padding:var(--space-4);background:var(--bg-surface)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
            <h4 style="margin:0;font-size:var(--text-base)">Banners</h4>
            <button id="btn-new-banner" class="btn small">+ New Banner</button>
          </div>`

      if (banners.length === 0) {
        html += '<div class="empty-state">No banners yet. Click "+ New Banner" to add one.</div>'
      } else {
        html += '<div class="table-wrap"><table><thead><tr><th style="width:60px">Image</th><th>Title</th><th style="width:60px">Active</th><th style="width:120px"></th></tr></thead><tbody>'
        for (const b of banners) {
          html += `<tr>
            <td>${b.image_data ? '<img src="' + esc(b.image_data) + '" style="width:48px;height:18px;object-fit:cover;border-radius:var(--radius-sm);display:block">' : '<span class="meta">—</span>'}</td>
            <td>${esc(b.title || '')}</td>
            <td>${b.active ? '<span style="color:var(--color-success)">✓</span>' : '—'}</td>
            <td class="actions-cell" style="white-space:nowrap">
              <button class="btn small" data-banner-id="${b.id}" data-banner-title="${esc(b.title || '')}" data-banner-image="${esc(b.image_data || '')}" data-banner-active="${b.active ? '1' : '0'}" onclick="editBanner(this)">Edit</button>
              <button class="btn small danger" onclick="deleteBanner('${b.id}')">Delete</button>
            </td>
          </tr>`
        }
        html += '</tbody></table></div>'
      }
      html += '<span id="promo-banner-msg" class="success-msg"></span></div>'
      wrap.innerHTML = html

      $('btn-new-banner').onclick = () => openBannerModal(storeId, null)
    } catch { wrap.innerHTML = '<div class="empty-state">Could not load banners.</div>' }
  }

  window.editBanner = function(btn) {
    const id = btn.getAttribute('data-banner-id')
    const storeId = _promoStoreId
    const banner = { id, title: btn.getAttribute('data-banner-title'), image_data: btn.getAttribute('data-banner-image'), active: btn.getAttribute('data-banner-active') === '1' }
    openBannerModal(storeId, banner)
  }

  window.deleteBanner = async (id) => {
    showModal('Delete banner?', 'Are you sure you want to delete this banner?', async () => {
      try {
        await API.deletePromotion(id)
        closeModal()
        showToast('Banner deleted')
        loadBannerForm(_promoStoreId)
      } catch (err) { showToast('Error: ' + err.message) }
    }, true)
  }

  function openBannerModal(storeId, banner) {
    const isNew = !banner
    const title = isNew ? 'New Banner' : 'Edit Banner'
    const body = `
      <div class="form-row">
        <label>Title (fallback if no image)</label>
        <input type="text" id="banner-modal-title" class="form-input" value="${isNew ? '' : esc(banner.title || '')}" placeholder="e.g. Check out our weekly deals!">
      </div>
      <div class="form-row">
        <label>Banner Image (GIF supported)</label>
        <div class="logo-picker">
          <input type="file" id="banner-modal-image-input" accept="image/png,image/jpeg,image/webp,image/gif">
          <input type="hidden" id="banner-modal-image" value="${isNew ? '' : esc(banner.image_data || '')}">
          <img id="banner-modal-image-preview" class="logo-preview ${isNew || !banner.image_data ? 'hidden' : ''}" src="${isNew ? '' : esc(banner.image_data || '')}">
          <button id="banner-modal-image-remove" class="btn small ${isNew || !banner.image_data ? 'hidden' : ''}" type="button">Remove</button>
        </div>
      </div>
      <div class="form-row" style="display:flex;gap:var(--space-3);align-items:center">
        <label style="margin:0;white-space:nowrap">Active</label>
        <input type="checkbox" id="banner-modal-active" ${isNew || banner.active !== false ? 'checked' : ''}>
      </div>`

    showModal(title, body, async () => {
      const _title = $('banner-modal-title').value || null
      const _image = $('banner-modal-image').value || null
      const _active = $('banner-modal-active').checked
      const data = { store_id: storeId, type: 'banner', title: _title, image_data: _image, active: _active }
      try {
        if (isNew) await API.createPromotion(data)
        else await API.updatePromotion(banner.id, data)
        closeModal()
        showToast(isNew ? 'Banner created!' : 'Banner saved!')
        loadBannerForm(storeId)
      } catch (err) { showToast('Error: ' + err.message) }
    }, false)

    // Wire up image crop
    const imgInput = $('banner-modal-image-input')
    const imgHidden = $('banner-modal-image')
    const imgPreview = $('banner-modal-image-preview')
    const imgRemove = $('banner-modal-image-remove')
    imgInput.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return
      const reader = new FileReader()
      reader.onload = async ev => {
        try {
          const cropped = await window.cropImage(ev.target.result, 800/300, 800, 300)
          imgHidden.value = cropped
          imgPreview.src = cropped
          imgPreview.classList.remove('hidden')
          imgRemove.classList.remove('hidden')
        } catch (e) { if (e.message !== 'cancelled') console.warn('Crop failed:', e) }
      }
      reader.readAsDataURL(file)
    })
    imgRemove.addEventListener('click', () => {
      imgHidden.value = ''
      imgInput.value = ''
      imgPreview.classList.add('hidden')
      imgRemove.classList.add('hidden')
    })
  }

  // ─── Offers List ───
  async function loadPromoOffersList(storeId) {
    const list = $('promo-offers-list')
    try {
      const promos = await API.getStorePromotions(storeId)
      const offers = promos.filter(p => p.type === 'offer')
      if (offers.length === 0) {
        list.innerHTML = '<div class="empty-state">No offers for this store.</div>'
        return
      }
      let html = '<table><thead><tr><th>Image</th><th>Title</th><th>Trigger</th><th>Active</th><th></th></tr></thead><tbody>'
      for (const o of offers) {
        const trigger = o.trigger_type ? o.trigger_type + ': ' + esc(o.trigger_value) : '<span class="tag success">Default</span>'
        const thumb = o.image_data
          ? `<img src="${esc(o.image_data)}" class="offer-thumb" alt="">`
          : '<span class="offer-thumb offer-thumb-empty"></span>'
        html += `<tr>
          <td>${thumb}</td>
          <td><strong>${esc(o.title || 'Untitled')}</strong></td>
          <td class="meta">${esc(trigger)}</td>
          <td>${o.active ? '<span style="color:#00c875">✓</span>' : '<span style="color:#ffc107">○</span>'}</td>
          <td class="actions-cell" style="display:flex;gap:4px">
            <button class="btn small" onclick="adminEditOffer('${o.id}')">Edit</button>
            <button class="btn small danger" onclick="adminDeleteOffer('${o.id}')">Delete</button>
          </td>
        </tr>`
      }
      list.innerHTML = html + '</tbody></table>'
    } catch { list.innerHTML = '<div class="empty-state">Could not load offers.</div>' }
  }

  $('btn-promo-add-offer').onclick = () => {
    if (!_promoStoreId) return
    adminOpenOfferModal(null, _promoStoreId)
  }

  function adminOpenOfferModal(existing, storeId) {
    const isEdit = !!existing
    const sid = storeId || existing.store_id
    const title = existing ? existing.title || '' : ''
    const active = existing ? !!existing.active : true
    const triggerType = existing ? existing.trigger_type || '' : ''
    const triggerValue = existing ? existing.trigger_value || '' : ''
    const imageData = existing ? existing.image_data || '' : ''

    showModal(isEdit ? 'Edit Offer' : 'New Offer', `
      <div class="form">
        <div class="form-row">
          <label>Title</label>
          <input id="mod-offer-title" class="form-input" value="${esc(title)}" placeholder="e.g. Weekend Special">
        </div>
        <div class="form-row">
          <label>Image</label>
          <div class="logo-picker">
            <input type="file" id="mod-offer-image-input" accept="image/png,image/jpeg,image/webp,gif">
            <input type="hidden" id="mod-offer-image" value="${esc(imageData)}">
            <img id="mod-offer-image-preview" class="logo-preview ${imageData ? '' : 'hidden'}" src="${esc(imageData)}">
            <button id="mod-offer-image-remove" class="btn small ${imageData ? '' : 'hidden'}" type="button">Remove</button>
          </div>
        </div>
        <div class="form-row">
          <label>Trigger Type</label>
          <select id="mod-offer-trigger-type" class="form-input">
            <option value="">— None (always show) —</option>
            <option value="category" ${triggerType === 'category' ? 'selected' : ''}>Category</option>
            <option value="product" ${triggerType === 'product' ? 'selected' : ''}>Product</option>
          </select>
        </div>
        <div class="form-row">
          <label>Trigger Value</label>
          <input id="mod-offer-trigger-value" class="form-input" value="${esc(triggerValue)}" placeholder="e.g. Beverages or barcode">
        </div>
        <div class="form-row">
          <label>Active</label>
          <input type="checkbox" id="mod-offer-active" ${active ? 'checked' : ''}>
        </div>
      </div>
    `, async () => {
      const data = {
        store_id: sid,
        type: 'offer',
        title: $('mod-offer-title').value,
        image_data: $('mod-offer-image').value || null,
        trigger_type: $('mod-offer-trigger-type').value || null,
        trigger_value: $('mod-offer-trigger-value').value || null,
        active: $('mod-offer-active').checked
      }
      try {
        if (isEdit) await API.updatePromotion(existing.id, data)
        else await API.createPromotion(data)
        closeModal()
        loadPromoOffersList(sid)
        showToast('Offer saved!')
      } catch (err) { showToast('Error: ' + err.message) }
    })
    $('modal-confirm').textContent = 'Save Offer'

    const imgInput = $('mod-offer-image-input')
    const imgHidden = $('mod-offer-image')
    const imgPreview = $('mod-offer-image-preview')
    const imgRemove = $('mod-offer-image-remove')

    imgInput.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return
      const reader = new FileReader()
      reader.onload = async ev => {
        try {
          const cropped = await window.cropImage(ev.target.result, 400/200, 400, 200)
          imgHidden.value = cropped
          imgPreview.src = cropped
          imgPreview.classList.remove('hidden')
          imgRemove.classList.remove('hidden')
        } catch (e) { if (e.message !== 'cancelled') console.warn('Crop failed:', e) }
      }
      reader.readAsDataURL(file)
    })
    imgRemove.addEventListener('click', () => {
      imgHidden.value = ''
      imgInput.value = ''
      imgPreview.classList.add('hidden')
      imgRemove.classList.add('hidden')
    })
  }

  window.adminEditOffer = async (id) => {
    try {
      const promo = await API.getPromotion(id)
      adminOpenOfferModal(promo, null)
    } catch (err) { showToast('Error: ' + err.message) }
  }

  window.adminDeleteOffer = async (id) => {
    showModal('Delete Offer', 'Delete this offer?', async () => {
      await API.deletePromotion(id)
      closeModal()
      if (_promoStoreId) loadPromoOffersList(_promoStoreId)
    }, true)
  }

  // ─── Discount Items ───
  let _discStoreId = null

  async function loadDiscounts() {
    _discStoreId = null
    $('disc-editor').classList.add('hidden')
    try { stores = await API.getStores() } catch { stores = [] }
    if (stores.length === 0) { $('disc-stores-table').innerHTML = '<div class="empty-state">No stores yet.</div>'; return }
    let html = '<table><thead><tr><th>Store</th><th>Slug</th><th>Items</th><th></th></tr></thead><tbody>'
    for (const s of stores) {
      let items = []
      try { items = await API.getDiscounts(s.id) } catch {}
      html += `<tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td class="meta">/${esc(s.slug)}</td>
        <td>${items.length}</td>
        <td class="actions-cell"><button class="btn small" onclick="openDiscountEditor('${s.id}')">Manage</button></td>
      </tr>`
    }
    $('disc-stores-table').innerHTML = html + '</tbody></table>'
  }

  window.openDiscountEditor = async (storeId) => {
    _discStoreId = storeId
    const store = stores.find(s => s.id === storeId)
    $('disc-editor-title').textContent = store ? esc(store.name) + ' — Discounts' : 'Discounts'
    $('disc-stores-table').style.display = 'none'
    $('disc-editor').classList.remove('hidden')
    await loadDiscountItemsList(storeId)
  }

  $('disc-editor-back').onclick = () => {
    _discStoreId = null
    $('disc-editor').classList.add('hidden')
    $('disc-stores-table').style.display = ''
    loadDiscounts()
  }

  async function loadDiscountItemsList(storeId) {
    const list = $('disc-list')
    try {
      const items = await API.getDiscounts(storeId)
      if (items.length === 0) { list.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div class="empty-state">No discount items yet.</div><button id="btn-disc-add-first" class="btn small">+ New Discount</button></div>'; wireDiscAddFirst(); return }
      let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div></div><button id="btn-disc-add-top" class="btn small">+ New Discount</button></div>'
      html += '<div class="table-wrap"><table><thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Featured</th><th>Active</th><th></th></tr></thead><tbody>'
      for (const d of items) {
        const thumb = d.image_data ? `<img src="${esc(d.image_data)}" class="offer-thumb" alt="">` : '<span class="offer-thumb offer-thumb-empty"></span>'
        const priceHtml = `<span style="text-decoration:line-through;color:var(--text-tertiary);font-size:var(--text-xs)">${parseFloat(d.original_price).toFixed(2)}</span> <strong style="color:var(--color-success)">${parseFloat(d.new_price).toFixed(2)}</strong>`
        html += `<tr>
          <td>${thumb}</td>
          <td><strong>${esc(d.name)}</strong>${d.barcode ? '<br><span class="meta" style="font-size:11px">' + esc(d.barcode) + '</span>' : ''}</td>
          <td class="meta">${esc(d.category || '—')}</td>
          <td style="white-space:nowrap">${priceHtml}${d.discount_percent ? ' <span class="tag danger" style="font-size:10px">-' + d.discount_percent + '%</span>' : ''}</td>
          <td>${d.featured ? '<span style="color:var(--color-warning)">★</span>' : '—'}</td>
          <td>${d.active ? '<span style="color:var(--color-success)">✓</span>' : '<span style="color:var(--text-disabled)">○</span>'}</td>
          <td class="actions-cell" style="display:flex;gap:4px">
            <button class="btn small" onclick="adminEditDiscount('${d.id}')">Edit</button>
            <button class="btn small danger" onclick="adminDeleteDiscount('${d.id}')">Delete</button>
          </td>
        </tr>`
      }
      list.innerHTML = html + '</tbody></table></div>'
      $('btn-disc-add-top').onclick = () => adminOpenDiscountModal(null, storeId)
    } catch { list.innerHTML = '<div class="empty-state">Could not load discounts.</div>' }
  }

  function wireDiscAddFirst() {
    const btn = $('btn-disc-add-first')
    if (btn) btn.onclick = () => adminOpenDiscountModal(null, _discStoreId)
  }

  window.adminOpenDiscountModal = (existing, storeId) => {
    const isEdit = !!existing
    const sid = storeId || (existing ? existing.store_id : _discStoreId)
    const name = existing ? existing.name || '' : ''
    const barcode = existing ? existing.barcode || '' : ''
    const category = existing ? existing.category || '' : ''
    const imageData = existing ? existing.image_data || '' : ''
    const origPrice = existing ? existing.original_price || '' : ''
    const newPrice = existing ? existing.new_price || '' : ''
    const discPercent = existing ? existing.discount_percent || '' : ''
    const featured = existing ? !!existing.featured : false
    const active = existing ? !!existing.active : true
    const discType = existing && existing.discount_percent ? 'percent' : 'fixed'

    showModal(isEdit ? 'Edit Discount' : 'New Discount', `
      <div class="form">
        <div class="form-row">
          <label>Barcode (optional, for scan matching)</label>
          <input id="mod-disc-barcode" class="form-input" value="${esc(barcode)}" placeholder="e.g. 5901234123457">
        </div>
        <div class="form-row">
          <label>Product Name</label>
          <input id="mod-disc-name" class="form-input" value="${esc(name)}" placeholder="e.g. Organic Honey">
        </div>
        <div class="form-row">
          <label>Product Photo</label>
          <div class="logo-picker">
            <input type="file" id="mod-disc-image-input" accept="image/png,image/jpeg,image/webp" capture="environment">
            <input type="hidden" id="mod-disc-image" value="${esc(imageData)}">
            <img id="mod-disc-image-preview" class="logo-preview ${imageData ? '' : 'hidden'}" src="${esc(imageData)}">
            <button id="mod-disc-image-remove" class="btn small ${imageData ? '' : 'hidden'}" type="button">Remove</button>
          </div>
        </div>
        <div class="form-row">
          <label>Category (for scan matching)</label>
          <input id="mod-disc-category" class="form-input" value="${esc(category)}" placeholder="e.g. Beverages">
        </div>
        <div class="form-row">
          <label>Original Price (DA)</label>
          <input id="mod-disc-orig-price" type="number" step="0.01" min="0" class="form-input" value="${esc(origPrice)}" placeholder="e.g. 12.99">
        </div>
        <div class="form-row">
          <label>Discount Type</label>
          <select id="mod-disc-type" class="form-input">
            <option value="percent" ${discType === 'percent' ? 'selected' : ''}>Percentage off</option>
            <option value="fixed" ${discType === 'fixed' ? 'selected' : ''}>Fixed price</option>
          </select>
        </div>
        <div class="form-row" id="mod-disc-percent-row" style="${discType === 'fixed' ? 'display:none' : ''}">
          <label>Discount (%)</label>
          <input id="mod-disc-percent" type="number" step="1" min="0" max="100" class="form-input" value="${esc(discPercent)}" placeholder="e.g. 20">
        </div>
        <div class="form-row" id="mod-disc-price-row" style="${discType !== 'fixed' ? 'display:none' : ''}">
          <label>New Price (DA)</label>
          <input id="mod-disc-new-price" type="number" step="0.01" min="0" class="form-input" value="${esc(newPrice)}" placeholder="e.g. 9.99">
        </div>
        <div class="form-row" style="display:flex;gap:var(--space-4);align-items:center">
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;margin:0">
            <input type="checkbox" id="mod-disc-featured" ${featured ? 'checked' : ''}> Featured (always show)
          </label>
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;margin:0">
            <input type="checkbox" id="mod-disc-active" ${active ? 'checked' : ''}> Active
          </label>
        </div>
        <div id="mod-disc-preview" style="margin-top:8px;padding:8px;background:var(--bg-inset);border-radius:var(--radius-md);text-align:center;font-size:var(--text-sm);display:none">
          <span id="mod-disc-preview-text"></span>
        </div>
      </div>
    `, async () => {
      const origPriceVal = parseFloat($('mod-disc-orig-price').value)
      const discTypeVal = $('mod-disc-type').value
      let newPriceVal, discPercentVal
      if (discTypeVal === 'percent') {
        discPercentVal = parseFloat($('mod-disc-percent').value)
        newPriceVal = discPercentVal ? parseFloat((origPriceVal * (1 - discPercentVal / 100)).toFixed(2)) : origPriceVal
      } else {
        newPriceVal = parseFloat($('mod-disc-new-price').value)
        discPercentVal = newPriceVal && origPriceVal > 0 ? Math.round((1 - newPriceVal / origPriceVal) * 100) : null
      }
      const data = {
        store_id: sid,
        barcode: $('mod-disc-barcode').value || null,
        name: $('mod-disc-name').value,
        image_data: $('mod-disc-image').value || null,
        category: $('mod-disc-category').value || null,
        original_price: origPriceVal,
        new_price: newPriceVal || origPriceVal,
        discount_percent: discPercentVal,
        featured: $('mod-disc-featured').checked,
        active: $('mod-disc-active').checked
      }
      try {
        if (isEdit) await API.updateDiscount(existing.id, data)
        else await API.createDiscount(data)
        closeModal()
        await loadDiscountItemsList(sid)
        showToast('Discount saved!')
      } catch (err) { showToast('Error: ' + err.message); console.error('Discount save error:', err) }
    })
    $('modal-confirm').textContent = 'Save Discount'

    // Image picker with camera capture
    const imgInput = $('mod-disc-image-input')
    const imgHidden = $('mod-disc-image')
    const imgPreview = $('mod-disc-image-preview')
    const imgRemove = $('mod-disc-image-remove')
    imgInput.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return
      const reader = new FileReader()
      reader.onload = async ev => {
        try {
          const cropped = await window.cropImage(ev.target.result, 3/4, 300, 400)
          imgHidden.value = cropped
          imgPreview.src = cropped
          imgPreview.classList.remove('hidden')
          imgRemove.classList.remove('hidden')
        } catch (e) { if (e.message !== 'cancelled') console.warn('Crop failed:', e) }
      }
      reader.readAsDataURL(file)
    })
    imgRemove.addEventListener('click', () => {
      imgHidden.value = ''; imgInput.value = ''; imgPreview.classList.add('hidden'); imgRemove.classList.add('hidden')
    })

    // Price preview calculator
    const origPriceInput = $('mod-disc-orig-price')
    const discTypeSelect = $('mod-disc-type')
    const percentRow = $('mod-disc-percent-row')
    const priceRow = $('mod-disc-price-row')
    const percentInput = $('mod-disc-percent')
    const newPriceInput = $('mod-disc-new-price')
    const preview = $('mod-disc-preview')
    const previewText = $('mod-disc-preview-text')

    function updatePreview() {
      const orig = parseFloat(origPriceInput.value)
      if (!orig || orig <= 0) { preview.style.display = 'none'; return }
      let np, dp
      if (discTypeSelect.value === 'percent') {
        dp = parseFloat(percentInput.value)
        np = dp ? parseFloat((orig * (1 - dp / 100)).toFixed(2)) : orig
      } else {
        np = parseFloat(newPriceInput.value)
        dp = np && orig > 0 ? Math.round((1 - np / orig) * 100) : null
      }
      if (np && np < orig) {
        preview.style.display = 'block'
        previewText.innerHTML = `<span style="text-decoration:line-through;color:var(--text-tertiary)">${orig.toFixed(2)} DA</span> <strong style="color:var(--color-success);font-size:var(--text-lg)">${np.toFixed(2)} DA</strong>${dp ? ' <span class="tag danger" style="font-size:11px">-' + dp + '%</span>' : ''}`
      } else { preview.style.display = 'none' }
    }

    discTypeSelect.addEventListener('change', () => {
      percentRow.style.display = discTypeSelect.value === 'percent' ? '' : 'none'
      priceRow.style.display = discTypeSelect.value === 'fixed' ? '' : 'none'
      updatePreview()
    })
    origPriceInput.addEventListener('input', updatePreview)
    percentInput.addEventListener('input', updatePreview)
    newPriceInput.addEventListener('input', updatePreview)
    if (origPrice) setTimeout(updatePreview, 100)
  }

  window.adminEditDiscount = async (id) => {
    try { const item = await API.getDiscount(id); adminOpenDiscountModal(item, null) }
    catch (err) { showToast('Error: ' + err.message) }
  }

  window.adminDeleteDiscount = async (id) => {
    showModal('Delete Discount', 'Delete this discount item?', async () => {
      await API.deleteDiscount(id)
      closeModal()
      if (_discStoreId) await loadDiscountItemsList(_discStoreId)
    }, true)
  }

  function loadProfile() {
    $('prof-email').textContent = user.email
    $('prof-name').textContent = user.display_name || '—'
    $('prof-role').textContent = user.role
    $('prof-role').className = 'tag ' + user.role
    const store = stores.find(s => s.id === user.store_id)
    $('prof-store').textContent = store ? store.name : '—'
  }

  let modalCallback = null

  window.showModal = (title, body, onConfirm, danger) => {
    $('modal-overlay').classList.remove('hidden')
    $('modal-body').innerHTML = `<h3 style="margin-bottom:12px">${title}</h3>${body}`
    $('modal-confirm').textContent = danger ? 'Delete' : 'Confirm'
    $('modal-confirm').className = 'btn ' + (danger ? 'danger' : 'primary')
    modalCallback = onConfirm
    $('modal-confirm').onclick = async () => { if (modalCallback) await modalCallback() }
  }

  window.closeModal = (e) => {
    if (e && e.target !== $('modal-overlay') && e.target !== $('modal-overlay')) return
    $('modal-overlay').classList.add('hidden'); modalCallback = null
  }

  function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML }

  window.addEventListener('unhandledrejection', e => {
    console.warn('Unhandled:', e.reason);
  });

  function showToast(msg) {
    let el = document.getElementById('toast')
    if (!el) {
      el = document.createElement('div')
      el.id = 'toast'
      document.body.appendChild(el)
    }
    el.textContent = msg; el.classList.add('show')
    clearTimeout(el._h); el._h = setTimeout(() => el.classList.remove('show'), 2000)
  }

  // ─── Sidebar toggle ───
  const backdrop = $('sidebar-backdrop')
  const sidebar = $('sidebar')

  function openSidebar() { sidebar.classList.add('open'); backdrop.classList.remove('hidden') }
  function closeSidebar() { sidebar.classList.remove('open'); backdrop.classList.add('hidden') }

  $('btn-toggle-sidebar').addEventListener('click', openSidebar)
  $('btn-sidebar-close').addEventListener('click', closeSidebar)
  backdrop.addEventListener('click', closeSidebar)

  const origNavigate = navigateTo
  navigateTo = function(id) {
    origNavigate(id)
    if (window.innerWidth <= 768) closeSidebar()
  }

  // ─── Bootstrap: try CF Access auto-auth first, fall back to login ──
  ;(async function init() {
    if (!loadAuth()) {
      try {
        // If behind Cloudflare Access, exchange the identity header for a JWT
        const meta = document.querySelector('meta[name="cf-access"]')
        if (meta) {
          const res = await fetch('/api/auth/cf-access', { method: 'POST' })
          if (res.ok) {
            const data = await res.json()
            if (data.token && data.user?.role === 'admin') {
              saveAuth(data.user, data.token)
            }
          }
        }
      } catch { /* CF Access not available, fall through */ }
    }

    if (loadAuth()) {
      if (user.role !== 'admin') {
        // Non-admin token found — clear and show admin login
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        user = null
        showLoginView()
        return
      }
      API.getStores().then(s => { stores = s }).catch(() => {})
      routeDash()
    } else {
      showLoginView()
    }
  })()
})()
