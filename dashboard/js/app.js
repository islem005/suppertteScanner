(function() {
  let user = null, stores = []

  function getNavItems(role) {
    const base = [
      { id: 'products',  icon: 'package', labelKey: 'navProducts' },
      { id: 'offers',    icon: 'gift', labelKey: 'navOffers' },
      { id: 'discounts', icon: 'tag', labelKey: 'navDiscounts' },
      { id: 'profile',   icon: 'user', labelKey: 'navProfile' },
    ]
    if (role === 'manager' || role === 'admin') {
      base.unshift({ id: 'overview',  icon: 'bar-chart-2', labelKey: 'navOverview' })
      base.splice(2, 0, { id: 'analytics', icon: 'trending-up', labelKey: 'navAnalytics' })
      base.splice(5, 0, { id: 'activity',  icon: 'clock', labelKey: 'navActivity' })
      base.splice(6, 0, { id: 'branding',  icon: 'droplet', labelKey: 'navBranding' })
      base.splice(7, 0, { id: 'categories', icon: 'layers', labelKey: 'navCategories' })
      base.push({ id: 'team', icon: 'users', labelKey: 'navTeam' })
      base.push({ id: 'audit', icon: 'clipboard', labelKey: 'navAuditLog' })
    }
    return base
  }

  let navItems = []

  const $ = (id)     => { if (typeof document === 'undefined' || typeof document.getElementById !== 'function') { console.error('DOM not available'); return null }; const e = document.getElementById(id); if (!e) console.warn('Missing #'+id); return e }
  const qs = (s, p)  => (p||document).querySelector(s)

  // ─── Auth (cookie-based via Better Auth) ───
  function saveUser(u) { user = u; localStorage.setItem('user', JSON.stringify(u)) }
  function loadUser() {
    const r = localStorage.getItem('user')
    if (r) { try { user = JSON.parse(r); return true } catch {} }
    return false
  }
  async function checkSession() {
    // Verify session is still valid
    try {
      const res = await fetch('/api/auth/get-session', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.user) { user = data.user; localStorage.setItem('user', JSON.stringify(data.user)); return true }
      }
    } catch {}
    localStorage.removeItem('user')
    user = null
    return false
  }
  function logout() {
    fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': 'skaner-csrf-token' } }).catch(() => {})
    localStorage.removeItem('user')
    user = null
    window.location.href = '/auth/'
  }

  // ─── View routing ───
  function showView(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id)) }
  function showDashView(id) {
    document.querySelectorAll('.dash-view').forEach(v => v.classList.toggle('active', v.id === 'view-' + id))
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === id))
    if (id === 'overview') loadManagerOverview()
    else if (id === 'analytics') loadAnalytics()
    else if (id === 'products') loadManagerProducts()
    else if (id === 'offers') loadOffers()
    else if (id === 'discounts') loadDiscounts()
    else if (id === 'branding') loadBranding()
    else if (id === 'categories') loadCategories()
    else if (id === 'activity') loadActivity()
    else if (id === 'team') loadTeam()
    else if (id === 'audit') loadAuditLog()
    else if (id === 'profile') loadProfile()
    window.scrollTo(0, 0)
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
      btn.innerHTML = `<i data-feather="${item.icon}"></i> ${item.labelKey ? I18N.t(item.labelKey) : item.label}`
      btn.onclick = () => navigateTo(item.id)
      nav.appendChild(btn)
    })
    navItems.length = 0; navItems.push(...items)
    if (typeof feather !== 'undefined') feather.replace()
  }

  function routeDash() {
    showView('view-dash')
    navItems = getNavItems(user.role)
    buildNav(navItems)
    $('sidebar-username').textContent = user.display_name || user.email
    I18N.applyHtml()
    const initial = location.hash.replace('#', '') || 'overview'
    if (navItems.some(i => i.id === initial)) showDashView(initial)
    else showDashView('overview')
  }

  const btnLogout = $('btn-logout')
  if (btnLogout) btnLogout.addEventListener('click', logout)
  else console.warn('Missing #btn-logout — check dashboard HTML')

  // ─── Branding ───
  async function loadBranding() {
    if (user.store_id) {
      loadBrandingForm(user.store_id)
      generateStoreQR()
    }
  }

  async function generateStoreQR() {
    const canvas = $('dash-qr-canvas')
    const urlEl = $('dash-qr-url')
    const btnPng = $('btn-dash-download-qr')
    const btnSvg = $('btn-dash-download-qr-svg')
    if (!canvas || !user.store_id) return
    try {
      const store = await API.getStore(user.store_id)
      const url = 'https://' + store.slug + '.ivond.com'
      urlEl.textContent = url
      await QRCode.toCanvas(canvas, url, { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      btnPng.onclick = function() {
        var link = document.createElement('a')
        link.download = store.slug + '-qr.png'
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      btnSvg.onclick = function() {
        QRCode.toString(url, { type: 'svg', width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } }).then(function(svg) {
          var blob = new Blob([svg], { type: 'image/svg+xml' })
          var link = document.createElement('a')
          link.download = store.slug + '-qr.svg'
          link.href = URL.createObjectURL(blob)
          link.click()
          URL.revokeObjectURL(link.href)
        })
      }
    } catch { urlEl.textContent = I18N.t('couldNotLoad') }
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
      $('brand-facebook').value = b.facebook_url || ''
      $('brand-twitter').value = b.twitter_url || ''
      $('brand-youtube').value = b.youtube_url || ''
    } catch { /* defaults */ }
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
    if (e.target.files[0]) { readLogoFile(e.target.files[0]) }
  })

  $('brand-logo-remove').addEventListener('click', () => {
    $('brand-logo').value = ''
    $('brand-logo-input').value = ''
    $('brand-logo-preview').classList.add('hidden')
    $('brand-logo-remove').classList.add('hidden')
  })

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
        website_url: $('brand-website').value,
        facebook_url: $('brand-facebook').value,
        twitter_url: $('brand-twitter').value,
        youtube_url: $('brand-youtube').value
      })
      $('brand-msg').textContent = I18N.t('brandingSaved')
      setTimeout(() => $('brand-msg').textContent = '', 2000)
    } catch (err) { $('brand-msg').textContent = I18N.t('errorPrefix') + err.message; $('brand-msg').style.color = '#ff4444' }
  })

  // ─── Activity ───
  async function loadActivity() {
    $('activity-list').innerHTML = '<div class="loading-spinner">' + I18N.t('loading') + '</div>'
    try {
      const stats = await API.getScanStats(user.store_id)
      const items = stats.topProducts || []
      if (items.length === 0) {
        $('activity-list').innerHTML = '<div class="empty-state">' + I18N.t('noScansYet') + '</div>'; return
      }
      $('activity-list').innerHTML = items.map(p =>
        `<div class="activity-item"><span class="act-barcode">${esc(p.barcode)}</span><span class="meta">${p.count} ${I18N.t('scans')}</span></div>`
      ).join('')
    } catch { $('activity-list').innerHTML = '<div class="empty-state">' + I18N.t('couldNotLoadActivity') + ' <button class="btn small" onclick="loadActivity()">' + I18N.t('retry') + '</button></div>' }
  }

  // ─── Analytics ───
  async function loadAnalytics() {
    const days = ($('an-days-filter') && $('an-days-filter').value) || 30
    $('an-cards').innerHTML = '<div class="loading-spinner">' + I18N.t('loading') + '</div>'
    try {
      const data = await API.getAnalytics(days)
      const p = data.platform
      $('an-cards').innerHTML = `
        <div class="stat-card"><span class="num">${p.totalDevices}</span><span class="label">Devices</span></div>
        <div class="stat-card"><span class="num">${p.devicesToday}</span><span class="label">Active Today</span></div>
        <div class="stat-card"><span class="num">${p.totalVisits}</span><span class="label">Total Visits</span></div>
        <div class="stat-card"><span class="num">${p.visitsToday}</span><span class="label">Visits Today</span></div>
        <div class="stat-card"><span class="num">${p.totalScans}</span><span class="label">Total Scans</span></div>
        <div class="stat-card"><span class="num">${p.scansToday}</span><span class="label">Scans Today</span></div>
        <div class="stat-card"><span class="num">${p.hitRate}%</span><span class="label">Hit Rate</span></div>
        <div class="stat-card"><span class="num">${p.avgScansPerVisit}</span><span class="label">Scans/Visit</span></div>
      `
      renderTrendChart('an-trend-chart', data.dailyTrend)
      renderTopProducts('an-top-products', data.topProducts)
    } catch (err) {
      $('an-cards').innerHTML = '<div class="empty-state">Could not load analytics: ' + esc(err.message) + ' <button class="btn small" onclick="loadAnalytics()">' + I18N.t('retry') + '</button></div>'
    }
  }

  function renderTrendChart(containerId, data) {
    const el = $(containerId)
    if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state">No data yet</div>'; return }
    const maxVisits = Math.max(...data.map(d => d.visits), 1)
    const maxScans = Math.max(...data.map(d => d.scans), 1)
    const maxVal = Math.max(maxVisits, maxScans)
    const barWidth = Math.max(8, Math.min(24, Math.floor(500 / data.length)))
    const chartW = Math.max(300, data.length * (barWidth + 4) + 40)
    const chartH = 120
    const padL = 30, padR = 10, padT = 8, padB = 20
    const innerH = chartH - padT - padB
    let svg = `<svg viewBox="0 0 ${chartW} ${chartH}" style="width:100%;max-height:140px" xmlns="http://www.w3.org/2000/svg">`
    for (let i = 0; i <= 4; i++) {
      const y = padT + (innerH / 4) * i
      svg += `<line x1="${padL}" y1="${y}" x2="${chartW - padR}" y2="${y}" stroke="var(--border-strong)" stroke-width="1"/>`
    }
    data.forEach((d, i) => {
      const x = padL + i * (barWidth + 4)
      const vH = (d.visits / maxVal) * innerH
      const sH = (d.scans / maxVal) * innerH
      svg += `<rect x="${x}" y="${padT + innerH - vH}" width="${barWidth}" height="${vH}" fill="var(--color-primary)" rx="2" opacity="0.8"><title>${d.date}: ${d.visits} visits</title></rect>`
      const sx = x + barWidth * 0.5
      const sw = Math.max(4, barWidth * 0.4)
      svg += `<rect x="${sx}" y="${padT + innerH - sH}" width="${sw}" height="${sH}" fill="var(--color-success)" rx="2" opacity="0.8"><title>${d.date}: ${d.scans} scans</title></rect>`
    })
    const step = Math.max(1, Math.floor(data.length / 8))
    data.forEach((d, i) => {
      if (i % step === 0 || i === data.length - 1) {
        svg += `<text x="${padL + i * (barWidth + 4) + barWidth / 2}" y="${chartH - 4}" text-anchor="middle" fill="var(--text-tertiary)" font-size="9">${d.date.slice(5)}</text>`
      }
    })
    svg += `<rect x="${chartW - 80}" y="2" width="8" height="8" fill="var(--color-primary)" rx="1"/><text x="${chartW - 68}" y="9" fill="var(--text-secondary)" font-size="9">Visits</text>`
    svg += `<rect x="${chartW - 40}" y="2" width="8" height="8" fill="var(--color-success)" rx="1"/><text x="${chartW - 28}" y="9" fill="var(--text-secondary)" font-size="9">Scans</text>`
    svg += '</svg>'
    el.innerHTML = svg
  }

  function renderTopProducts(containerId, data) {
    const el = $(containerId)
    if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state">No scan data yet</div>'; return }
    let html = '<table><thead><tr><th>#</th><th>Barcode</th><th>Name</th><th>Scans</th></tr></thead><tbody>'
    data.forEach((p, i) => {
      html += `<tr><td>${i + 1}</td><td class="meta" style="font-family:monospace">${esc(p.barcode)}</td><td><strong>${esc(p.name || '—')}</strong></td><td>${p.count}</td></tr>`
    })
    el.innerHTML = html + '</tbody></table>'
  }

  // Filter change handlers
  if ($('an-days-filter')) $('an-days-filter').addEventListener('change', loadAnalytics)
  if ($('btn-an-export')) $('btn-an-export').addEventListener('click', () => {
    const days = ($('an-days-filter') && $('an-days-filter').value) || 30
    API.exportAnalytics(days)
  })

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

  $('btn-change-pass').addEventListener('click', async () => {
    const form = $('view-profile')
    clearFieldErrors(form)
    const current = $('prof-current-pass').value
    const password = $('prof-new-pass').value
    const msg = $('prof-pass-msg')
    let hasError = false
    if (!current) { showFieldError($('prof-current-pass'), 'Current password is required'); hasError = true }
    if (!password) { showFieldError($('prof-new-pass'), 'New password is required'); hasError = true }
    if (hasError) return
    if (password.length < 6) { showFieldError($('prof-new-pass'), 'Password must be at least 6 characters'); return }
    try {
      await API.changePassword(current, password)
      msg.textContent = 'Password updated successfully'; msg.style.color = '#00c875'
      $('prof-current-pass').value = ''; $('prof-new-pass').value = ''
    } catch (err) { msg.textContent = err.message; msg.style.color = '#ff4444' }
  })

  // ─── Categories ───
  function catDisplayName(cat) {
    const lang = I18N.getLang()
    return cat[`name_${lang}`] || cat.name || ''
  }

  let categoriesList = []

  async function loadCategories() {
    const t = (k) => I18N.t(k)
    $('category-list').innerHTML = '<div class="loading-spinner">Loading...</div>'
    try {
      categoriesList = await API.getCategories(user.store_id)
    } catch {
      categoriesList = []
    }
    if (categoriesList.length === 0) {
      $('category-list').innerHTML = '<div class="empty-state">' + t('categories') + '</div>'
      return
    }
    let html = '<table><thead><tr><th>' + t('categoryName') + '</th><th>English</th><th>Français</th><th>العربية</th><th>' + t('sortOrder') + '</th><th></th></tr></thead><tbody>'
    for (const c of categoriesList) {
      const typeLabel = c.global ? t('categoryGlobal') : t('categoryCustom')
      const typeClass = c.global ? 'tag' : 'tag'
      const editBtn = `<button class="btn small" onclick="editCategory('${c.id}')">${t('edit')}</button>`
      const delBtn = c.global ? '' : `<button class="btn small danger" onclick="deleteCategory('${c.id}')">${t('delete')}</button>`
      html += `<tr>
        <td><strong>${esc(catDisplayName(c))}</strong> <span class="${typeClass}" style="font-size:10px;opacity:0.6">${typeLabel}</span></td>
        <td class="meta">${esc(c.name_en || '—')}</td>
        <td class="meta">${esc(c.name_fr || '—')}</td>
        <td class="meta">${esc(c.name_ar || '—')}</td>
        <td class="meta">${c.sort_order}</td>
        <td class="actions-cell" style="display:flex;gap:4px">${editBtn}${delBtn}</td>
      </tr>`
    }
    $('category-list').innerHTML = html + '</tbody></table>'
  }

  $('btn-add-category') && ($('btn-add-category').onclick = () => openCategoryModal(null))

  function openCategoryModal(existing) {
    const isEdit = !!existing
    const name = existing ? existing.name || '' : ''
    const name_en = existing ? existing.name_en || '' : ''
    const name_fr = existing ? existing.name_fr || '' : ''
    const name_ar = existing ? existing.name_ar || '' : ''
    const sort_order = existing ? existing.sort_order || 0 : 0

    showModal(isEdit ? I18N.t('editCategory') : I18N.t('addCategory'), `
      <div class="form">
        <div class="form-row">
          <label>${I18N.t('categoryName')}</label>
          <input id="mod-cat-name" class="form-input" value="${esc(name)}" placeholder="e.g. Dairy">
        </div>
        <div class="form-row">
          <label>English</label>
          <input id="mod-cat-name-en" class="form-input" value="${esc(name_en)}" placeholder="English name">
        </div>
        <div class="form-row">
          <label>Fran\u00e7ais</label>
          <input id="mod-cat-name-fr" class="form-input" value="${esc(name_fr)}" placeholder="Nom en fran\u00e7ais">
        </div>
        <div class="form-row">
          <label>العربية</label>
          <input id="mod-cat-name-ar" class="form-input" value="${esc(name_ar)}" placeholder="الاسم بالعربية">
        </div>
        <div class="form-row">
          <label>${I18N.t('sortOrder')}</label>
          <input id="mod-cat-sort" type="number" step="1" min="0" class="form-input" value="${sort_order}">
        </div>
      </div>
    `, async () => {
      const data = {
        store_id: user.store_id,
        name: $('mod-cat-name').value.trim(),
        name_en: $('mod-cat-name-en').value.trim() || null,
        name_fr: $('mod-cat-name-fr').value.trim() || null,
        name_ar: $('mod-cat-name-ar').value.trim() || null,
        sort_order: parseInt($('mod-cat-sort').value) || 0
      }
      if (!data.name) { showToast(I18N.t('errorPrefix') + 'Name is required'); return }
      try {
        if (isEdit) await API.updateCategory(existing.id, data)
        else await API.createCategory(data)
        closeModal()
        await loadCategories()
        showToast(I18N.t('categorySaved'))
      } catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
    })
    $('modal-confirm').textContent = isEdit ? I18N.t('save') : I18N.t('addCategory')
  }

  window.editCategory = async (id) => {
    const c = categoriesList.find(x => x.id === id)
    if (c) openCategoryModal(c)
  }

  window.deleteCategory = async (id) => {
    const c = categoriesList.find(x => x.id === id)
    if (c && c.global) { showToast(I18N.t('deleteGlobalForbidden')); return }
    showModal(I18N.t('deleteCategory'), I18N.t('deleteCategoryConfirm'), async () => {
      try {
        await API.deleteCategory(id)
        closeModal()
        await loadCategories()
        showToast(I18N.t('categoryDeleted'))
      } catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
    }, true)
  }

  // ─── Category dropdown builder (for product/discount forms) ───
  let _cachedCategories = {}

  async function populateCategoryDropdown(selectId, buttonId, selected, storeId) {
    const select = $(selectId)
    if (!select) return
    // Cache categories per store
    if (!_cachedCategories[storeId]) {
      try { _cachedCategories[storeId] = await API.getCategories(storeId) } catch { _cachedCategories[storeId] = [] }
    }
    const cats = _cachedCategories[storeId]
    select.innerHTML = '<option value="">—</option>'
    for (const c of cats) {
      const opt = document.createElement('option')
      opt.value = c.name
      opt.textContent = catDisplayName(c)
      if (c.name === selected) opt.selected = true
      select.appendChild(opt)
    }
    // Wire "+" button
    const btn = $(buttonId)
    if (btn) {
      btn.onclick = () => {
        showModal(I18N.t('addCategory'), `
          <div class="form">
            <div class="form-row">
              <label>${I18N.t('categoryName')}</label>
              <input id="mod-inline-cat-name" class="form-input" placeholder="e.g. Dairy">
            </div>
          </div>
        `, async () => {
          const name = $('mod-inline-cat-name').value.trim()
          if (!name) { showToast(I18N.t('errorPrefix') + 'Name is required'); return }
          const lang = I18N.getLang()
          const trans = {}
          trans[`name_${lang}`] = name
          trans.name = name
          trans.store_id = storeId
          try {
            await API.createCategory(trans)
            // Refresh cache and re-populate
            _cachedCategories[storeId] = await API.getCategories(storeId)
            populateCategoryDropdown(selectId, buttonId, name, storeId)
            closeModal()
            showToast(I18N.t('categorySaved'))
          } catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
        })
        $('modal-confirm').textContent = I18N.t('addCategory')
      }
    }
  }

  // ─── Shared barcode scanner overlay ───
  function startBarcodeScanner(onDetected) {
    let active = true, lastResults = [], lastResultTime = 0
    const SCAN_THROTTLE = 1200

    const overlay = document.createElement('div')
    overlay.id = 'scanner-overlay'

    const style = document.createElement('style')
    style.textContent = '#scanner-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#000;display:flex;flex-direction:column}#scanner-overlay .scanner-video-wrap{flex:1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}#scanner-overlay video{width:100%;height:100%;object-fit:cover}#scanner-overlay .scanner-frame{position:absolute;width:75%;max-width:320px;aspect-ratio:2/1;top:50%;left:50%;transform:translate(-50%,-50%)}#scanner-overlay .scanner-corner{position:absolute;width:24px;height:24px;border-color:#fff;border-style:solid}#scanner-overlay .scanner-corner-tl{top:0;left:0;border-width:3px 0 0 3px;border-radius:4px 0 0 0}#scanner-overlay .scanner-corner-tr{top:0;right:0;border-width:3px 3px 0 0;border-radius:0 4px 0 0}#scanner-overlay .scanner-corner-bl{bottom:0;left:0;border-width:0 0 3px 3px;border-radius:0 0 0 4px}#scanner-overlay .scanner-corner-br{bottom:0;right:0;border-width:0 3px 3px 0;border-radius:0 0 4px 0}#scanner-overlay .scanner-scan-line{position:absolute;top:4px;left:6px;right:6px;height:2px;background:linear-gradient(90deg,transparent,#00c875,transparent);animation:scannerScan 2s ease-in-out infinite;box-shadow:0 0 8px rgba(0,200,117,0.5)}@keyframes scannerScan{0%,100%{top:4px}50%{top:calc(100% - 4px)}}@media(prefers-reduced-motion:reduce){#scanner-overlay .scanner-scan-line{animation:none}}#scanner-overlay .scanner-result{position:absolute;bottom:22%;left:50%;transform:translateX(-50%);color:#00c875;font-size:14px;font-family:monospace;background:rgba(0,0,0,.8);padding:6px 16px;border-radius:8px;white-space:nowrap;animation:scannerFadeIn .3s ease}@keyframes scannerFadeIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}#scanner-overlay .scanner-toolbar{padding:16px;text-align:center;background:#000}'
    overlay.appendChild(style)

    const videoWrap = document.createElement('div')
    videoWrap.className = 'scanner-video-wrap'
    const video = document.createElement('video')
    video.setAttribute('playsinline', '')
    video.setAttribute('muted', '')
    videoWrap.appendChild(video)

    const frame = document.createElement('div')
    frame.className = 'scanner-frame'
    ;['tl','tr','bl','br'].forEach(pos => {
      const c = document.createElement('div')
      c.className = 'scanner-corner scanner-corner-' + pos
      frame.appendChild(c)
    })
    const scanLine = document.createElement('div')
    scanLine.className = 'scanner-scan-line'
    frame.appendChild(scanLine)
    videoWrap.appendChild(frame)

    const resultEl = document.createElement('div')
    resultEl.className = 'scanner-result'
    resultEl.id = 'scanner-result-text'
    resultEl.style.display = 'none'
    videoWrap.appendChild(resultEl)
    overlay.appendChild(videoWrap)

    const toolbar = document.createElement('div')
    toolbar.className = 'scanner-toolbar'
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn'
    cancelBtn.textContent = '\u2716 ' + I18N.t('cancel')
    toolbar.appendChild(cancelBtn)
    overlay.appendChild(toolbar)
    document.body.appendChild(overlay)

    function cleanup() { active = false; Scanner.stop(); overlay.remove() }
    cancelBtn.onclick = cleanup

    Scanner.init().then(result => {
      if (!result.ok) { showToast(result.error || 'Camera not available'); cleanup(); return }
      Scanner.start(video, function(barcodeValue) {
        if (!active) return
        const now = Date.now()
        if (lastResults.includes(barcodeValue) && now - lastResultTime < SCAN_THROTTLE) return
        lastResults.push(barcodeValue)
        lastResultTime = now
        if (lastResults.length > 20) lastResults.shift()
        try { navigator.vibrate(30) } catch (_) {}
        resultEl.textContent = 'Scanned: ' + barcodeValue
        resultEl.style.display = ''
        setTimeout(() => { cleanup(); if (onDetected) onDetected(barcodeValue) }, 500)
      })
    }).catch(() => { showToast('Camera access denied'); cleanup() })
  }

  // ══════════════════════════════════════════════
  //  MANAGER VIEWS
  // ══════════════════════════════════════════════

  async function loadManagerOverview() {
    if (!user.store_id) {
      $('ov-cards').innerHTML = '<div class="empty-state">' + I18N.t('noStoreAssigned') + '</div>'
      $('ov-store-table').innerHTML = ''
      return
    }
    $('ov-cards').innerHTML = '<div class="loading-spinner">' + I18N.t('loading') + '</div>'
    $('ov-store-table').innerHTML = ''
    try {
      const store = await API.getStore(user.store_id)
      const s = await API.getScanStats(user.store_id)
      const products = await API.getProducts(user.store_id, 1, 1)

      $('ov-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      $('ov-cards').innerHTML = `
        <div class="stat-card"><span class="num">${s.total}</span><span class="label">${I18N.t('totalLabel')}</span></div>
        <div class="stat-card"><span class="num">${s.today}</span><span class="label">${I18N.t('todayLabel')}</span></div>
        <div class="stat-card"><span class="num">${products.total}</span><span class="label">${I18N.t('productsLabel')}</span></div>
        <div class="stat-card"><span class="num">${s.visitsToday || 0}</span><span class="label">Visits Today</span></div>
        <div class="stat-card"><span class="num">${s.hitRate || 0}%</span><span class="label">Hit Rate</span></div>
        <div class="stat-card"><span class="num">${s.devices || 0}</span><span class="label">Devices</span></div>
      `
      const topHtml = (s.topProducts || []).map(p => `<div class="activity-item"><span class="act-barcode">${esc(p.barcode)}</span><span class="meta">${p.count} ${I18N.t('scanCount')}</span></div>`).join('')
      $('ov-store-table').innerHTML = `<header class="view-header" style="margin-top:16px"><h3 style="font-size:16px">${I18N.t('topProducts')}</h3><a href="https://${esc(store.slug)}.ivond.com" target="_blank" class="btn small">${I18N.t('publicLink')} ↗</a></header>` +
        (topHtml || '<div class="empty-state">' + I18N.t('noScans') + '</div>')
    } catch { $('ov-cards').innerHTML = '<div class="empty-state">' + I18N.t('couldNotLoadOverview') + ' <button class="btn small" onclick="loadManagerOverview()">' + I18N.t('retry') + '</button></div>' }
  }

  // ─── Products (manager) ───
  let productsPage = 1, productsTotal = 0
  let productsList = []
  const PRODUCTS_PER_PAGE = 20

  async function loadManagerProducts() {
    const q = $('product-search').value.trim()
    $('product-list').innerHTML = '<div class="loading-spinner">' + I18N.t('loading') + '</div>'
    try {
      const res = await API.getProducts(user.store_id, productsPage, PRODUCTS_PER_PAGE, q)
      productsTotal = res.total
      productsList = res.products || []
      renderProducts(productsList)
    } catch {
      $('product-list').innerHTML = '<div class="empty-state">' + I18N.t('couldNotLoad') + ' <button class="btn small" onclick="loadManagerProducts()">' + I18N.t('retry') + '</button></div>'
    }
  }

  function renderProducts(list) {
    if (productsTotal === 0) { $('product-list').innerHTML = '<div class="empty-state">' + I18N.t('noProducts') + '</div>'; return }
    if (list.length === 0) { $('product-list').innerHTML = '<div class="empty-state">' + I18N.t('noProductsMatch') + '</div>'; return }
    let html = '<table><thead><tr><th>' + I18N.t('tableBarcode') + '</th><th>' + I18N.t('tableName') + '</th><th>' + I18N.t('tablePrice') + '</th><th>' + I18N.t('tableCategory') + '</th><th></th></tr></thead><tbody>'
    for (const p of list) html += `<tr><td data-label="${I18N.t('tableBarcode')}" class="meta" style="font-family:monospace">${esc(p.barcode)}</td><td data-label="${I18N.t('tableName')}"><strong>${esc(p.name)}</strong></td><td data-label="${I18N.t('tablePrice')}">${parseFloat(p.price).toFixed(2)} DA</td><td data-label="${I18N.t('tableCategory')}" class="meta">${esc(p.category||'—')}</td><td class="actions-cell"><button class="btn small" onclick="editProduct('${p.id}')">${I18N.t('edit')}</button><button class="btn small danger" onclick="deleteProduct('${p.id}')">${I18N.t('delete')}</button></td></tr>`
    html += '</tbody></table>'
    html += paginationHtml(productsPage, productsTotal, PRODUCTS_PER_PAGE, "goToProducts")
    $('product-list').innerHTML = html
  }

  let productsSearchTimer
  $('product-search').oninput = () => {
    clearTimeout(productsSearchTimer)
    productsSearchTimer = setTimeout(() => {
      productsPage = 1
      loadManagerProducts()
    }, 300)
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1] || reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  $('btn-upload-csv') && ($('btn-upload-csv').onclick = () => $('csv-file').click())
  $('csv-file').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    const supported = ['csv', 'xlsx', 'xls', 'db', 'sqlite', 'sqlite3', 'json']

    if (!supported.includes(ext)) {
      showToast(I18N.t('unsupportedFormat', ext))
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
          '<div style="color:var(--text-secondary);margin-bottom:8px">' + I18N.t('fileMappedWithSavedConfig') + '</div>' +
          `<div style="margin-bottom:4px"><span class="meta" style="font-size:12px">${I18N.t('tableBarcode')}</span> ← <strong>${esc(preview.mapping_used.barcode)}</strong></div>` +
          `<div style="margin-bottom:4px"><span class="meta" style="font-size:12px">${I18N.t('tableName')}</span> ← <strong>${esc(preview.mapping_used.name)}</strong></div>` +
          `<div style="margin-bottom:4px"><span class="meta" style="font-size:12px">${I18N.t('tablePrice')}</span> ← <strong>${esc(preview.mapping_used.price)}</strong></div>` +
          '</div>'

        if (mapped && mapped.length > 0) {
          previewHtml += '<div class="mapping-preview-card" style="background:var(--bg-inset);border-radius:8px;padding:12px;margin-bottom:8px">'
          previewHtml += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">' + I18N.t('firstProductPreview') + '</div>'
          previewHtml += `<div class="row" style="display:flex;gap:8px;padding:4px 0"><span class="label" style="color:var(--text-secondary);min-width:60px">${I18N.t('tableBarcode')}:</span><span class="value" style="font-family:monospace">${esc(mapped[0].barcode || '—')}</span></div>`
          previewHtml += `<div class="row" style="display:flex;gap:8px;padding:4px 0"><span class="label" style="color:var(--text-secondary);min-width:60px">${I18N.t('tableName')}:</span><span class="value">${esc(mapped[0].name || '—')}</span></div>`
          previewHtml += `<div class="row" style="display:flex;gap:8px;padding:4px 0"><span class="label" style="color:var(--text-secondary);min-width:60px">${I18N.t('tablePrice')}:</span><span class="value">${esc(mapped[0].price || '—')} DA</span></div>`
          previewHtml += '</div>'
          previewHtml += `<div style="font-size:var(--text-sm);color:var(--text-secondary)">${I18N.t('moreProducts', result.row_count - 1)}</div>`
        }

        showModal(I18N.t('verifyImport'), previewHtml, async () => {
          try {
            const r = await API.confirmImport(result.id)
            showToast(r.imported + ' ' + I18N.t('importConfirmed'))
            loadManagerProducts()
          } catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
        })
        $('modal-confirm').textContent = I18N.t('looksGoodImport')
        $('modal-confirm').className = 'btn primary'
      } else if (result.status === 'pending' && result.requires_admin) {
        showToast(I18N.t('fileSubmittedToAdmin'))
      } else {
        showToast(I18N.t('fileUploadedStatus', result.status))
      }
    } catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
    e.target.value = ''
  }

  $('btn-add-product') && ($('btn-add-product').onclick = () => openProductModal(null))

  function openProductModal(existing) {
    const isEdit = !!existing
    const barcode = existing ? existing.barcode || '' : ''
    const name = existing ? existing.name || '' : ''
    const price = existing ? existing.price || '' : ''
    const category = existing ? existing.category || '' : ''

    showModal(isEdit ? I18N.t('editProduct') : I18N.t('addProduct'), `
      <div class="form">
        <div class="form-row">
          <label>${I18N.t('tableBarcode')}</label>
          <div style="display:flex;gap:8px">
            <input id="mod-prod-barcode" class="form-input" value="${esc(barcode)}" placeholder="e.g. 5901234123457" style="flex:1">
            <button id="mod-prod-scan-btn" class="btn small" type="button" title="${I18N.t('scanBarcode')}" style="flex-shrink:0;display:flex;align-items:center;gap:4px"><i data-feather="camera"></i></button>
          </div>
        </div>
        <div class="form-row">
          <label>${I18N.t('tableName')}</label>
          <input id="mod-prod-name" class="form-input" value="${esc(name)}" placeholder="e.g. Organic Honey">
        </div>
        <div class="form-row">
          <label>${I18N.t('tablePrice')}</label>
          <input id="mod-prod-price" type="number" step="0.01" min="0" class="form-input" value="${esc(price)}" placeholder="e.g. 12.99">
        </div>
        <div class="form-row">
          <label>${I18N.t('tableCategory')}</label>
          <div style="display:flex;gap:4px">
            <select id="mod-prod-category" class="form-input" style="flex:1">
              <option value="">—</option>
            </select>
            <button id="btn-add-cat-prod" class="btn small" type="button" title="${I18N.t('addCategory')}" style="flex-shrink:0">+</button>
          </div>
        </div>
      </div>
    `, async () => {
      const form = $('modal-body')
      clearFieldErrors(form)
      const barcode = $('mod-prod-barcode').value.trim()
      const name = $('mod-prod-name').value.trim()
      const price = $('mod-prod-price').value.trim()
      let hasError = false
      if (!barcode) { showFieldError($('mod-prod-barcode'), 'Barcode is required'); hasError = true }
      if (!name) { showFieldError($('mod-prod-name'), 'Name is required'); hasError = true }
      if (!price || isNaN(parseFloat(price))) { showFieldError($('mod-prod-price'), 'Valid price is required'); hasError = true }
      if (hasError) return

      const data = {
        store_id: user.store_id,
        barcode: barcode,
        name: name,
        price: parseFloat(price),
        category: $('mod-prod-category').value || null
      }
      try {
        await API.createProduct(data)
        closeModal()
        await loadManagerProducts()
        showToast(isEdit ? I18N.t('productUpdated') : I18N.t('productCreated'))
      } catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
    })
    $('modal-confirm').textContent = isEdit ? I18N.t('save') : I18N.t('addProduct')
    populateCategoryDropdown('mod-prod-category', 'btn-add-cat-prod', category, user.store_id)
    const prodScanBtn = $('mod-prod-scan-btn')
    if (prodScanBtn) {
      prodScanBtn.onclick = () => {
        startBarcodeScanner(async (barcodeValue) => {
          $('mod-prod-barcode').value = barcodeValue
          try {
            const product = await API.getProductByBarcode(user.store_id, barcodeValue)
            if (product && product.found) {
              if (product.name) $('mod-prod-name').value = product.name
              if (product.price) $('mod-prod-price').value = product.price
              if (product.category) { $('mod-prod-category').value = product.category }
              showToast('Product found: ' + product.name)
            } else {
              showToast('Product not found for this barcode')
            }
          } catch (err) { showToast('Lookup failed: ' + err.message) }
        })
      }
      if (typeof feather !== 'undefined') feather.replace()
    }
  }

  window.editProduct = async (id) => {
    const p = productsList.find(x => x.id === id)
    if (p) openProductModal(p)
  }

  window.deleteProduct = async (id) => {
    showModal(I18N.t('deleteProduct'), I18N.t('deleteProductConfirm'), async () => {
      await API.deleteProduct(id)
      closeModal()
      loadManagerProducts()
    }, true)
  }

  // ══════════════════════════════════════════════
  //  OFFERS (Scan Promotions)
  // ══════════════════════════════════════════════

  let offersPage = 1, offersTotal = 0
  const OFFERS_PER_PAGE = 20

  async function loadOffers() {
    if (!user.store_id) { $('offers-list').innerHTML = '<div class="empty-state">' + I18N.t('noStoreText') + '</div>'; return }
    $('offers-list').innerHTML = '<div class="loading-spinner">' + I18N.t('loading') + '</div>'
    try {
      const res = await API.getStorePromotions(user.store_id, offersPage, OFFERS_PER_PAGE)
      const promos = res.promotions || []
      const offers = promos.filter(p => p.type === 'offer')
      offersTotal = res.total
      if (offers.length === 0 && offersTotal === 0) {
        $('offers-list').innerHTML = '<div class="empty-state">' + I18N.t('noOffers') + '</div>'; return
      }
      if (offers.length === 0) {
        $('offers-list').innerHTML = '<div class="empty-state">' + I18N.t('noOffers') + '</div>'; return
      }
      let html = '<table><thead><tr><th>' + I18N.t('image') + '</th><th>' + I18N.t('title') + '</th><th>' + I18N.t('trigger') + '</th><th>' + I18N.t('active') + '</th><th></th></tr></thead><tbody>'
      for (const o of offers) {
        const trigger = o.trigger_type ? o.trigger_type + ': ' + esc(o.trigger_value) : '<span class="tag success">Default</span>'
        const offerImg = o.image_url || o.image_data
        const thumb = offerImg
          ? `<img src="${esc(offerImg)}" class="offer-thumb" alt="">`
          : '<span class="offer-thumb offer-thumb-empty"></span>'
        // a11y: color-only indicator for active status (✓/○ without text label)
        html += `<tr>
          <td data-label="${I18N.t('image')}">${thumb}</td>
          <td data-label="${I18N.t('title')}"><strong>${esc(o.title || 'Untitled')}</strong></td>
          <td data-label="${I18N.t('trigger')}" class="meta">${esc(trigger)}</td>
          <td data-label="${I18N.t('active')}">${o.active ? '<span style="color:var(--color-success)" aria-label="Active">✓</span>' : '<span style="color:var(--color-warning)" aria-label="Inactive">○</span>'}</td>
          <td class="actions-cell">
            <button class="btn small" onclick="editOffer('${o.id}')">${I18N.t('edit')}</button>
            <button class="btn small danger" onclick="deleteOffer('${o.id}')">${I18N.t('delete')}</button>
          </td>
        </tr>`
      }
      html += '</tbody></table>'
      html += paginationHtml(offersPage, offersTotal, OFFERS_PER_PAGE, "goToOffers")
      $('offers-list').innerHTML = html
    } catch { $('offers-list').innerHTML = '<div class="empty-state">' + I18N.t('couldNotLoad') + ' <button class="btn small" onclick="loadOffers()">' + I18N.t('retry') + '</button></div>' }
  }

  $('btn-add-offer') && ($('btn-add-offer').onclick = () => openOfferModal(null))

  function openOfferModal(existing) {
    const isEdit = !!existing
    const title = existing ? existing.title || '' : ''
    const active = existing ? !!existing.active : true
    const triggerType = existing ? existing.trigger_type || '' : ''
    const triggerValue = existing ? existing.trigger_value || '' : ''
    // Prefer image_url (R2) over image_data (base64) for existing records
    const existingImage = existing ? (existing.image_url || existing.image_data || '') : ''

    showModal(isEdit ? I18N.t('editOffer') : I18N.t('newOffer'), `
      <div class="form">
        <div class="form-row">
          <label>${I18N.t('offerTitle')}</label>
          <input id="mod-offer-title" class="form-input" value="${esc(title)}" placeholder="e.g. Weekend Special">
        </div>
        <div class="form-row">
          <label>${I18N.t('offerImage')}</label>
          <div class="logo-picker">
            <input type="file" id="mod-offer-image-input" accept="image/png,image/jpeg,image/webp,gif">
            <input type="hidden" id="mod-offer-image" value="${esc(existingImage)}">
            <img id="mod-offer-image-preview" class="logo-preview ${existingImage ? '' : 'hidden'}" src="${esc(existingImage)}">
            <button id="mod-offer-image-remove" class="btn small ${existingImage ? '' : 'hidden'}" type="button">${I18N.t('removeImage')}</button>
          </div>
        </div>
        <div class="form-row">
          <label>${I18N.t('triggerType')}</label>
          <select id="mod-offer-trigger-type" class="form-input">
            <option value="">— None (always show) —</option>
            <option value="category" ${triggerType === 'category' ? 'selected' : ''}>${I18N.t('category')}</option>
            <option value="product" ${triggerType === 'product' ? 'selected' : ''}>${I18N.t('product')}</option>
          </select>
        </div>
        <div class="form-row" id="mod-offer-trigger-value-row">
          <label>${I18N.t('triggerValue')}</label>
          <div id="mod-offer-trigger-value-wrap">
            <input id="mod-offer-trigger-value" class="form-input" value="${esc(triggerValue)}" placeholder="e.g. Beverages or barcode">
          </div>
        </div>
        <div class="form-row">
          <label>${I18N.t('offerActive')}</label>
          <input type="checkbox" id="mod-offer-active" ${active ? 'checked' : ''}>
        </div>
      </div>
    `, async () => {
      const form = $('modal-body')
      clearFieldErrors(form)
      const title = $('mod-offer-title').value.trim()
      let hasError = false
      if (!title) { showFieldError($('mod-offer-title'), 'Title is required'); hasError = true }
      if (hasError) return

      const imageVal = $('mod-offer-image').value
      const isDataUrl = imageVal && imageVal.startsWith('data:')
      const data = {
        store_id: user.store_id,
        type: 'offer',
        title: title,
        trigger_type: $('mod-offer-trigger-type').value || null,
        trigger_value: $('mod-offer-trigger-value').value || null,
        active: $('mod-offer-active').checked
      }
      if (isDataUrl) {
        data.image_data = imageVal
        data.image_url = null
      } else {
        data.image_url = imageVal || null
        data.image_data = null
      }
      try {
        if (isEdit) await API.updatePromotion(existing.id, data)
        else await API.createPromotion(data)
        closeModal(); loadOffers(); showToast(I18N.t('offerSaved'))
      } catch (err) {
        if (err.message.includes('limit reached')) {
          showModal('Offer Limit', `<p style="color:var(--color-danger);font-size:var(--text-sm)">${esc(err.message)}</p><p style="font-size:var(--text-sm);color:var(--text-secondary)">Delete some existing offers or ask an admin to increase your store limits.</p>`, null)
        } else {
          showToast(I18N.t('errorPrefix') + err.message)
        }
      }
    })
    $('modal-confirm').textContent = I18N.t('saveOffer')

    // Image picker — crop then upload to R2
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
          // Upload cropped image to R2
          const result = await API.uploadImage(cropped, user.store_id, 'promotion')
          imgHidden.value = result.url
          imgPreview.src = result.url
          imgPreview.classList.remove('hidden')
          imgRemove.classList.remove('hidden')
        } catch (e) {
          if (e.message !== 'cancelled') {
            console.warn('Upload failed:', e)
            showToast(I18N.t('uploadFailed') + ': ' + e.message)
          }
        }
      }
      reader.readAsDataURL(file)
    })
    imgRemove.addEventListener('click', () => {
      imgHidden.value = ''
      imgInput.value = ''
      imgPreview.classList.add('hidden')
      imgRemove.classList.add('hidden')
    })

    // Wire trigger type change → category dropdown / product barcode scanner
    const triggerTypeSelect = $('mod-offer-trigger-type')
    const triggerValueWrap = $('mod-offer-trigger-value-wrap')
    if (triggerTypeSelect) {
      if (triggerTypeSelect.value === 'category') {
        triggerValueWrap.innerHTML = `<select id="mod-offer-trigger-value" class="form-input"><option value="">—</option></select>`
        populateCategoryDropdown('mod-offer-trigger-value', null, triggerValue, user.store_id)
      } else if (triggerTypeSelect.value === 'product') {
        triggerValueWrap.innerHTML = `
          <div style="display:flex;gap:8px">
            <input id="mod-offer-trigger-value" class="form-input" value="${esc(triggerValue)}" placeholder="e.g. 5901234123457" style="flex:1">
            <button id="mod-offer-scan-btn" class="btn small" type="button" title="${I18N.t('scanBarcode')}" style="flex-shrink:0;display:flex;align-items:center;gap:4px"><i data-feather="camera"></i></button>
          </div>`
        if (typeof feather !== 'undefined') feather.replace()
        $('mod-offer-scan-btn').onclick = () => {
          startBarcodeScanner(async (barcodeValue) => {
            $('mod-offer-trigger-value').value = barcodeValue
            try {
              const product = await API.getProductByBarcode(user.store_id, barcodeValue)
              if (product && product.found) {
                showToast('Product found: ' + (product.name || barcodeValue))
              } else {
                showToast('Product not found for this barcode')
              }
            } catch (err) { showToast('Lookup failed: ' + err.message) }
          })
        }
      }
      triggerTypeSelect.addEventListener('change', function() {
        if (this.value === 'category') {
          triggerValueWrap.innerHTML = `<select id="mod-offer-trigger-value" class="form-input"><option value="">—</option></select>`
          populateCategoryDropdown('mod-offer-trigger-value', null, '', user.store_id)
        } else if (this.value === 'product') {
          triggerValueWrap.innerHTML = `
            <div style="display:flex;gap:8px">
              <input id="mod-offer-trigger-value" class="form-input" value="" placeholder="e.g. 5901234123457" style="flex:1">
              <button id="mod-offer-scan-btn" class="btn small" type="button" title="${I18N.t('scanBarcode')}" style="flex-shrink:0;display:flex;align-items:center;gap:4px"><i data-feather="camera"></i></button>
            </div>`
          if (typeof feather !== 'undefined') feather.replace()
          $('mod-offer-scan-btn').onclick = () => {
            startBarcodeScanner(async (barcodeValue) => {
              $('mod-offer-trigger-value').value = barcodeValue
              try {
                const product = await API.getProductByBarcode(user.store_id, barcodeValue)
                if (product && product.found) {
                  showToast('Product found: ' + (product.name || barcodeValue))
                } else {
                  showToast('Product not found for this barcode')
                }
              } catch (err) { showToast('Lookup failed: ' + err.message) }
            })
          }
        } else {
          triggerValueWrap.innerHTML = `<input id="mod-offer-trigger-value" class="form-input" value="" placeholder="e.g. Beverages or barcode">`
        }
      })
    }
  }

  window.editOffer = async (id) => {
    try {
      const promo = await API.getPromotion(id)
      openOfferModal(promo)
    } catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
  }

  window.deleteOffer = async (id) => {
    showModal(I18N.t('deleteOffer'), I18N.t('deleteOfferConfirm'), async () => {
      await API.deletePromotion(id)
      closeModal(); loadOffers()
    }, true)
  }

  // ─── Discount Items ───
  let discountsPage = 1, discountsTotal = 0
  const DISCOUNTS_PER_PAGE = 20

  async function loadDiscounts() {
    if (!user.store_id) { $('discount-list').innerHTML = '<div class="empty-state">' + I18N.t('noStoreText') + '</div>'; return }
    $('discount-list').innerHTML = '<div class="loading-spinner">' + I18N.t('loading') + '</div>'
    try {
      const res = await API.getDiscounts(user.store_id, discountsPage, DISCOUNTS_PER_PAGE)
      const items = res.discounts || []
      discountsTotal = res.total
      if (items.length === 0 && discountsTotal === 0) {
        $('discount-list').innerHTML = '<div class="empty-state">' + I18N.t('noDiscounts') + '</div>'; return
      }
      if (items.length === 0) {
        $('discount-list').innerHTML = '<div class="empty-state">' + I18N.t('noDiscounts') + '</div>'; return
      }
      let html = '<table><thead><tr><th>' + I18N.t('image') + '</th><th>' + I18N.t('tableName') + '</th><th>' + I18N.t('tableCategory') + '</th><th>' + I18N.t('tablePrice') + '</th><th>' + I18N.t('featured') + '</th><th>' + I18N.t('active') + '</th><th></th></tr></thead><tbody>'
      for (const d of items) {
        const discImg = d.image_url || d.image_data
        const thumb = discImg ? `<img src="${esc(discImg)}" class="discount-thumb" alt="">` : '<span class="discount-thumb discount-thumb-empty"></span>'
        const priceHtml = `<span style="text-decoration:line-through;color:var(--text-tertiary);font-size:var(--text-xs)">${parseFloat(d.original_price).toFixed(2)}</span> <strong style="color:var(--color-success)">${parseFloat(d.new_price).toFixed(2)}</strong>`
        // a11y: color-only indicators for featured (★/—) and active (✓/○) status
        html += `<tr>
          <td data-label="${I18N.t('image')}">${thumb}</td>
          <td data-label="${I18N.t('tableName')}"><strong>${esc(d.name)}</strong>${d.barcode ? '<br><span class="meta" style="font-size:11px">' + esc(d.barcode) + '</span>' : ''}</td>
          <td data-label="${I18N.t('tableCategory')}" class="meta">${esc(d.category || '—')}</td>
          <td data-label="${I18N.t('tablePrice')}" style="white-space:nowrap">${priceHtml}${d.discount_percent ? ' <span class="tag danger" style="font-size:10px">-' + d.discount_percent + '%</span>' : ''}</td>
          <td data-label="${I18N.t('featured')}">${d.featured ? '<span style="color:var(--color-warning)" aria-label="Featured">★</span>' : '<span aria-label="Not featured">—</span>'}</td>
          <td data-label="${I18N.t('active')}">${d.active ? '<span style="color:var(--color-success)" aria-label="Active">✓</span>' : '<span style="color:var(--text-disabled)" aria-label="Inactive">○</span>'}</td>
          <td class="actions-cell">
            <button class="btn small" onclick="editDiscount('${d.id}')">${I18N.t('edit')}</button>
            <button class="btn small danger" onclick="deleteDiscount('${d.id}')">${I18N.t('delete')}</button>
          </td>
        </tr>`
      }
      html += '</tbody></table>'
      html += paginationHtml(discountsPage, discountsTotal, DISCOUNTS_PER_PAGE, "goToDiscounts")
      $('discount-list').innerHTML = html
    } catch { $('discount-list').innerHTML = '<div class="empty-state">' + I18N.t('couldNotLoad') + ' <button class="btn small" onclick="loadDiscounts()">' + I18N.t('retry') + '</button></div>' }
  }

  $('btn-add-discount') && ($('btn-add-discount').onclick = () => openDiscountModal(null))

  function openDiscountModal(existing) {
    const isEdit = !!existing
    const name = existing ? existing.name || '' : ''
    const barcode = existing ? existing.barcode || '' : ''
    const category = existing ? existing.category || '' : ''
    // Prefer image_url (R2) over image_data (base64) for existing records
    const existingImage = existing ? (existing.image_url || existing.image_data || '') : ''
    const origPrice = existing ? existing.original_price || '' : ''
    const newPrice = existing ? existing.new_price || '' : ''
    const discPercent = existing ? existing.discount_percent || '' : ''
    const featured = existing ? !!existing.featured : false
    const active = existing ? !!existing.active : true
    const discType = existing && existing.discount_percent ? 'percent' : 'fixed'

    showModal(isEdit ? I18N.t('editDiscount') : I18N.t('newDiscount'), `
      <div class="form">
        <div class="form-row">
          <label>${I18N.t('discBarcode')}</label>
          <div style="display:flex;gap:8px">
            <input id="mod-disc-barcode" class="form-input" value="${esc(barcode)}" placeholder="e.g. 5901234123457" style="flex:1">
            <button id="mod-disc-scan-btn" class="btn small" type="button" title="${I18N.t('scanBarcode')}" style="flex-shrink:0;display:flex;align-items:center;gap:4px"><i data-feather="camera"></i></button>
          </div>
        </div>
        <div class="form-row">
          <label>${I18N.t('discName')}</label>
          <input id="mod-disc-name" class="form-input" value="${esc(name)}" placeholder="e.g. Organic Honey">
        </div>
        <div class="form-row">
          <label>${I18N.t('discImage')}</label>
          <div class="logo-picker">
            <div style="display:flex;gap:8px;margin-bottom:8px">
              <button id="mod-disc-camera-btn" class="btn small" type="button" style="display:flex;align-items:center;gap:4px"><i data-feather="camera"></i> Camera</button>
              <button id="mod-disc-gallery-btn" class="btn small" type="button" style="display:flex;align-items:center;gap:4px"><i data-feather="image"></i> Gallery</button>
            </div>
            <input type="file" id="mod-disc-gallery-input" accept="image/png,image/jpeg,image/webp" style="display:none">
            <input type="hidden" id="mod-disc-image" value="${esc(existingImage)}">
            <img id="mod-disc-image-preview" class="discount-preview ${existingImage ? '' : 'hidden'}" src="${esc(existingImage)}">
            <button id="mod-disc-image-remove" class="btn small ${existingImage ? '' : 'hidden'}" type="button">${I18N.t('removeImage')}</button>
          </div>
        </div>
        <div class="form-row">
          <label>${I18N.t('discCategory')}</label>
          <div style="display:flex;gap:4px">
            <select id="mod-disc-category" class="form-input" style="flex:1">
              <option value="">—</option>
            </select>
            <button id="btn-add-cat-disc" class="btn small" type="button" title="${I18N.t('addCategory')}" style="flex-shrink:0">+</button>
          </div>
        </div>
        <div class="form-row">
          <label>${I18N.t('discOrigPrice')}</label>
          <input id="mod-disc-orig-price" type="number" step="0.01" min="0" class="form-input" value="${esc(origPrice)}" placeholder="e.g. 12.99">
        </div>
        <div class="form-row">
          <label>${I18N.t('discType')}</label>
          <select id="mod-disc-type" class="form-input">
            <option value="percent" ${discType === 'percent' ? 'selected' : ''}>${I18N.t('discPercent')}</option>
            <option value="fixed" ${discType === 'fixed' ? 'selected' : ''}>${I18N.t('discFixed')}</option>
          </select>
        </div>
        <div class="form-row" id="mod-disc-percent-row" style="${discType === 'fixed' ? 'display:none' : ''}">
          <label>${I18N.t('discPercentLabel')}</label>
          <input id="mod-disc-percent" type="number" step="1" min="0" max="100" class="form-input" value="${esc(discPercent)}" placeholder="e.g. 20">
        </div>
        <div class="form-row" id="mod-disc-price-row" style="${discType !== 'fixed' ? 'display:none' : ''}">
          <label>${I18N.t('discNewPrice')}</label>
          <input id="mod-disc-new-price" type="number" step="0.01" min="0" class="form-input" value="${esc(newPrice)}" placeholder="e.g. 9.99">
        </div>
        <div class="form-row" style="display:flex;gap:var(--space-4);align-items:center">
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;margin:0">
            <input type="checkbox" id="mod-disc-featured" ${featured ? 'checked' : ''}> ${I18N.t('discFeatured')}
          </label>
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;margin:0">
            <input type="checkbox" id="mod-disc-active" ${active ? 'checked' : ''}> ${I18N.t('discActive')}
          </label>
        </div>
        <div id="mod-disc-preview" style="margin-top:8px;padding:8px;background:var(--bg-inset);border-radius:var(--radius-md);text-align:center;font-size:var(--text-sm);display:none">
          <span id="mod-disc-preview-text"></span>
        </div>
      </div>
    `, async () => {
      const form = $('modal-body')
      clearFieldErrors(form)
      const discName = $('mod-disc-name').value.trim()
      let hasError = false
      if (!discName) { showFieldError($('mod-disc-name'), 'Product name is required'); hasError = true }
      if (hasError) return

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
      const imageVal = $('mod-disc-image').value
      const isDataUrl = imageVal && imageVal.startsWith('data:')
      const data = {
        store_id: user.store_id,
        barcode: $('mod-disc-barcode').value || null,
        name: $('mod-disc-name').value,
        category: $('mod-disc-category').value || null,
        original_price: origPriceVal,
        new_price: newPriceVal || origPriceVal,
        discount_percent: discPercentVal,
        featured: $('mod-disc-featured').checked,
        active: $('mod-disc-active').checked
      }
      // Send R2 URL or base64 — whichever the image field holds
      if (isDataUrl) {
        data.image_data = imageVal
        data.image_url = null
      } else {
        data.image_url = imageVal || null
        data.image_data = null
      }
      try {
        if (isEdit) await API.updateDiscount(existing.id, data)
        else await API.createDiscount(data)
        closeModal(); await loadDiscounts(); showToast(I18N.t('discSaved'))
      } catch (err) {
        if (err.message.includes('limit reached')) {
          showModal('Discount Limit', `<p style="color:var(--color-danger);font-size:var(--text-sm)">${esc(err.message)}</p><p style="font-size:var(--text-sm);color:var(--text-secondary)">Delete some existing discounts or ask an admin to increase your store limits.</p>`, null)
        } else {
          showToast(I18N.t('errorPrefix') + err.message)
        }
      }
    })
    $('modal-confirm').textContent = I18N.t('saveDiscount')
    populateCategoryDropdown('mod-disc-category', 'btn-add-cat-disc', category, user.store_id)

    // Shared image handler for camera + gallery
    function handleImageFile(file) {
      const reader = new FileReader()
      reader.onload = async ev => {
        try {
          const cropped = await window.cropImage(ev.target.result, 3/4, 300, 400)
          const result = await API.uploadImage(cropped, user.store_id, 'discount')
          $('mod-disc-image').value = result.url
          $('mod-disc-image-preview').src = result.url
          $('mod-disc-image-preview').classList.remove('hidden')
          $('mod-disc-image-remove').classList.remove('hidden')
        } catch (e) {
          if (e.message !== 'cancelled') {
            console.warn('Upload failed:', e)
            showToast(I18N.t('uploadFailed') + ': ' + e.message)
          }
        }
      }
      reader.readAsDataURL(file)
    }
    // Camera capture (in-page viewfinder — avoids native camera app, which can lose URL hash)
    async function startCameraCapture(onCaptured) {
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        })
      } catch (e) { showToast('Camera access denied'); return }

      const overlay = document.createElement('div')
      overlay.id = 'camera-capture-overlay'
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#000'
      const video = document.createElement('video')
      video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover'
      video.setAttribute('playsinline', '')
      video.setAttribute('autoplay', '')
      video.srcObject = stream
      video.play()

      const cancelBtn = document.createElement('button')
      cancelBtn.innerHTML = '<i data-feather="x"></i>'
      cancelBtn.style.cssText = 'position:absolute;top:16px;left:16px;z-index:10;width:40px;height:40px;border-radius:50%;border:none;background:rgba(0,0,0,0.5);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer'

      const shutter = document.createElement('button')
      shutter.style.cssText = 'position:absolute;bottom:48px;left:50%;transform:translateX(-50%);z-index:10;width:72px;height:72px;border-radius:50%;border:4px solid #fff;background:rgba(255,255,255,0.3);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.1s'
      const inner = document.createElement('div')
      inner.style.cssText = 'width:56px;height:56px;border-radius:50%;background:#fff'
      shutter.appendChild(inner)

      overlay.appendChild(video)
      overlay.appendChild(cancelBtn)
      overlay.appendChild(shutter)
      document.body.appendChild(overlay)

      if (typeof feather !== 'undefined') feather.replace()

      function cleanup() {
        stream.getTracks().forEach(t => t.stop())
        overlay.remove()
      }

      cancelBtn.onclick = cleanup

      shutter.onclick = () => {
        shutter.style.transform = 'translateX(-50%) scale(0.9)'
        setTimeout(() => {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          canvas.getContext('2d').drawImage(video, 0, 0)
          const dataUrl = canvas.toDataURL('image/webp', 0.92)
          cleanup()
          onCaptured(dataUrl)
        }, 100)
      }
    }

    $('mod-disc-camera-btn').onclick = () => {
      startCameraCapture(async (dataUrl) => {
        try {
          const cropped = await window.cropImage(dataUrl, 3/4, 300, 400)
          const result = await API.uploadImage(cropped, user.store_id, 'discount')
          $('mod-disc-image').value = result.url
          $('mod-disc-image-preview').src = result.url
          $('mod-disc-image-preview').classList.remove('hidden')
          $('mod-disc-image-remove').classList.remove('hidden')
        } catch (e) {
          if (e.message !== 'cancelled') {
            console.warn('Upload failed:', e)
            showToast(I18N.t('uploadFailed') + ': ' + e.message)
          }
        }
      })
    }

    // Gallery picker
    $('mod-disc-gallery-input').addEventListener('change', e => { const f = e.target.files[0]; if (f) handleImageFile(f) })
    $('mod-disc-gallery-btn').onclick = () => $('mod-disc-gallery-input').click()
    // Remove
    $('mod-disc-image-remove').addEventListener('click', () => {
      $('mod-disc-image').value = ''
      $('mod-disc-gallery-input').value = ''
      $('mod-disc-image-preview').classList.add('hidden')
      $('mod-disc-image-remove').classList.add('hidden')
    })

    // Barcode scan button — scan and auto-fill product
    $('mod-disc-scan-btn').onclick = () => {
      startBarcodeScanner(async (barcodeValue) => {
        $('mod-disc-barcode').value = barcodeValue
        try {
          const product = await API.getProductByBarcode(user.store_id, barcodeValue)
          if (product && product.found) {
            if (product.name) $('mod-disc-name').value = product.name
            if (product.price) $('mod-disc-orig-price').value = product.price
            if (product.category) $('mod-disc-category').value = product.category
            showToast('Product found: ' + product.name)
            if (typeof updatePreview === 'function') updatePreview()
          } else {
            showToast('Product not found for this barcode')
          }
        } catch (err) { showToast('Lookup failed: ' + err.message) }
      })
    }

    // Price preview
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

  window.editDiscount = async (id) => {
    try { const item = await API.getDiscount(id); openDiscountModal(item) }
    catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
  }

  window.deleteDiscount = async (id) => {
    showModal(I18N.t('deleteDiscount'), I18N.t('deleteDiscountConfirm'), async () => {
      await API.deleteDiscount(id)
      closeModal(); await loadDiscounts()
    }, true)
  }

  // ══════════════════════════════════════════════
  //  TEAM (Manager: CRUD associates)
  // ══════════════════════════════════════════════

  let teamPage = 1, teamTotal = 0
  const TEAM_PER_PAGE = 50

  async function loadTeam() {
    if (!user.store_id) { $('team-list').innerHTML = '<div class="empty-state">' + I18N.t('noStoreAssigned') + '</div>'; return }
    $('team-list').innerHTML = '<div class="loading-spinner">' + I18N.t('loading') + '</div>'
    try {
      const res = await API.getTeam(user.store_id, teamPage, TEAM_PER_PAGE)
      const members = res.members || []
      teamTotal = res.total
      if (members.length === 0 && teamTotal === 0) {
        $('team-list').innerHTML = '<div class="empty-state">' + I18N.t('noAssociates') + '</div>'; return
      }
      if (members.length === 0) {
        $('team-list').innerHTML = '<div class="empty-state">' + I18N.t('noAssociates') + '</div>'; return
      }
      let html = '<table><thead><tr><th>' + I18N.t('associateName') + '</th><th>' + I18N.t('associateEmail') + '</th><th>' + I18N.t('role') + '</th><th></th></tr></thead><tbody>'
      for (const m of members) {
        html += '<tr>' +
          '<td data-label="' + I18N.t('associateName') + '"><strong>' + esc(m.display_name || m.name || '—') + '</strong></td>' +
          '<td data-label="' + I18N.t('associateEmail') + '" class="meta">' + esc(m.email) + '</td>' +
          '<td data-label="' + I18N.t('role') + '"><span class="tag associate">' + I18N.t('roleAssociate') + '</span></td>' +
          '<td class="actions-cell"><button class="btn small danger" onclick="deleteAssociate(\'' + m.id + '\')">' + I18N.t('delete') + '</button></td>' +
          '</tr>'
      }
      html += '</tbody></table>'
      html += paginationHtml(teamPage, teamTotal, TEAM_PER_PAGE, "goToTeam")
      $('team-list').innerHTML = html
    } catch { $('team-list').innerHTML = '<div class="empty-state">' + I18N.t('couldNotLoad') + ' <button class="btn small" onclick="loadTeam()">' + I18N.t('retry') + '</button></div>' }
  }

  $('btn-add-associate') && $('btn-add-associate').addEventListener('click', () => {
    showModal(I18N.t('newAssociate'), `
      <div class="form">
        <div class="form-row"><label>${I18N.t('associateName')}</label><input id="mod-assoc-name" class="form-input" placeholder="e.g. John Doe"></div>
        <div class="form-row"><label>${I18N.t('associateEmail')}</label><input id="mod-assoc-email" type="email" class="form-input" placeholder="e.g. john@store.com"></div>
        <div class="form-row"><label>${I18N.t('associatePassword')}</label><input id="mod-assoc-pass" type="password" class="form-input" placeholder="Min 6 characters"></div>
      </div>
    `, async () => {
      const form = $('modal-body')
      clearFieldErrors(form)
      const name = $('mod-assoc-name').value.trim()
      const email = $('mod-assoc-email').value.trim()
      const password = $('mod-assoc-pass').value
      let hasError = false
      if (!name) { showFieldError($('mod-assoc-name'), 'Name is required'); hasError = true }
      if (!email) { showFieldError($('mod-assoc-email'), 'Email is required'); hasError = true }
      if (!password) { showFieldError($('mod-assoc-pass'), 'Password is required'); hasError = true }
      if (hasError) return
      try {
        await API.createAssociate(user.store_id, { displayName: name, email, password })
        closeModal(); await loadTeam(); showToast(I18N.t('associateCreated'))
      } catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
    })
    $('modal-confirm').textContent = I18N.t('createAccount')
  })

  window.deleteAssociate = async (userId) => {
    showModal(I18N.t('deleteAssociate'), I18N.t('deleteAssociateConfirm'), async () => {
      await API.deleteAssociate(user.store_id, userId)
      closeModal(); await loadTeam(); showToast(I18N.t('associateDeleted'))
    }, true)
  }

  // ══════════════════════════════════════════════
  //  AUDIT LOG (Manager: view associate activity)
  // ══════════════════════════════════════════════

  let auditPage = 1, auditTotal = 0
  const AUDIT_PER_PAGE = 50

  async function loadAuditLog() {
    if (!user.store_id) { $('audit-list').innerHTML = '<div class="empty-state">' + I18N.t('noStoreAssigned') + '</div>'; return }
    $('audit-list').innerHTML = '<div class="loading-spinner">' + I18N.t('loading') + '</div>'
    try {
      const offset = (auditPage - 1) * AUDIT_PER_PAGE
      const data = await API.getAuditLog(user.store_id, AUDIT_PER_PAGE, offset)
      const logs = data.logs || []
      auditTotal = data.total || 0
      if (logs.length === 0 && auditTotal === 0) {
        $('audit-list').innerHTML = '<div class="empty-state">' + I18N.t('auditNoLogs') + '</div>'; return
      }
      if (logs.length === 0) {
        $('audit-list').innerHTML = '<div class="empty-state">' + I18N.t('auditNoLogs') + '</div>'; return
      }
      let html = '<table><thead><tr><th>' + I18N.t('auditDate') + '</th><th>' + I18N.t('auditUser') + '</th><th>' + I18N.t('auditAction') + '</th><th>' + I18N.t('auditEntity') + '</th><th>' + I18N.t('auditDetails') + '</th></tr></thead><tbody>'
      for (const l of logs) {
        const dt = new Date(l.created_at).toLocaleString()
        const details = l.details ? (typeof l.details === 'string' ? l.details : JSON.stringify(l.details)) : '—'
        html += '<tr>' +
          '<td data-label="' + I18N.t('auditDate') + '" class="meta" style="white-space:nowrap">' + esc(dt) + '</td>' +
          '<td data-label="' + I18N.t('auditUser') + '">' + esc(l.user_name || '—') + '</td>' +
          '<td data-label="' + I18N.t('auditAction') + '"><span class="tag">' + esc(l.action) + '</span></td>' +
          '<td data-label="' + I18N.t('auditEntity') + '" class="meta">' + esc(l.entity_type) + '</td>' +
          '<td data-label="' + I18N.t('auditDetails') + '" class="meta" style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">' + esc(details) + '</td>' +
          '</tr>'
      }
      html += '</tbody></table>'
      html += paginationHtml(auditPage, auditTotal, AUDIT_PER_PAGE, "goToAudit")
      $('audit-list').innerHTML = html
    } catch { $('audit-list').innerHTML = '<div class="empty-state">' + I18N.t('couldNotLoad') + ' <button class="btn small" onclick="loadAuditLog()">' + I18N.t('retry') + '</button></div>' }
  }

  // ══════════════════════════════════════════════
  //  PAGINATION
  // ══════════════════════════════════════════════

  function paginationHtml(current, total, perPage, goToFnName) {
    const totalPages = Math.ceil(total / perPage)
    if (totalPages <= 1) return ''
    const prevDisabled = current <= 1
    const nextDisabled = current >= totalPages
    const prevAttr = prevDisabled ? ' disabled' : ' onclick="' + goToFnName + '(' + (current - 1) + ')"'
    const nextAttr = nextDisabled ? ' disabled' : ' onclick="' + goToFnName + '(' + (current + 1) + ')"'
    return '<div class="pagination">' +
      '<button class="btn small" data-prev' + prevAttr + '>&larr; Previous</button>' +
      '<span class="pagination-info">Page ' + current + ' of ' + totalPages + '</span>' +
      '<button class="btn small" data-next' + nextAttr + '>Next &rarr;</button>' +
      '</div>'
  }

  window.goToProducts = function(p) { productsPage = p; loadManagerProducts() }
  window.goToOffers = function(p) { offersPage = p; loadOffers() }
  window.goToDiscounts = function(p) { discountsPage = p; loadDiscounts() }
  window.goToTeam = function(p) { teamPage = p; loadTeam() }
  window.goToAudit = function(p) { auditPage = p; loadAuditLog() }

  // ══════════════════════════════════════════════
  //  MODAL
  // ══════════════════════════════════════════════

  let modalCallback = null

  window.showModal = (title, body, onConfirm, danger) => {
    $('modal-overlay').classList.remove('hidden')
    $('modal-body').innerHTML = `<h3 style="margin-bottom:12px">${title}</h3>${body}`
    if (typeof feather !== 'undefined') feather.replace()
    $('modal-confirm').textContent = danger ? I18N.t('delete') : I18N.t('confirm')
    $('modal-confirm').className = 'btn ' + (danger ? 'danger' : 'primary')
    modalCallback = onConfirm
    $('modal-confirm').onclick = async () => { if (modalCallback) await modalCallback() }
  }

  window.closeModal = (e) => {
    if (e && e.target !== $('modal-overlay')) return
    $('modal-overlay').classList.add('hidden'); modalCallback = null
  }

  window.addEventListener('unhandledrejection', e => {
    console.warn('Unhandled:', e.reason);
  });

  // ─── PWA Install ───
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('btn-install-dash');
    if (btn) { btn.style.display = ''; if (typeof feather !== 'undefined') feather.replace(); }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const btn = document.getElementById('btn-install-dash');
    if (btn) btn.style.display = 'none';
  });

  const btnInstallDash = document.getElementById('btn-install-dash');
  if (btnInstallDash) {
    btnInstallDash.addEventListener('click', async () => {
      if (!deferredPrompt) {
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (isIos) {
          showToast('Tap Share → Add to Home Screen');
        } else if (window.matchMedia('(display-mode: standalone)').matches) {
          showToast('Already installed');
        } else {
          showToast('Visit a few times, then install will be ready');
        }
        return;
      }
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        deferredPrompt = null;
        const btn = document.getElementById('btn-install-dash');
        if (btn) btn.style.display = 'none';
      }
    });
  } else {
    console.warn('Missing #btn-install-dash — install button not rendered');
  }

  // ─── Helpers ───

  function showFieldError(inputEl, message) {
    const parent = inputEl.parentElement
    let errorEl = parent.querySelector('.form-error')
    if (!errorEl) {
      errorEl = document.createElement('div')
      errorEl.className = 'form-error'
      parent.appendChild(errorEl)
    }
    errorEl.textContent = message
    errorEl.classList.add('visible')
    inputEl.classList.add('error')
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('.form-error.visible').forEach(function(el) { el.classList.remove('visible') })
    form.querySelectorAll('.form-input.error').forEach(function(el) { el.classList.remove('error') })
  }

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
  const origNavigate = navigateTo
  navigateTo = function(id) {
    origNavigate(id)
    if (window.innerWidth <= 768) closeSidebar()
  }

  // ─── Init ───
  ;(async function init() {
    // Load user from localStorage
    loadUser()

    if (user) {
      // Verify session is still valid
      if (await checkSession()) {
        if (user.store_id) {
          try { const s = await API.getStore(user.store_id); $('sidebar-store-name').textContent = s.name } catch { logout() }
        }
        if (user) {
          API.getStores().then(s => { stores = s }).catch(() => {})
          routeDash()

          // Auto-refresh every 30s for live data
          let refreshInterval = setInterval(() => {
            loadManagerOverview()
            loadActivity()
          }, 30000)

          document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
              clearInterval(refreshInterval)
              refreshInterval = null
            } else if (!refreshInterval) {
              refreshInterval = setInterval(() => {
                loadManagerOverview()
                loadActivity()
              }, 30000)
            }
          })

          return
        }
      }
    }
    window.location.href = '/auth/'
  })()
})()
