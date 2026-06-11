(function() {
  let user = null, stores = []
  const PER_PAGE = 20
  let storesPage = 1, usersPage = 1, regsPage = 1

  const navItems = [
    { id: 'overview',      icon: 'bar-chart-2', labelKey: 'navOverview' },
    { id: 'analytics',     icon: 'trending-up', labelKey: 'navAnalytics' },
    { id: 'stores',        icon: 'home', labelKey: 'navStores' },
    { id: 'registrations', icon: 'user-plus', labelKey: 'navRegistrations' },
    { id: 'users',         icon: 'users', labelKey: 'navUsers' },
    { id: 'promotions',    icon: 'gift', labelKey: 'navPromotions' },
    { id: 'discounts',     icon: 'tag', labelKey: 'navDiscounts' },
    { id: 'branding',      icon: 'droplet', labelKey: 'navBranding' },
    { id: 'email',         icon: 'send', labelKey: 'navEmail' },
    { id: 'activity',      icon: 'clock', labelKey: 'navActivity' },
    { id: 'profile',       icon: 'user', labelKey: 'navProfile' },
  ]

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
    showLoginView()
  }

  function showLoginView() {
    showView('view-login')
    document.getElementById('view-dash').classList.remove('active')
    document.getElementById('view-dash').style.display = 'none'
    const loginView = document.getElementById('view-login')
    loginView.style.display = 'flex'
    loginView.classList.add('active')
  }

  // ─── Admin Login Form ───
  const adminLoginForm = document.getElementById('admin-login-form')
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = adminLoginForm.querySelector('button[type="submit"]')
      btn.disabled = true; btn.textContent = typeof I18N !== 'undefined' ? I18N.t('signingIn') : 'Signing in...'
      const errorEl = document.getElementById('admin-login-error')
      errorEl.textContent = ''

      try {
        const res = await fetch('/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'skaner-csrf-token' },
          body: JSON.stringify({
            email: document.getElementById('admin-email').value,
            password: document.getElementById('admin-password').value
          }),
          credentials: 'include'
        })
        let data = {}
        try { data = await res.json() } catch { data = {} }
        if (!res.ok) throw new Error(data.error || data.message || 'Login failed')

        const userData = data.user || data

        if (userData.role !== 'admin') {
          throw new Error('This login is for admin accounts only. Managers use the /auth/ page.')
        }

        saveUser(userData)
        API.getStores().then(s => { stores = s }).catch(() => {})
        routeDash()
        showToast('Welcome back, ' + (userData.display_name || 'Admin'))
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
    else if (id === 'analytics') loadAnalytics()
    else if (id === 'stores') loadStores()
    else if (id === 'registrations') loadRegistrations()
    else if (id === 'users') loadUsers()
    else if (id === 'branding') loadBranding()
    else if (id === 'promotions') loadPromotions()
    else if (id === 'discounts') loadDiscounts()
    else if (id === 'email') loadEmailView()
    else if (id === 'activity') loadActivity()
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
    if (typeof feather !== 'undefined') feather.replace()
  }

  function routeDash() {
    showView('view-dash')
    // Clear inline styles set by showLoginView so CSS .active class takes over
    document.getElementById('view-dash').style.display = ''
    document.getElementById('view-login').style.display = ''
    buildNav(navItems)
    $('sidebar-username').textContent = user.display_name || user.email
    if (typeof I18N !== 'undefined') I18N.applyHtml()
    const initial = location.hash.replace('#', '') || 'overview'
    if (navItems.some(i => i.id === initial)) showDashView(initial)
    else showDashView('overview')
  }

  $('btn-logout').addEventListener('click', logout)

  async function loadAdminOverview() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    $('ov-cards').innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    $('ov-attention').innerHTML = ''
    $('ov-store-table').innerHTML = ''
    try {
      const s = await API.getAdminStats()
      $('ov-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      $('ov-cards').innerHTML = `
        <div class="stat-card"><span class="num">${s.totalStores}</span><span class="label">${t('totalStores')}</span></div>
        <div class="stat-card"><span class="num">${s.totalUsers}</span><span class="label">${t('totalUsers')}</span></div>
        <div class="stat-card"><span class="num">${s.totalProducts}</span><span class="label">${t('totalProducts')}</span></div>
        <div class="stat-card"><span class="num">${s.todayScans}</span><span class="label">${t('scansToday')}</span></div>
        <div class="stat-card"><span class="num">${s.totalScans}</span><span class="label">${t('totalScans')}</span></div>
        <div class="stat-card"><span class="num">${s.totalVisits || 0}</span><span class="label">${t('totalVisits')}</span></div>
        <div class="stat-card"><span class="num">${s.totalDevices || 0}</span><span class="label">${t('totalDevices')}</span></div>
      `

      // Attention cards — only shown when > 0
      const attentionItems = [
        { key: 'pendingRegistrations', labelKey: 'pendingRegistrations', view: 'registrations' },
        { key: 'pendingImports', labelKey: 'pendingImports', view: 'stores' },
        { key: 'storesWithoutBranding', labelKey: 'storesWithoutBranding', view: 'branding' },
        { key: 'storesWithoutMapping', labelKey: 'storesWithoutMapping', view: 'stores' },
        { key: 'storesWithZeroProducts', labelKey: 'inactiveStores', view: 'stores' },
      ]
      const cards = attentionItems.filter(i => s[i.key] > 0).map(i =>
        `<div class="stat-card attention" onclick="navigateTo('${i.view}')">
          <span class="num">${s[i.key]}</span>
          <span class="label">${t(i.labelKey)}</span>
          <span class="attention-link">${t('explore')} →</span>
        </div>`
      ).join('')
      $('ov-attention').innerHTML = cards ? `<div class="stats-row">${cards}</div>` : ''

      if (!s.storeStats || s.storeStats.length === 0) {
        $('ov-store-table').innerHTML = '<div class="empty-state">' + t('noData') + '</div>'
        return
      }
      let html = '<table><thead><tr><th>' + t('store') + '</th><th>' + t('storeSlug') + '</th><th>' + t('totalProducts') + '</th><th>' + t('totalScans') + '</th><th>' + t('totalUsers') + '</th></tr></thead><tbody>'
      for (const st of s.storeStats) html += `<tr><td><strong>${esc(st.name)}</strong></td><td><span class="meta">/${esc(st.slug)}</span></td><td>${st.products}</td><td>${st.scans}</td><td>${st.users}</td></tr>`
      $('ov-store-table').innerHTML = html + '</tbody></table>'
      if (typeof I18N !== 'undefined') I18N.applyHtml()
    } catch {
      $('ov-cards').innerHTML = '<div class="empty-state">' + t('errorOccurred') + ' <button class="btn small" onclick="loadAdminOverview()">' + t('retry') + '</button></div>'
    }
  }

  // ─── Analytics ───
  let _anStoreId = null

  async function loadAnalytics() {
    const days = $('an-days-filter').value || 30
    const storeFilter = $('an-store-filter').value || ''
    _anStoreId = storeFilter || null
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k

    $('an-cards').innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'

    try {
      const data = await API.getPlatformAnalytics(_anStoreId, days)

      // Stat cards
      const p = data.platform
      $('an-cards').innerHTML = `
        <div class="stat-card"><span class="num">${p.totalDevices}</span><span class="label">${t('totalDevices')}</span></div>
        <div class="stat-card"><span class="num">${p.devicesToday}</span><span class="label">${t('activeToday')}</span></div>
        <div class="stat-card"><span class="num">${p.totalVisits}</span><span class="label">${t('totalVisits')}</span></div>
        <div class="stat-card"><span class="num">${p.visitsToday}</span><span class="label">${t('visitsToday')}</span></div>
        <div class="stat-card"><span class="num">${p.totalScans}</span><span class="label">${t('totalScans')}</span></div>
        <div class="stat-card"><span class="num">${p.scansToday}</span><span class="label">${t('scansToday')}</span></div>
        <div class="stat-card"><span class="num">${p.hitRate}%</span><span class="label">${t('hitRate')}</span></div>
        <div class="stat-card"><span class="num">${p.avgScansPerVisit}</span><span class="label">${t('scansPerVisit')}</span></div>
      `

      // Daily trend chart
      renderTrendChart('an-trend-chart', data.dailyTrend)

      // Device breakdown
      renderDeviceChart('an-device-chart', data.deviceBreakdown)

      // Top products
      renderTopProducts('an-top-products', data.topProducts)

      // Per-store breakdown
      renderPerStoreTable('an-per-store', data.perStore, days)

      // Populate store filter if needed
      const filter = $('an-store-filter')
      if (data.perStore && data.perStore.length > 0 && filter.options.length <= 1) {
        for (const st of data.perStore) {
          const opt = document.createElement('option')
          opt.value = st.store_id; opt.textContent = st.name
          filter.appendChild(opt)
        }
      }
    } catch (err) {
      $('an-cards').innerHTML = '<div class="empty-state">' + t('errorOccurred') + ': ' + esc(err.message) + ' <button class="btn small" onclick="loadAnalytics()">' + t('retry') + '</button></div>'
    }
  }

  function renderTrendChart(containerId, data) {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    const el = $(containerId)
    if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state">' + t('noData') + '</div>'; return }

    const maxVisits = Math.max(...data.map(d => d.visits), 1)
    const maxScans = Math.max(...data.map(d => d.scans), 1)
    const maxVal = Math.max(maxVisits, maxScans)
    const barWidth = Math.max(8, Math.min(24, Math.floor(600 / data.length)))
    const chartW = Math.max(300, data.length * (barWidth + 4) + 40)
    const chartH = 140
    const padL = 30, padR = 10, padT = 8, padB = 20
    const innerH = chartH - padT - padB

    let svg = `<svg viewBox="0 0 ${chartW} ${chartH}" style="width:100%;max-height:160px" xmlns="http://www.w3.org/2000/svg">`
    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padT + (innerH / 4) * i
      svg += `<line x1="${padL}" y1="${y}" x2="${chartW - padR}" y2="${y}" stroke="#2a2a3e" stroke-width="1"/>`
    }
    // Bars
    data.forEach((d, i) => {
      const x = padL + i * (barWidth + 4)
      const vH = (d.visits / maxVal) * innerH
      const sH = (d.scans / maxVal) * innerH
      // Visits bar (indigo)
      svg += `<rect x="${x}" y="${padT + innerH - vH}" width="${barWidth}" height="${vH}" fill="#6366f1" rx="2" opacity="0.8">`
      svg += `<title>${d.date}: ${d.visits} visits</title></rect>`
      // Scans bar (emerald), offset slightly
      const sx = x + barWidth * 0.5
      const sw = Math.max(4, barWidth * 0.4)
      svg += `<rect x="${sx}" y="${padT + innerH - sH}" width="${sw}" height="${sH}" fill="#10b981" rx="2" opacity="0.8">`
      svg += `<title>${d.date}: ${d.scans} scans</title></rect>`
    })
    // X-axis labels (every Nth)
    const step = Math.max(1, Math.floor(data.length / 10))
    data.forEach((d, i) => {
      if (i % step === 0 || i === data.length - 1) {
        const x = padL + i * (barWidth + 4) + barWidth / 2
        const label = d.date.slice(5)
        svg += `<text x="${x}" y="${chartH - 4}" text-anchor="middle" fill="#6b7280" font-size="9">${label}</text>`
      }
    })
    // Legend
    svg += `<rect x="${chartW - 80}" y="2" width="8" height="8" fill="#6366f1" rx="1"/><text x="${chartW - 68}" y="9" fill="#9ca3af" font-size="9">Visits</text>`
    svg += `<rect x="${chartW - 40}" y="2" width="8" height="8" fill="#10b981" rx="1"/><text x="${chartW - 28}" y="9" fill="#9ca3af" font-size="9">Scans</text>`
    svg += '</svg>'
    el.innerHTML = svg
  }

  function renderDeviceChart(containerId, data) {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    const el = $(containerId)
    if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state">' + t('noData') + '</div>'; return }

    const total = data.reduce((s, d) => s + d.count, 0)
    const colors = { mobile: '#6366f1', desktop: '#10b981', tablet: '#f59e0b' }
    // Note: inline SVG fill doesn't support CSS vars in attribute context
    const labels = { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet' }

    let html = '<div style="display:flex;flex-direction:column;gap:var(--space-3)">'
    for (const d of data) {
      const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
      const color = colors[d.type] || '#6b7280'
      const label = labels[d.type] || d.type || 'Unknown'
      html += `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);margin-bottom:4px">
            <span>${label}</span>
            <span style="color:var(--text-secondary)">${d.count} (${pct}%)</span>
          </div>
          <div style="height:8px;background:var(--bg-inset);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.3s"></div>
          </div>
        </div>
      `
    }
    html += '</div>'
    el.innerHTML = html
  }

  function renderTopProducts(containerId, data) {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    const el = $(containerId)
    if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state">' + t('noData') + '</div>'; return }
    let html = '<table><thead><tr><th>#</th><th>' + t('barcode') + '</th><th>' + t('name') + '</th><th>' + t('scans') + '</th></tr></thead><tbody>'
    data.forEach((p, i) => {
      html += `<tr><td>${i + 1}</td><td class="meta" style="font-family:monospace">${esc(p.barcode)}</td><td><strong>${esc(p.name || '—')}</strong></td><td>${p.count}</td></tr>`
    })
    el.innerHTML = html + '</tbody></table>'
  }

  function renderPerStoreTable(containerId, stores, days) {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    const el = $(containerId)
    if (!stores || stores.length === 0) { el.innerHTML = '<div class="empty-state">' + t('noData') + '</div>'; return }
    let html = '<table><thead><tr><th>' + t('store') + '</th><th>' + t('storeSlug') + '</th><th>' + t('totalVisits') + '</th><th>' + t('totalScans') + '</th><th>' + t('totalDevices') + '</th><th>' + t('hitRate') + '</th><th></th></tr></thead><tbody>'
    for (const st of stores) {
      html += `<tr>
        <td><strong>${esc(st.name)}</strong></td>
        <td><span class="meta">/${esc(st.slug)}</span></td>
        <td>${st.visits}</td>
        <td>${st.scans}</td>
        <td>${st.devices}</td>
        <td>${st.hitRate}%</td>
        <td><button class="btn small" onclick="exportStoreCSV('${st.store_id}')">CSV</button></td>
      </tr>`
    }
    el.innerHTML = html + '</tbody></table>'
  }

  window.exportStoreCSV = (storeId) => {
    const days = $('an-days-filter').value || 30
    API.exportAnalytics(storeId, days)
  }

  // Filter change handlers for analytics
  if ($('an-store-filter')) $('an-store-filter').addEventListener('change', loadAnalytics)
  if ($('an-days-filter')) $('an-days-filter').addEventListener('change', loadAnalytics)
  if ($('btn-an-export')) $('btn-an-export').addEventListener('click', () => {
    const days = $('an-days-filter').value || 30
    const storeFilter = $('an-store-filter').value || ''
    API.exportAnalytics(storeFilter, days)
  })

  // ─── Registrations ───
  async function loadRegistrations() {
    const status = $('reg-filter').value === 'all' ? '' : $('reg-filter').value
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    $('registration-table').innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    try {
      const result = await API.getRegistrations(status, regsPage, PER_PAGE)
      const regs = result.data || result
      const total = result.total || regs.length
      const table = $('registration-table')
      if (regs.length === 0) {
        table.innerHTML = '<div class="empty-state">' + t('noRegistrations') + '</div>'
        return
      }
      let html = '<table><thead><tr><th>' + t('store') + '</th><th>' + t('storeSlug') + '</th><th>' + t('contactName') + '</th><th>' + t('registrationEmail') + '</th><th>' + t('registrationDate') + '</th><th>' + t('status') + '</th><th>' + t('registrationActions') + '</th></tr></thead><tbody>'
      for (const r of regs) {
        const statusClass = r.status === 'approved' ? 'tag success' : r.status === 'rejected' ? 'tag danger' : 'tag'
        html += `<tr>
          <td><strong>${esc(r.store_name)}</strong></td>
          <td><span class="meta">/${esc(r.store_slug)}</span></td>
          <td>${esc(r.contact_name)}</td>
          <td class="meta">${esc(r.contact_email)}</td>
          <td class="meta">${new Date(r.created_at).toLocaleDateString()}</td>
          <td><span class="${statusClass}">${r.status}</span></td>
          <td class="actions-cell" style="display:flex;gap:4px">
            <button class="btn small" onclick="viewRegistration('${r.id}')">${t('view')}</button>
            ${r.status === 'pending' ? `
              <button class="btn small" onclick="approveRegistration('${r.id}')">${t('approve')}</button>
              <button class="btn small danger" onclick="rejectRegistration('${r.id}')">${t('reject')}</button>
            ` : ''}
          </td>
        </tr>`
      }
      html += '</tbody></table>' + renderPagination(regsPage, Math.ceil(total / PER_PAGE))
      table.innerHTML = html
      if (typeof I18N !== 'undefined') I18N.applyHtml()
    } catch (err) {
      $('registration-table').innerHTML = '<div class="empty-state">' + t('errorOccurred') + ': ' + esc(err.message) + ' <button class="btn small" onclick="loadRegistrations()">' + t('retry') + '</button></div>'
    }
  }

  // ─── Filter change ───
  $('reg-filter').addEventListener('change', () => { regsPage = 1; loadRegistrations() })
  $('btn-refresh-reg').addEventListener('click', () => { regsPage = 1; loadRegistrations() })

  // ─── View Registration Detail ───
  window.viewRegistration = async (id) => {
    try {
      const reg = await API.getRegistration(id)
      const statusColor = reg.status === 'approved' ? '#00c875' : reg.status === 'rejected' ? '#ff4444' : '#ffc107'
      showModal('Registration Details', `
        <div class="reg-detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);font-size:var(--text-sm)">
          <div><span class="meta">Store Name</span><br><strong>${esc(reg.store_name)}</strong></div>
          <div><span class="meta">Store URL</span><br><strong>/${esc(reg.store_slug)}</strong></div>
          <div><span class="meta">Contact Name</span><br><strong>${esc(reg.contact_name)}</strong></div>
          <div><span class="meta">Contact Email</span><br><strong>${esc(reg.contact_email)}</strong></div>
          ${reg.contact_phone ? `<div><span class="meta">Phone</span><br><strong>${esc(reg.contact_phone)}</strong></div>` : ''}
          <div><span class="meta">Status</span><br><strong style="color:${statusColor}">${reg.status}</strong></div>
          <div><span class="meta">Submitted</span><br><strong>${new Date(reg.created_at).toLocaleString()}</strong></div>
          ${reg.admin_notes ? `<div style="grid-column:1/-1"><span class="meta">Admin Notes</span><br><strong>${esc(reg.admin_notes)}</strong></div>` : ''}
        </div>
        ${reg.message ? `<div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--bg-inset);border-radius:var(--radius-md);font-size:var(--text-sm)"><span class="meta">Message from applicant:</span><br>${esc(reg.message)}</div>` : ''}
      `, null)
      $('modal-confirm').style.display = 'none'
    } catch (err) { showToast('Error: ' + err.message) }
  }

  // ─── Approve Registration ───
  window.approveRegistration = async (id) => {
    showModal('Approve Registration', `
      <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-4)">
        This will create a new store and a manager account. The applicant will receive a generated password.
      </p>
      <div class="form-row">
        <label for="mod-approve-pass">Custom Password (optional — leave blank for auto-generated)</label>
        <input type="text" id="mod-approve-pass" class="form-input" placeholder="Leave blank for auto-generated">
      </div>
      <div class="form-row">
        <label for="mod-approve-notes">Admin Notes (optional)</label>
        <textarea id="mod-approve-notes" class="form-input" rows="2" placeholder="Any notes about this approval"></textarea>
      </div>
    `, async () => {
      const password = $('mod-approve-pass').value.trim() || null
      const admin_notes = $('mod-approve-notes').value.trim() || null
      try {
        const result = await API.approveRegistration(id, { password, admin_notes })
        closeModal()
        loadRegistrations()
        // Show success with credentials
        showToast('Store & manager created! Password: ' + result.user.password)
      } catch (err) { showToast('Error: ' + err.message) }
    })
  }

  // ─── Reject Registration ───
  window.rejectRegistration = async (id) => {
    showModal('Reject Registration', `
      <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-4)">
        This will mark the registration as rejected. The applicant will not be able to proceed.
      </p>
      <div class="form-row">
        <label for="mod-reject-notes">Reason / Notes (optional)</label>
        <textarea id="mod-reject-notes" class="form-input" rows="2" placeholder="Why was this rejected?"></textarea>
      </div>
    `, async () => {
      const admin_notes = $('mod-reject-notes').value.trim() || null
      try {
        await API.rejectRegistration(id, { admin_notes })
        closeModal()
        loadRegistrations()
        showToast('Registration rejected.')
      } catch (err) { showToast('Error: ' + err.message) }
    }, true)
  }

  async function loadStores() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    $('store-table').innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    let total
    try {
      const result = await API.getStores(storesPage, PER_PAGE)
      stores = result.data || result
      total = result.total || stores.length
    } catch {
      $('store-table').innerHTML = '<div class="empty-state">' + t('errorOccurred') + ' <button class="btn small" onclick="loadStores()">' + t('retry') + '</button></div>'
      return
    }
    if (stores.length === 0) { $('store-table').innerHTML = '<div class="empty-state">' + t('noData') + '</div>'; return }
    let html = '<table><thead><tr><th>' + t('store') + '</th><th>' + t('storeSlug') + '</th><th>' + t('storeCreated') + '</th><th>' + t('storeActions') + '</th></tr></thead><tbody>'
    for (const s of stores) html += `<tr><td><strong>${esc(s.name)}</strong></td><td><span class="meta">/${esc(s.slug)}</span></td><td class="meta">${(s.created_at||'').slice(0,10)}</td><td class="actions-cell" style="display:flex;gap:4px"><button class="btn small" onclick="showStoreDetail('${s.id}')">${t('explore')}</button><button class="btn small" onclick="openStoreEditModal('${s.id}')">${t('edit')}</button><button class="btn small danger" onclick="deleteStore('${s.id}','${esc(s.name)}')">${t('delete')}</button></td></tr>`
    $('store-table').innerHTML = html + '</tbody></table>' + renderPagination(storesPage, Math.ceil(total / PER_PAGE))
    if (typeof I18N !== 'undefined') I18N.applyHtml()
  }

  window.openStoreEditModal = async (storeId) => {
    const s = stores.find(st => st.id === storeId)
    if (!s) return
    let limits = {}
    try {
      const store = await API.getStore(storeId)
      if (store.metadata) {
        const meta = JSON.parse(store.metadata)
        limits = meta.limits || {}
      }
    } catch {}
    showModal('Edit Store', `
      <div class="form">
        <div class="form-row"><label>Store Name</label><input id="mod-store-edit-name" class="form-input" value="${esc(s.name)}"></div>
        <div class="form-row"><label>Slug</label><input id="mod-store-edit-slug" class="form-input" value="${esc(s.slug)}" placeholder="e.g. my-store" oninput="document.getElementById('store-edit-url-preview').textContent='ivond.com/'+this.value.replace(/\\s+/g,'-').toLowerCase()"></div>
        <div id="store-edit-url-preview" style="font-size:var(--text-sm);color:var(--text-secondary);padding:var(--space-1) var(--space-4) 0">ivond.com/${esc(s.slug)}</div>
        <hr style="margin:16px 0;border-color:var(--border-subtle)">
        <h4 style="margin:0 0 12px;font-size:14px">Limits</h4>
        <div class="form-row"><label>Max Always-Showing Offers</label><input id="mod-store-limit-offers-always" class="form-input" type="number" min="0" value="${limits.offersAlwaysShow || 3}"></div>
        <div class="form-row"><label>Max Active Offers</label><input id="mod-store-limit-offers-total" class="form-input" type="number" min="0" value="${limits.offersActive || 20}"></div>
        <div class="form-row"><label>Max Featured Discounts</label><input id="mod-store-limit-discounts-featured" class="form-input" type="number" min="0" value="${limits.discountsFeatured || 10}"></div>
        <div class="form-row"><label>Max Active Discounts</label><input id="mod-store-limit-discounts-total" class="form-input" type="number" min="0" value="${limits.discountsActive || 100}"></div>
      </div>
    `, async () => {
      const form = $('modal-body')
      clearFieldErrors(form)
      const name = $('mod-store-edit-name').value.trim()
      const slug = $('mod-store-edit-slug').value.trim()
      let hasError = false
      if (!name && !slug) { showToast('Name or slug required'); hasError = true }
      if (!slug) { showFieldError($('mod-store-edit-slug'), 'Slug is required'); hasError = true }
      if (hasError) return
      const payload = {}
      if (name) payload.name = name
      if (slug) payload.slug = slug
      payload.limits = {
        offersAlwaysShow: parseInt($('mod-store-limit-offers-always').value) || 0,
        offersActive: parseInt($('mod-store-limit-offers-total').value) || 0,
        discountsFeatured: parseInt($('mod-store-limit-discounts-featured').value) || 0,
        discountsActive: parseInt($('mod-store-limit-discounts-total').value) || 0
      }
      await API.updateStore(storeId, payload)
      closeModal(); await loadStores(); showToast('Store updated')
    })
    $('modal-confirm').textContent = 'Save'
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
    $('view-store-detail').classList.add('active')
    loadStoreDetail()
  }

  $('btn-back-stores').onclick = () => {
    $('view-store-detail').classList.remove('active')
    navigateTo('stores')
  }

  async function loadStoreDetail() {
    if (!currentStoreId) return
    const store = stores.find(s => s.id === currentStoreId)
    if (store) {
      $('sd-title').textContent = store.name
      $('sd-public-link').href = `https://${store.slug}.ivond.com`
    }

    Promise.all([
      loadStoreStats(),
      loadMappingCard(),
      loadPendingImports(),
      loadImportHistory(),
      loadLimitsCard()
    ])

    generateStoreQR(store)
  }

  async function loadLimitsCard() {
    if (!currentStoreId) return
    const card = $('sd-limits-card')
    const body = $('sd-limits-body')
    try {
      const usage = await API.getStoreUsage(currentStoreId)
      const l = usage.limits
      card.style.display = ''
      body.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div style="background:var(--bg-card);padding:12px;border-radius:8px"><div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">Offers — Always showing</div><div style="font-size:var(--text-lg);font-weight:600">' + usage.offersAlwaysShow + ' / ' + l.offersAlwaysShow + '</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">max ' + l.offersAlwaysShow + '</div></div>' +
          '<div style="background:var(--bg-card);padding:12px;border-radius:8px"><div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">Offers — Total active</div><div style="font-size:var(--text-lg);font-weight:600">' + usage.offersActive + ' / ' + l.offersActive + '</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">max ' + l.offersActive + '</div></div>' +
          '<div style="background:var(--bg-card);padding:12px;border-radius:8px"><div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">Discounts — Featured</div><div style="font-size:var(--text-lg);font-weight:600">' + usage.discountsFeatured + ' / ' + l.discountsFeatured + '</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">max ' + l.discountsFeatured + '</div></div>' +
          '<div style="background:var(--bg-card);padding:12px;border-radius:8px"><div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">Discounts — Total active</div><div style="font-size:var(--text-lg);font-weight:600">' + usage.discountsActive + ' / ' + l.discountsActive + '</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">max ' + l.discountsActive + '</div></div>' +
        '</div>'
    } catch {
      card.style.display = 'none'
    }
  }

  function generateStoreQR(store) {
    const canvas = $('sd-qr-canvas')
    const urlEl = $('sd-qr-url')
    const btn = $('btn-sd-download-qr')
    if (!canvas || !store) return
    const url = 'https://' + store.slug + '.ivond.com'
    urlEl.textContent = url
    QRCode.toCanvas(canvas, url, { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } }).catch(function() {})
    btn.onclick = function() {
      var link = document.createElement('a')
      link.download = store.slug + '-qr.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
  }

  async function loadStoreStats() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    $('sd-stats').innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    try {
      const s = await API.getAdminStats()
      const st = (s.storeStats || []).find(st => st.id === currentStoreId)
      if (!st) { $('sd-stats').innerHTML = ''; return }
      $('sd-stats').innerHTML = `
        <div class="stat-card"><span class="num">${st.products}</span><span class="label">${t('totalProducts')}</span></div>
        <div class="stat-card"><span class="num">${st.scans}</span><span class="label">${t('totalScans')}</span></div>
        <div class="stat-card"><span class="num">${st.users}</span><span class="label">${t('totalUsers')}</span></div>
      `
    } catch { $('sd-stats').innerHTML = '<div class="empty-state">' + t('errorOccurred') + '</div>' }
  }

  async function loadMappingCard() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    const body = $('sd-mapping-body')
    const badge = $('sd-mapping-badge')
    body.innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'

    try {
      const mapping = await API.getMapping(currentStoreId)
      if (mapping && mapping.column_mapping) {
        badge.innerHTML = '<span style="color:#00c875">✓ ' + t('activeMapping') + '</span>'
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
        badge.innerHTML = '<span style="color:#ffc107">○ ' + t('inactive') + '</span>'
        body.innerHTML = '<div class="empty-state">' + t('noMapping') + '</div>'
        $('btn-sd-edit-map').classList.remove('hidden')
        $('btn-sd-test-map').classList.add('hidden')
        $('btn-sd-remove-map').classList.add('hidden')
        $('btn-sd-save-map-only').classList.add('hidden')
      }
    } catch {
      badge.innerHTML = '<span style="color:#ff4444">✗ ' + t('errorState') + '</span>'
      body.innerHTML = '<div class="empty-state">' + t('couldNotLoadMapping') + '</div>'
    }
    if (typeof I18N !== 'undefined') I18N.applyHtml()
  }

  async function loadPendingImports() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    const list = $('sd-pending-list')
    list.innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    try {
      const data = await API.getStoreImports(currentStoreId)
      const pending = (data.imports || []).filter(i => i.status === 'pending' || i.status === 'auto-mapped')
      if (pending.length === 0) {
        list.innerHTML = '<div class="empty-state">' + t('noPendingImports') + '</div>'
        return
      }
      let html = '<table><thead><tr><th>' + t('file') + '</th><th>' + t('date') + '</th><th>' + t('rows') + '</th><th>' + t('status') + '</th><th>' + t('storeActions') + '</th></tr></thead><tbody>'
      for (const p of pending) {
        html += `<tr>
          <td><strong>${esc(p.original_filename)}</strong></td>
          <td class="meta">${new Date(p.created_at).toLocaleString()}</td>
          <td>${p.row_count}</td>
          <td><span class="import-status ${p.status}">${p.status}</span></td>
          <td class="actions-cell" style="display:flex;gap:4px">
            <button class="btn small" onclick="previewImport('${p.id}')">${t('preview')}</button>
            ${p.status === 'pending' ? `<button class="btn small" onclick="openMapModal('${p.id}')">${t('mapAndImport')}</button><button class="btn small danger" onclick="rejectImport('${p.id}')">${t('reject')}</button>` : ''}
            ${p.status === 'auto-mapped' ? `<button class="btn small" onclick="openMapModal('${p.id}')">${t('remap')}</button><button class="btn small" onclick="verifyImport('${p.id}')">${t('verifyImport')} ✓</button>` : ''}
          </td>
        </tr>`
      }
      list.innerHTML = html + '</tbody></table>'
      if (typeof I18N !== 'undefined') I18N.applyHtml()
    } catch { list.innerHTML = '<div class="empty-state">' + t('errorOccurred') + '</div>' }
  }

  async function loadImportHistory() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    const list = $('sd-history-list')
    list.innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    try {
      const data = await API.getStoreImports(currentStoreId)
      const history = (data.imports || []).filter(i => i.status === 'imported' || i.status === 'rejected')
      if (history.length === 0) {
        list.innerHTML = '<div class="empty-state">' + t('noImportHistory') + '</div>'
        return
      }
      let html = '<table><thead><tr><th>' + t('file') + '</th><th>' + t('date') + '</th><th>' + t('rows') + '</th><th>' + t('status') + '</th><th>' + t('storeActions') + '</th></tr></thead><tbody>'
      for (const h of history) {
        html += `<tr>
          <td><strong>${esc(h.original_filename)}</strong></td>
          <td class="meta">${h.imported_at ? new Date(h.imported_at).toLocaleString() : new Date(h.created_at).toLocaleString()}</td>
          <td>${h.row_count}</td>
          <td><span class="import-status ${h.status}">${h.status}</span></td>
          <td class="actions-cell"><button class="btn small" onclick="previewImport('${h.id}')">${t('preview')}</button></td>
        </tr>`
      }
      list.innerHTML = html + '</tbody></table>'
      if (typeof I18N !== 'undefined') I18N.applyHtml()
    } catch { list.innerHTML = '<div class="empty-state">' + t('errorOccurred') + '</div>' }
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

  // ─── Pagination ───
  function renderPagination(current, totalPages) {
    if (totalPages <= 1) return ''
    return '<div class="pagination"><button class="btn small" data-prev' + (current <= 1 ? ' disabled' : '') + '>&larr; Previous</button><span class="pagination-info">Page ' + current + ' of ' + totalPages + '</span><button class="btn small" data-next' + (current >= totalPages ? ' disabled' : '') + '>Next &rarr;</button></div>'
  }

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-prev],[data-next]')
    if (!btn) return
    var pag = btn.closest('.pagination')
    if (!pag) return
    var tbl = pag.parentElement
    if (tbl.id === 'store-table') {
      storesPage += btn.hasAttribute('data-prev') ? -1 : 1
      loadStores()
    } else if (tbl.id === 'user-table') {
      usersPage += btn.hasAttribute('data-prev') ? -1 : 1
      loadUsers()
    } else if (tbl.id === 'registration-table') {
      regsPage += btn.hasAttribute('data-prev') ? -1 : 1
      loadRegistrations()
    }
  })

  async function loadUsers() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    $('user-table').innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    let total
    try {
      const result = await API.getAdminUsers(usersPage, PER_PAGE)
      var users = result.data || result
      total = result.total || users.length
      stores = await API.getStores()
    } catch {
      $('user-table').innerHTML = '<div class="empty-state">' + t('errorOccurred') + ' <button class="btn small" onclick="loadUsers()">' + t('retry') + '</button></div>'
      return
    }
    const storeMap = {}; stores.forEach(s => storeMap[s.id] = s.name)

    if (users.length === 0) { $('user-table').innerHTML = '<div class="empty-state">' + t('noData') + '</div>'; return }
    let html = '<table><thead><tr><th>' + t('userDisplayName') + '</th><th>' + t('userEmail') + '</th><th>' + t('role') + '</th><th>' + t('userStore') + '</th><th>Password</th><th>' + t('userActions') + '</th></tr></thead><tbody>'
    for (const u of users) {
      const storeName = u.store_id ? (storeMap[u.store_id] || '—') : '—'
      html += `<tr><td>${esc(u.display_name)}</td><td class="meta">${esc(u.email)}</td><td><span class="tag ${u.role}">${u.role}</span></td><td class="meta">${esc(storeName)}</td><td><span class="meta" style="letter-spacing:2px">••••••</span> <button class="btn small" onclick="setPassword('${u.id}','${esc(u.display_name)}')">${t('changePassword')}</button></td><td class="actions-cell"><button class="btn small" onclick="openUserEditModal('${u.id}')">${t('edit')}</button>${u.role !== 'admin' ? `<button class="btn small danger" onclick="deleteUser('${u.id}','${esc(u.display_name)}')">${t('delete')}</button>` : ''}</td></tr>`
    }
    $('user-table').innerHTML = html + '</tbody></table>' + renderPagination(usersPage, Math.ceil(total / PER_PAGE))
    if (typeof I18N !== 'undefined') I18N.applyHtml()
  }

  window.openUserEditModal = async (userId) => {
    const u = (await API.getAdminUsers()).find(x => x.id === userId)
    if (!u) return
    const storeOpts = stores.map(s => `<option value="${s.id}" ${s.id === u.store_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')
    showModal('Edit User', `
      <div class="form">
        <div class="form-row"><label>Display Name</label><input id="mod-user-edit-name" class="form-input" value="${esc(u.display_name || '')}"></div>
        <div class="form-row"><label>Role</label>
          <select id="mod-user-edit-role" class="form-input">
            <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option>
            <option value="associate" ${u.role === 'associate' ? 'selected' : ''}>Associate</option>
            <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        <div class="form-row"><label>Store</label>
          <select id="mod-user-edit-store" class="form-input"><option value="">— No store —</option>${storeOpts}</select>
        </div>
      </div>
    `, async () => {
      const displayName = $('mod-user-edit-name').value.trim()
      const role = $('mod-user-edit-role').value
      const storeId = $('mod-user-edit-store').value || null
      if (!displayName) { showToast('Display name required'); return }
      await API.updateUser(userId, { displayName, role, storeId })
      closeModal(); await loadUsers(); showToast('User updated')
    })
    $('modal-confirm').textContent = 'Save'
  }

  $('btn-add-user').onclick = () => {
    const storeOpts = stores.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')
    showModal('New User', `
      <div class="form">
        <input id="mod-user-email" type="email" placeholder="Email" required>
        <input id="mod-user-pass" type="password" placeholder="Password" required>
        <input id="mod-user-name" placeholder="Display Name" required>
        <select id="mod-user-store"><option value="">— No store (admin) —</option>${storeOpts}</select>
        <select id="mod-user-role"><option value="staff">Staff</option><option value="associate">Associate</option><option value="manager">Manager</option><option value="admin">Admin</option></select>
      </div>
    `, async () => {
      const email = $('mod-user-email').value
      const password = $('mod-user-pass').value
      const displayName = $('mod-user-name').value
      if (!email || !password || !displayName) {
        showToast('Email, password, and display name are required')
        return
      }
      await API.createUser({
        email, password,
        displayName, storeId: $('mod-user-store').value || null,
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

  window.setPassword = (id, name) => {
    showModal('Set Password', `
      <p>Set new password for <strong>${esc(name)}</strong></p>
      <div class="form">
        <input id="mod-user-new-pass" type="password" placeholder="New password (min 6 chars)" required>
      </div>
    `, async () => {
      const password = $('mod-user-new-pass').value
      if (!password || password.length < 6) {
        showToast('Password must be at least 6 characters'); return
      }
      await API.setUserPassword(id, password)
      closeModal(); showToast('Password updated')
    })
  }

  let _editingStoreId = null

  async function loadBranding() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    $('brand-stores-table').innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    try {
      stores = await API.getStores()
    } catch { stores = [] }
    _editingStoreId = null
    $('brand-editor').classList.add('hidden')

    if (stores.length === 0) {
      $('brand-stores-table').innerHTML = '<div class="empty-state">' + t('noData') + '</div>'
      return
    }
    let html = '<table><thead><tr><th>' + t('store') + '</th><th>' + t('storeSlug') + '</th><th>' + t('status') + '</th><th>' + t('storeActions') + '</th></tr></thead><tbody>'
    for (const s of stores) {
      let status = ''
      try {
        const b = await API.getBranding(s.id)
        if (b.display_name || b.logo_url) status = '<span style="color:#00c875;font-size:12px">✓ Configured</span>'
        else status = '<span style="color:#ffc107;font-size:12px">○ Default</span>'
      } catch { status = '<span style="color:#ff4444;font-size:12px">✗ Error</span>' }
      html += `<tr><td><strong>${esc(s.name)}</strong></td><td class="meta">/${esc(s.slug)}</td><td>${status}</td><td class="actions-cell"><button class="btn small" onclick="openBrandingEditor('${s.id}')">${t('manage')}</button></td></tr>`
    }
    $('brand-stores-table').innerHTML = html + '</tbody></table>'
    if (typeof I18N !== 'undefined') I18N.applyHtml()
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
      $('brand-msg').textContent = (typeof I18N !== 'undefined' ? I18N.t('brandingSaved') : 'Branding saved!')
      setTimeout(() => $('brand-msg').textContent = '', 2000)
    } catch (err) { $('brand-msg').textContent = (typeof I18N !== 'undefined' ? I18N.t('errorPrefix') : 'Error: ') + err.message; $('brand-msg').style.color = '#ff4444' }
  })

  async function loadActivity() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    $('activity-list').innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    try {
      const activity = await API.getAdminActivity(50)
      if (!activity || activity.length === 0) {
        $('activity-list').innerHTML = '<div class="empty-state">' + t('noData') + '</div>'; return
      }
      let html = '<div class="table-wrap"><table><thead><tr><th>' + t('store') + '</th><th>' + t('storeSlug') + '</th><th>' + t('totalProducts') + '</th><th>' + t('totalScans') + '</th><th>' + t('totalUsers') + '</th><th>' + t('userCreated') + '</th></tr></thead><tbody>'
      for (const a of activity) {
        const time = new Date(a.created_at).toLocaleDateString()
        html += `<tr><td><strong>${esc(a.store_name)}</strong></td><td>${esc(a.store_slug)}</td><td>${a.products}</td><td>${a.scans}</td><td>${a.users}</td><td>${time}</td></tr>`
      }
      $('activity-list').innerHTML = html + '</tbody></table></div>'
      if (typeof I18N !== 'undefined') I18N.applyHtml()
    } catch { $('activity-list').innerHTML = '<div class="empty-state">' + t('errorOccurred') + ' <button class="btn small" onclick="loadActivity()">' + t('retry') + '</button></div>' }
  }

  // ══════════════════════════════════════════════
  //  PROMOTIONS (Banner + Offers)
  // ══════════════════════════════════════════════

  let _promoStoreId = null

  async function loadPromotions() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    _promoStoreId = null
    $('promo-banner-editor').classList.add('hidden')
    $('promo-stores-table').innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    try {
      stores = await API.getStores()
    } catch { stores = [] }

    if (stores.length === 0) {
      $('promo-stores-table').innerHTML = '<div class="empty-state">' + t('noData') + '</div>'
      return
    }
    let html = '<table><thead><tr><th>' + t('store') + '</th><th>' + t('storeSlug') + '</th><th>' + t('banners') + '</th><th>' + t('scanOffers') + '</th><th>' + t('storeActions') + '</th></tr></thead><tbody>'
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
        <td class="actions-cell"><button class="btn small" onclick="openPromoEditor('${s.id}')">${t('manage')}</button></td>
      </tr>`
    }
    $('promo-stores-table').innerHTML = html + '</tbody></table>'
    if (typeof I18N !== 'undefined') I18N.applyHtml()
  }

  const btnPromoRefresh = $('btn-promo-refresh')
  if (btnPromoRefresh) btnPromoRefresh.onclick = loadPromotions

  window.openPromoEditor = async (storeId) => {
    _promoStoreId = storeId
    const store = stores.find(s => s.id === storeId)
    $('promo-banner-title').textContent = store ? esc(store.name) + ' — Promotions' : 'Promotions'
    $('promo-stores-table').style.display = 'none'
    $('promo-banner-editor').classList.remove('hidden')
    loadBannerForm(storeId)
    loadPromoOffersList(storeId)
  }

  const promoBannerBack = $('promo-banner-back')
  if (promoBannerBack) promoBannerBack.onclick = () => {
    _promoStoreId = null
    $('promo-banner-editor').classList.add('hidden')
    $('promo-stores-table').style.display = ''
    loadPromotions()
  }

  // ─── Banners List + Editor ───
  async function loadBannerForm(storeId) {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    const wrap = $('promo-banner-form-wrap')
    wrap.innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    try {
      let banners
      try { banners = await API.getBanner(storeId) } catch { banners = [] }
      if (!Array.isArray(banners)) banners = []

      let html = `
        <div class="card" style="padding:var(--space-4);background:var(--bg-surface)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
            <h4 style="margin:0;font-size:var(--text-base)" data-i18n="banners">Banners</h4>
            <button id="btn-new-banner" class="btn small" data-i18n="newBanner">+ New Banner</button>
          </div>`

      if (banners.length === 0) {
        html += '<div class="empty-state">' + t('noBanners') + '</div>'
      } else {
        html += '<div class="table-wrap"><table><thead><tr><th style="width:60px" data-i18n="image">Image</th><th data-i18n="title">Title</th><th style="width:60px" data-i18n="active">Active</th><th style="width:120px" data-i18n="storeActions"></th></tr></thead><tbody>'
        for (const b of banners) {
          // a11y: color-only indicator for active status (✓/—)
          html += `<tr>
            <td>${(b.image_url || b.image_data) ? '<img src="' + esc(b.image_url || b.image_data) + '" style="width:48px;height:18px;object-fit:cover;border-radius:var(--radius-sm);display:block">' : '<span class="meta">—</span>'}</td>
            <td>${esc(b.title || '')}</td>
            <td>${b.active ? '<span style="color:var(--color-success)">✓</span>' : '—'}</td>
            <td class="actions-cell" style="white-space:nowrap">
              <button class="btn small" data-banner-id="${b.id}" data-banner-title="${esc(b.title || '')}" data-banner-image="${esc(b.image_data || '')}" data-banner-image-url="${esc(b.image_url || '')}" data-banner-active="${b.active ? '1' : '0'}" onclick="editBanner(this)">${t('edit')}</button>
              <button class="btn small danger" onclick="deleteBanner('${b.id}')">${t('delete')}</button>
            </td>
          </tr>`
        }
        html += '</tbody></table></div>'
      }
      html += '<span id="promo-banner-msg" class="success-msg"></span></div>'
      wrap.innerHTML = html
      if (typeof I18N !== 'undefined') I18N.applyHtml()

      $('btn-new-banner').onclick = () => openBannerModal(storeId, null)
    } catch { wrap.innerHTML = '<div class="empty-state">' + t('errorOccurred') + '</div>' }
  }

  window.editBanner = function(btn) {
    const id = btn.getAttribute('data-banner-id')
    const storeId = _promoStoreId
    const banner = {
      id,
      title: btn.getAttribute('data-banner-title'),
      image_data: btn.getAttribute('data-banner-image'),
      image_url: btn.getAttribute('data-banner-image-url') || '',
      active: btn.getAttribute('data-banner-active') === '1'
    }
    openBannerModal(storeId, banner)
  }

  window.deleteBanner = async (id) => {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    showModal(t('deleteBannerConfirm'), t('areYouSure'), async () => {
      try {
        await API.deletePromotion(id)
        closeModal()
        showToast(t('bannerDeleted'))
        loadBannerForm(_promoStoreId)
      } catch (err) { showToast(t('errorPrefix') + err.message) }
    }, true)
  }

  function openBannerModal(storeId, banner) {
    const isNew = !banner
    const title = isNew ? 'New Banner' : 'Edit Banner'
    const existingImage = banner ? (banner.image_url || banner.image_data || '') : ''
    const body = `
      <div class="form-row">
        <label>Title (fallback if no image)</label>
        <input type="text" id="banner-modal-title" class="form-input" value="${isNew ? '' : esc(banner.title || '')}" placeholder="e.g. Check out our weekly deals!">
      </div>
      <div class="form-row">
        <label>Banner Image (GIF supported)</label>
        <div class="logo-picker">
          <input type="file" id="banner-modal-image-input" accept="image/png,image/jpeg,image/webp,image/gif">
          <input type="hidden" id="banner-modal-image" value="${isNew ? '' : esc(existingImage)}">
          <img id="banner-modal-image-preview" class="logo-preview ${isNew || !existingImage ? 'hidden' : ''}" src="${isNew ? '' : esc(existingImage)}">
          <button id="banner-modal-image-remove" class="btn small ${isNew || !existingImage ? 'hidden' : ''}" type="button">Remove</button>
        </div>
      </div>
      <div class="form-row" style="display:flex;gap:var(--space-3);align-items:center">
        <label style="margin:0;white-space:nowrap">Active</label>
        <input type="checkbox" id="banner-modal-active" ${isNew || banner.active !== false ? 'checked' : ''}>
      </div>`

    showModal(title, body, async () => {
      const _title = $('banner-modal-title').value || null
      const _image = $('banner-modal-image').value
      const _active = $('banner-modal-active').checked
      const isDataUrl = _image && _image.startsWith('data:')
      const data = { store_id: storeId, type: 'banner', title: _title, active: _active }
      if (isDataUrl) {
        data.image_data = _image
        data.image_url = null
      } else {
        data.image_url = _image || null
        data.image_data = null
      }
      try {
        if (isNew) await API.createPromotion(data)
        else await API.updatePromotion(banner.id, data)
        closeModal()
        showToast(isNew ? 'Banner created!' : 'Banner saved!')
        loadBannerForm(storeId)
      } catch (err) { showToast('Error: ' + err.message) }
    }, false)

    // Wire up image crop — upload to R2
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
          const result = await API.uploadImage(cropped, storeId, 'promotion')
          imgHidden.value = result.url
          imgPreview.src = result.url
          imgPreview.classList.remove('hidden')
          imgRemove.classList.remove('hidden')
        } catch (e) {
          if (e.message !== 'cancelled') {
            console.warn('Upload failed:', e)
            showToast('Image upload failed: ' + e.message)
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
  }

  // ─── Offers List ───
  async function loadPromoOffersList(storeId) {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    const list = $('promo-offers-list')
    list.innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    try {
      const promos = await API.getStorePromotions(storeId)
      const offers = promos.filter(p => p.type === 'offer')
      if (offers.length === 0) {
        list.innerHTML = '<div class="empty-state">' + t('noOffersForStore') + '</div>'
        return
      }
      let html = '<table><thead><tr><th data-i18n="image">' + t('image') + '</th><th data-i18n="title">' + t('title') + '</th><th data-i18n="trigger">' + t('trigger') + '</th><th data-i18n="active">' + t('active') + '</th><th data-i18n="storeActions">' + t('storeActions') + '</th></tr></thead><tbody>'
      for (const o of offers) {
        const trigger = o.trigger_type ? o.trigger_type + ': ' + esc(o.trigger_value) : '<span class="tag success">' + t('default') + '</span>'
        const offerImg = o.image_url || o.image_data
        const thumb = offerImg
          ? `<img src="${esc(offerImg)}" class="offer-thumb" alt="">`
          : '<span class="offer-thumb offer-thumb-empty"></span>'
        // a11y: color-only indicator for active status (✓/○)
        html += `<tr>
          <td>${thumb}</td>
          <td><strong>${esc(o.title || 'Untitled')}</strong></td>
          <td class="meta">${esc(trigger)}</td>
          <td>${o.active ? '<span style="color:#00c875">✓</span>' : '<span style="color:#ffc107">○</span>'}</td>
          <td class="actions-cell" style="display:flex;gap:4px">
            <button class="btn small" onclick="adminEditOffer('${o.id}')">${t('edit')}</button>
            <button class="btn small danger" onclick="adminDeleteOffer('${o.id}')">${t('delete')}</button>
          </td>
        </tr>`
      }
      list.innerHTML = html + '</tbody></table>'
      if (typeof I18N !== 'undefined') I18N.applyHtml()
    } catch { list.innerHTML = '<div class="empty-state">' + t('errorOccurred') + '</div>' }
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
    const existingImage = existing ? (existing.image_url || existing.image_data || '') : ''

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
            <input type="hidden" id="mod-offer-image" value="${esc(existingImage)}">
            <img id="mod-offer-image-preview" class="logo-preview ${existingImage ? '' : 'hidden'}" src="${esc(existingImage)}">
            <button id="mod-offer-image-remove" class="btn small ${existingImage ? '' : 'hidden'}" type="button">Remove</button>
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
      const imageVal = $('mod-offer-image').value
      const isDataUrl = imageVal && imageVal.startsWith('data:')
      const data = {
        store_id: sid,
        type: 'offer',
        title: $('mod-offer-title').value,
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
          const result = await API.uploadImage(cropped, sid, 'promotion')
          imgHidden.value = result.url
          imgPreview.src = result.url
          imgPreview.classList.remove('hidden')
          imgRemove.classList.remove('hidden')
        } catch (e) {
          if (e.message !== 'cancelled') {
            console.warn('Upload failed:', e)
            showToast('Image upload failed: ' + e.message)
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
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    _discStoreId = null
    $('disc-editor').classList.add('hidden')
    $('disc-stores-table').innerHTML = '<div class="loading-spinner">' + t('loading') + '</div>'
    try { stores = await API.getStores() } catch { stores = [] }
    if (stores.length === 0) { $('disc-stores-table').innerHTML = '<div class="empty-state">' + t('noData') + '</div>'; return }
    let html = '<table><thead><tr><th>' + t('store') + '</th><th>' + t('storeSlug') + '</th><th>' + t('items') + '</th><th>' + t('storeActions') + '</th></tr></thead><tbody>'
    for (const s of stores) {
      let items = []
      try { items = await API.getDiscounts(s.id) } catch {}
      html += `<tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td class="meta">/${esc(s.slug)}</td>
        <td>${items.length}</td>
        <td class="actions-cell"><button class="btn small" onclick="openDiscountEditor('${s.id}')">${t('manage')}</button></td>
      </tr>`
    }
    $('disc-stores-table').innerHTML = html + '</tbody></table>'
    if (typeof I18N !== 'undefined') I18N.applyHtml()
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
    list.innerHTML = '<div class="loading-spinner">Loading...</div>'
    try {
      const items = await API.getDiscounts(storeId)
      if (items.length === 0) { list.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div class="empty-state">No discount items yet.</div><button id="btn-disc-add-first" class="btn small">+ New Discount</button></div>'; wireDiscAddFirst(); return }
      let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div></div><button id="btn-disc-add-top" class="btn small">+ New Discount</button></div>'
      html += '<div class="table-wrap"><table><thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Featured</th><th>Active</th><th></th></tr></thead><tbody>'
      for (const d of items) {
        const discImg = d.image_url || d.image_data
    const thumb = discImg ? `<img src="${esc(discImg)}" class="offer-thumb" alt="">` : '<span class="offer-thumb offer-thumb-empty"></span>'
        const priceHtml = `<span style="text-decoration:line-through;color:var(--text-tertiary);font-size:var(--text-xs)">${parseFloat(d.original_price).toFixed(2)}</span> <strong style="color:var(--color-success)">${parseFloat(d.new_price).toFixed(2)}</strong>`
        // a11y: color-only indicators for featured (★/—) and active (✓/○) status
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
    const existingImage = existing ? (existing.image_url || existing.image_data || '') : ''
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
          <div style="display:flex;gap:8px">
            <input id="mod-disc-barcode" class="form-input" value="${esc(barcode)}" placeholder="e.g. 5901234123457" style="flex:1">
            <button id="mod-disc-scan-btn" class="btn small" type="button" title="Scan barcode" style="flex-shrink:0;display:flex;align-items:center;gap:4px"><i data-feather="camera"></i></button>
          </div>
        </div>
        <div class="form-row">
          <label>Product Name</label>
          <input id="mod-disc-name" class="form-input" value="${esc(name)}" placeholder="e.g. Organic Honey">
        </div>
        <div class="form-row">
          <label>Product Photo</label>
          <div class="logo-picker">
            <div style="display:flex;gap:8px;margin-bottom:8px">
              <button id="mod-disc-camera-btn" class="btn small" type="button" style="display:flex;align-items:center;gap:4px"><i data-feather="camera"></i> Camera</button>
              <button id="mod-disc-gallery-btn" class="btn small" type="button" style="display:flex;align-items:center;gap:4px"><i data-feather="image"></i> Gallery</button>
            </div>
            <input type="file" id="mod-disc-gallery-input" accept="image/png,image/jpeg,image/webp" style="display:none">
            <input type="hidden" id="mod-disc-image" value="${esc(existingImage)}">
            <img id="mod-disc-image-preview" class="logo-preview ${existingImage ? '' : 'hidden'}" src="${esc(existingImage)}">
            <button id="mod-disc-image-remove" class="btn small ${existingImage ? '' : 'hidden'}" type="button">Remove</button>
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
      const imageVal = $('mod-disc-image').value
      const isDataUrl = imageVal && imageVal.startsWith('data:')
      const data = {
        store_id: sid,
        barcode: $('mod-disc-barcode').value || null,
        name: $('mod-disc-name').value,
        category: $('mod-disc-category').value || null,
        original_price: origPriceVal,
        new_price: newPriceVal || origPriceVal,
        discount_percent: discPercentVal,
        featured: $('mod-disc-featured').checked,
        active: $('mod-disc-active').checked
      }
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
        closeModal()
        await loadDiscountItemsList(sid)
        showToast('Discount saved!')
      } catch (err) { showToast('Error: ' + err.message); console.error('Discount save error:', err) }
    })
    $('modal-confirm').textContent = 'Save Discount'

    // Shared image handler for camera + gallery
    function handleImageFile(file) {
      const reader = new FileReader()
      reader.onload = async ev => {
        try {
          const cropped = await window.cropImage(ev.target.result, 3/4, 300, 400)
          const result = await API.uploadImage(cropped, sid, 'discount')
          $('mod-disc-image').value = result.url
          $('mod-disc-image-preview').src = result.url
          $('mod-disc-image-preview').classList.remove('hidden')
          $('mod-disc-image-remove').classList.remove('hidden')
        } catch (e) {
          if (e.message !== 'cancelled') {
            console.warn('Upload failed:', e)
            showToast('Image upload failed: ' + e.message)
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
          const result = await API.uploadImage(cropped, sid, 'discount')
          $('mod-disc-image').value = result.url
          $('mod-disc-image-preview').src = result.url
          $('mod-disc-image-preview').classList.remove('hidden')
          $('mod-disc-image-remove').classList.remove('hidden')
        } catch (e) {
          if (e.message !== 'cancelled') {
            console.warn('Upload failed:', e)
            showToast('Image upload failed: ' + e.message)
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

    // ─── Barcode scanner overlay ───
    async function startBarcodeScanner(onDetected) {
      if (!('BarcodeDetector' in window)) {
        showToast('Barcode scanning not supported on this browser. Use Chrome on Android.')
        return
      }
      const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','code_93','codabar','itf','upc_a','upc_e','qr_code','data_matrix','aztec','pdf417'] })
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        })
      } catch (e) { showToast('Camera access denied'); return }

      const overlay = document.createElement('div')
      overlay.id = 'scanner-overlay'
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#000;display:flex;flex-direction:column'
      const video = document.createElement('video')
      video.style.cssText = 'flex:1;width:100%;object-fit:cover'
      video.setAttribute('playsinline', ''); video.setAttribute('autoplay', '')
      video.srcObject = stream; video.play()

      const toolbar = document.createElement('div')
      toolbar.style.cssText = 'padding:16px;text-align:center;background:#000'
      const hint = document.createElement('p')
      hint.style.cssText = 'color:#fff;margin:0 0 12px;font-size:14px;opacity:.8'
      hint.textContent = 'Point camera at a barcode'
      toolbar.appendChild(hint)
      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'btn small'
      cancelBtn.textContent = '\u2716 Cancel'
      toolbar.appendChild(cancelBtn)
      overlay.appendChild(video); overlay.appendChild(toolbar)
      document.body.appendChild(overlay)

      let active = true, lastResults = [], lastResultTime = 0;
      const SCAN_THROTTLE = 1200

      async function detect() {
        if (!active) return
        try {
          if (video.readyState >= 2) {
            const codes = await detector.detect(video)
            if (active && codes.length > 0) {
              const now = Date.now()
              for (const code of codes) {
                if (!code.rawValue) continue
                if (lastResults.includes(code.rawValue) && now - lastResultTime < SCAN_THROTTLE) continue
                lastResults.push(code.rawValue); lastResultTime = now
                if (lastResults.length > 20) lastResults.shift()
                cleanup(); onDetected(code.rawValue); return
              }
            }
          }
        } catch (_) {}
        if (active) requestAnimationFrame(detect)
      }
      function cleanup() { active = false; stream.getTracks().forEach(t => t.stop()); overlay.remove() }
      cancelBtn.onclick = cleanup
      detect()
    }

    // Barcode scan button — scan and auto-fill product
    $('mod-disc-scan-btn').onclick = () => {
      startBarcodeScanner(async (barcodeValue) => {
        $('mod-disc-barcode').value = barcodeValue
        try {
          const product = await API.getProductByBarcode(sid, barcodeValue)
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

  // ─── Email ───
  let emailAttachments = []

  function loadEmailView() {
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    emailAttachments = []
    $('email-attach-list').innerHTML = ''
    $('email-attachments').value = ''
    $('email-status').textContent = ''
    $('email-send-btn').disabled = false
    $('email-send-btn').textContent = t('emailSend')
  }

  $('email-from').addEventListener('change', () => {
    const custom = $('email-from-custom')
    if ($('email-from').value === '__custom__') {
      custom.classList.remove('hidden')
      custom.required = true
    } else {
      custom.classList.add('hidden')
      custom.required = false
    }
  })

  $('email-attachments').addEventListener('change', (e) => {
    emailAttachments = []
    $('email-attach-list').innerHTML = ''
    const files = e.target.files
    if (!files || files.length === 0) return
    for (const file of files) {
      const fileSizeKB = Math.round(file.size / 1024)
      const item = document.createElement('div')
      item.className = 'email-attach-item'
      item.innerHTML = `<i data-feather="paperclip" style="width:12px;height:12px"></i> ${esc(file.name)} <span class="meta">(${fileSizeKB} KB)</span>`
      $('email-attach-list').appendChild(item)
      emailAttachments.push(file)
    }
    if (typeof feather !== 'undefined') feather.replace()
  })

  $('email-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k
    const btn = $('email-send-btn')
    const status = $('email-status')

    let from = $('email-from').value
    if (from === '__custom__') {
      from = $('email-from-custom').value.trim()
      if (!from) { status.textContent = t('emailFromRequired'); return }
    }

    const to = $('email-to').value.trim()
    const subject = $('email-subject').value.trim()
    const body = $('email-body').value.trim()

    if (!to || !subject || !body) {
      status.textContent = t('emailFieldsRequired')
      return
    }

    btn.disabled = true
    btn.textContent = t('emailSending')
    status.textContent = ''

    try {
      const attachments = []
      for (const file of emailAttachments) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (ev) => {
            const dataUrl = ev.target.result
            const b64 = dataUrl.split(',')[1]
            resolve(b64)
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        attachments.push({
          filename: file.name,
          content: base64,
          content_type: file.type || 'application/octet-stream',
        })
      }

      const result = await API.sendEmail({ from, to, subject, body, type: 'html', attachments })
      status.innerHTML = `<span style="color:var(--color-success)">✓ ${t('emailSent')}</span>`
      $('email-form').reset()
      emailAttachments = []
      $('email-attach-list').innerHTML = ''
    } catch (err) {
      status.innerHTML = `<span style="color:var(--color-danger)">✗ ${t('errorPrefix')}${esc(err.message)}</span>`
    } finally {
      btn.disabled = false
      btn.textContent = t('emailSend')
    }
  })

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
    if (typeof feather !== 'undefined') feather.replace()
    $('modal-confirm').textContent = danger ? 'Delete' : 'Confirm'
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

  const origNavigate = navigateTo
  navigateTo = function(id) {
    origNavigate(id)
    if (window.innerWidth <= 768) closeSidebar()
  }
  window.navigateTo = navigateTo

  // ─── Bootstrap: check session, fall back to login ──
  ;(async function init() {
    // Initialize i18n
    if (typeof I18N !== 'undefined') {
      document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === I18N.getLang())
        b.addEventListener('click', () => {
          I18N.setLang(b.dataset.lang)
          location.reload()
        })
      })
    }

    // Load user from localStorage
    loadUser()

    if (user) {
      // Verify session is still valid
      if (await checkSession()) {
        if (user.role !== 'admin') {
          localStorage.removeItem('user')
          user = null
          showLoginView()
          return
        }
        API.getStores().then(s => { stores = s }).catch(() => {})
        routeDash()

        // Auto-refresh every 30s for live data
        let refreshInterval = setInterval(() => {
          loadAdminOverview()
          loadActivity()
        }, 30000)

        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            clearInterval(refreshInterval)
            refreshInterval = null
          } else if (!refreshInterval) {
            refreshInterval = setInterval(() => {
              loadAdminOverview()
              loadActivity()
            }, 30000)
          }
        })

        return
      }
    }
    showLoginView()
  })()
})()
