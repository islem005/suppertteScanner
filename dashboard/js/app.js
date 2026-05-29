(function() {
  if (typeof feather !== 'undefined') feather.replace()
  let user = null, stores = []

  const navItems = [
    { id: 'overview',  icon: 'bar-chart-2', labelKey: 'navOverview' },
    { id: 'products',  icon: 'package', labelKey: 'navProducts' },
    { id: 'branding',  icon: 'droplet', labelKey: 'navBranding' },
    { id: 'activity',  icon: 'clock', labelKey: 'navActivity' },
    { id: 'profile',   icon: 'user', labelKey: 'navProfile' },
  ]

  const $ = (id)     => { const e = document.getElementById(id); if (!e) console.warn('Missing #'+id); return e }
  const qs = (s, p)  => (p||document).querySelector(s)

  // ─── Storage ───
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
  function logout() { localStorage.removeItem('token'); localStorage.removeItem('user'); user = null; window.location.href = '/auth/' }

  // ─── View routing ───
  function showView(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id)) }
  function showDashView(id) {
    document.querySelectorAll('.dash-view').forEach(v => v.classList.toggle('active', v.id === 'view-' + id))
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === id))
    if (id === 'overview') loadManagerOverview()
    else if (id === 'products') loadManagerProducts()
    else if (id === 'branding') loadBranding()
    else if (id === 'activity') loadActivity()
    else if (id === 'profile') loadProfile()
  }

  function buildNav(items) {
    const nav = $('sidebar-nav'); nav.innerHTML = ''
    items.forEach(item => {
      const btn = document.createElement('button')
      btn.className = 'nav-item'; btn.dataset.view = item.id
      btn.innerHTML = `<i data-feather="${item.icon}"></i> ${item.labelKey ? I18N.t(item.labelKey) : item.label}`
      btn.onclick = () => showDashView(item.id)
      nav.appendChild(btn)
    })
    navItems.length = 0; navItems.push(...items)
    if (typeof feather !== 'undefined') feather.replace()
  }

  function routeDash() {
    showView('view-dash')
    buildNav(navItems)
    $('sidebar-username').textContent = user.display_name || user.email
    I18N.applyHtml()
    showDashView('overview')
  }

  $('btn-logout').addEventListener('click', logout)

  // ─── Branding ───
  async function loadBranding() {
    if (user.store_id) loadBrandingForm(user.store_id)
  }

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
    } catch { /* defaults */ }
    updateBrandPreview()
  }

  function updateBrandPreview() {
    const name = $('brand-name').value || 'Your Store'
    const logo = $('brand-logo').value
    const primary = $('brand-primary').value || '#6366f1'
    const accent = $('brand-accent').value || '#10b981'
    const mockup = $('brand-mockup')
    if (!mockup) return

    const titleEl = $('preview-title')
    if (logo) {
      titleEl.innerHTML = '<img src="' + logo.replace(/"/g, '&quot;') + '" alt="Logo">'
    } else {
      titleEl.textContent = name
    }

    // Profile preview
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
    setSocial('preview-email', $('brand-email').value ? 'mailto:' + $('brand-email').value : '')
    setSocial('preview-phone', $('brand-phone').value ? 'tel:' + $('brand-phone').value : '')

    mockup.style.setProperty('--color-primary', primary)
    mockup.style.setProperty('--color-success', accent)
  }

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

  $('brand-primary').oninput = () => { $('brand-primary-val').textContent = $('brand-primary').value; updateBrandPreview() }
  $('brand-accent').oninput = () => { $('brand-accent-val').textContent = $('brand-accent').value; updateBrandPreview() }
  $('brand-name').oninput = updateBrandPreview
  $('brand-email').oninput = updateBrandPreview
  $('brand-phone').oninput = updateBrandPreview
  $('brand-instagram').oninput = updateBrandPreview
  $('brand-tiktok').oninput = updateBrandPreview
  $('brand-website').oninput = updateBrandPreview

  $('branding-form').addEventListener('submit', async e => {
    e.preventDefault()
    const storeId = user.store_id
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
        website_url: $('brand-website').value
      })
      $('brand-msg').textContent = 'Branding saved!'
      setTimeout(() => $('brand-msg').textContent = '', 2000)
    } catch (err) { $('brand-msg').textContent = 'Error: ' + err.message; $('brand-msg').style.color = '#ff4444' }
  })

  // ─── Activity ───
  async function loadActivity() {
    try {
      const stats = await API.getScanStats(user.store_id)
      const items = stats.topProducts || []
      if (items.length === 0) {
        $('activity-list').innerHTML = '<div class="empty-state">No scans yet.</div>'; return
      }
      $('activity-list').innerHTML = items.map(p =>
        `<div class="activity-item"><span class="act-barcode">${esc(p.barcode)}</span><span class="meta">${p.count} scans</span></div>`
      ).join('')
    } catch { $('activity-list').innerHTML = '<div class="empty-state">Could not load activity.</div>' }
  }

  // ─── Profile ───
  function loadProfile() {
    $('prof-email').textContent = user.email
    $('prof-name').textContent = user.display_name || '—'
    $('prof-role').textContent = user.role
    $('prof-role').className = 'tag ' + user.role
    const store = stores.find(s => s.id === user.store_id)
    $('prof-store').textContent = store ? store.name : '—'
    I18N.applyHtml()
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === I18N.getLang()))
  }

  document.querySelectorAll('.lang-btn').forEach(b => b.addEventListener('click', () => {
    I18N.setLang(b.dataset.lang)
    location.reload()
  }))

  // ══════════════════════════════════════════════
  //  MANAGER VIEWS
  // ══════════════════════════════════════════════

  async function loadManagerOverview() {
    if (!user.store_id) {
      $('ov-cards').innerHTML = '<div class="empty-state">No store assigned. Contact an admin.</div>'
      $('ov-store-table').innerHTML = ''
      return
    }
    try {
      const store = await API.getStore(user.store_id)
      const s = await API.getScanStats(user.store_id)
      const products = await API.getProducts(user.store_id)

      $('ov-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      $('ov-cards').innerHTML = `
        <div class="stat-card"><span class="num">${s.total}</span><span class="label">Total Scans</span></div>
        <div class="stat-card"><span class="num">${s.today}</span><span class="label">Today</span></div>
        <div class="stat-card"><span class="num">${products.length}</span><span class="label">Products</span></div>
      `
      const topHtml = (s.topProducts || []).map(p => `<div class="activity-item"><span class="act-barcode">${esc(p.barcode)}</span><span class="meta">${p.count} scans</span></div>`).join('')
      $('ov-store-table').innerHTML = `<header class="view-header" style="margin-top:16px"><h3 style="font-size:16px">Top Scanned Products</h3><a href="/${esc(store.slug)}" target="_blank" class="btn small">Public Link ↗</a></header>` +
        (topHtml || '<div class="empty-state">No scans yet</div>')
    } catch { $('ov-cards').innerHTML = '<div class="empty-state">Could not load overview.</div>' }
  }

  // ─── Products (manager) ───
  let allProducts = []

  async function loadManagerProducts() {
    allProducts = await API.getProducts(user.store_id)
    renderProducts(allProducts)
  }

  function renderProducts(list) {
    if (list.length === 0 && allProducts.length === 0) { $('product-list').innerHTML = '<div class="empty-state">No products. Upload a CSV to get started.</div>'; return }
    if (list.length === 0) { $('product-list').innerHTML = '<div class="empty-state">No products match your search.</div>'; return }
    let html = '<table><thead><tr><th>Barcode</th><th>Name</th><th>Price</th><th>Category</th><th></th></tr></thead><tbody>'
    for (const p of list) html += `<tr><td class="meta" style="font-family:monospace">${esc(p.barcode)}</td><td><strong>${esc(p.name)}</strong></td><td>${parseFloat(p.price).toFixed(2)} DA</td><td class="meta">${esc(p.category||'—')}</td><td class="actions-cell"><button class="btn small danger" onclick="deleteProduct('${p.id}')">✕</button></td></tr>`
    $('product-list').innerHTML = html + '</tbody></table>'
  }

  $('product-search').oninput = () => {
    const q = $('product-search').value.toLowerCase().trim()
    if (!q) return renderProducts(allProducts)
    renderProducts(allProducts.filter(p =>
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q))
    ))
  }

  // ─── Upload Data (imports) ───
  async function checkMappingAndPrompt() {
    try {
      const mapping = await API.getMapping(user.store_id)
      return mapping
    } catch { return null }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1] || reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  $('btn-upload-csv').onclick = () => $('csv-file').click()
  $('csv-file').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    const supported = ['csv', 'xlsx', 'xls', 'db', 'sqlite', 'sqlite3', 'json']

    if (!supported.includes(ext)) {
      showToast('Unsupported format: .' + ext + '. Use CSV, XLSX, DB, or JSON')
      e.target.value = ''
      return
    }

    try {
      const content = ext === 'csv' ? btoa(unescape(encodeURIComponent(await file.text()))) : await readFileAsBase64(file)
      const result = await API.uploadImport(content, file.name)

      if (result.status === 'auto-mapped' && result.requires_confirmation) {
        // Show verification preview
        const preview = result.preview
        const mapped = preview.mapped_preview

        let previewHtml = '<div style="margin-bottom:12px;font-size:var(--text-sm)">' +
          '<div style="color:var(--text-secondary);margin-bottom:8px">We mapped your file using the saved configuration:</div>' +
          `<div style="margin-bottom:4px"><span class="meta" style="font-size:12px">Barcode</span> ← <strong>${esc(preview.mapping_used.barcode)}</strong></div>` +
          `<div style="margin-bottom:4px"><span class="meta" style="font-size:12px">Name</span> ← <strong>${esc(preview.mapping_used.name)}</strong></div>` +
          `<div style="margin-bottom:4px"><span class="meta" style="font-size:12px">Price</span> ← <strong>${esc(preview.mapping_used.price)}</strong></div>` +
          '</div>'

        if (mapped && mapped.length > 0) {
          previewHtml += '<div class="mapping-preview-card" style="background:var(--bg-inset);border-radius:8px;padding:12px;margin-bottom:8px">'
          previewHtml += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">First product preview:</div>'
          previewHtml += `<div class="row" style="display:flex;gap:8px;padding:4px 0"><span class="label" style="color:var(--text-secondary);min-width:60px">Barcode:</span><span class="value" style="font-family:monospace">${esc(mapped[0].barcode || '—')}</span></div>`
          previewHtml += `<div class="row" style="display:flex;gap:8px;padding:4px 0"><span class="label" style="color:var(--text-secondary);min-width:60px">Name:</span><span class="value">${esc(mapped[0].name || '—')}</span></div>`
          previewHtml += `<div class="row" style="display:flex;gap:8px;padding:4px 0"><span class="label" style="color:var(--text-secondary);min-width:60px">Price:</span><span class="value">${esc(mapped[0].price || '—')} DA</span></div>`
          previewHtml += '</div>'
          previewHtml += `<div style="font-size:var(--text-sm);color:var(--text-secondary)">and ${result.row_count - 1} more products</div>`
        }

        showModal('Verify Import', previewHtml, async () => {
          try {
            const r = await API.confirmImport(result.id)
            showToast(`${r.imported} products imported!`)
            loadManagerProducts()
          } catch (err) { showToast('Error: ' + err.message) }
        })
        $('modal-confirm').textContent = 'Looks good, import ✓'
        $('modal-confirm').className = 'btn primary'
      } else if (result.status === 'pending' && result.requires_admin) {
        showToast('File submitted to admin for mapping review.')
      } else {
        showToast('File uploaded (status: ' + result.status + ')')
      }
    } catch (err) { showToast('Error: ' + err.message) }
    e.target.value = ''
  }

  window.deleteProduct = async (id) => {
    await API.deleteProduct(id); loadManagerProducts()
  }

  // ══════════════════════════════════════════════
  //  MODAL
  // ══════════════════════════════════════════════

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

  window.addEventListener('unhandledrejection', e => {
    console.warn('Unhandled:', e.reason);
  });

  // ─── Helpers ───
  function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML }

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

  // Close sidebar on nav click (mobile)
  const origShowDash = showDashView
  showDashView = function(id) {
    origShowDash(id)
    if (window.innerWidth <= 768) closeSidebar()
  }

  // ─── Init ───
  ;(async function init() {
    if (loadAuth()) {
      if (user.store_id) {
        try { await API.getStore(user.store_id) } catch { logout() }
      }
      if (user) {
        API.getStores().then(s => { stores = s }).catch(() => {})
        routeDash()
        return
      }
    }
    window.location.href = '/auth/'
  })()
})()
