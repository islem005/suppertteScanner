(function() {
  if (typeof feather !== 'undefined') feather.replace()
  let user = null, stores = []

  const navItems = [
    { id: 'overview',  icon: 'bar-chart-2', labelKey: 'navOverview' },
    { id: 'products',  icon: 'package', labelKey: 'navProducts' },
    { id: 'offers',    icon: 'gift', labelKey: 'navOffers' },
    { id: 'discounts', icon: 'tag', labelKey: 'navDiscounts' },
    { id: 'branding',  icon: 'droplet', labelKey: 'navBranding' },
    { id: 'activity',  icon: 'clock', labelKey: 'navActivity' },
    { id: 'profile',   icon: 'user', labelKey: 'navProfile' },
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
    fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }).catch(() => {})
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
    else if (id === 'products') loadManagerProducts()
    else if (id === 'offers') loadOffers()
    else if (id === 'discounts') loadDiscounts()
    else if (id === 'branding') loadBranding()
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
      btn.innerHTML = `<i data-feather="${item.icon}"></i> ${item.labelKey ? I18N.t(item.labelKey) : item.label}`
      btn.onclick = () => navigateTo(item.id)
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
    const initial = location.hash.replace('#', '') || 'overview'
    if (navItems.some(i => i.id === initial)) showDashView(initial)
    else showDashView('overview')
  }

  const btnLogout = $('btn-logout')
  if (btnLogout) btnLogout.addEventListener('click', logout)
  else console.warn('Missing #btn-logout — check dashboard HTML')

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
      $('brand-facebook').value = b.facebook_url || ''
      $('brand-twitter').value = b.twitter_url || ''
      $('brand-youtube').value = b.youtube_url || ''
    } catch { /* defaults */ }
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
    setSocial('preview-facebook', $('brand-facebook').value)
    setSocial('preview-twitter', $('brand-twitter').value)
    setSocial('preview-youtube', $('brand-youtube').value)
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
  $('brand-facebook').oninput = updateBrandPreview
  $('brand-twitter').oninput = updateBrandPreview
  $('brand-youtube').oninput = updateBrandPreview

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
  //  OFFERS (Scan Promotions)
  // ══════════════════════════════════════════════

  async function loadOffers() {
    if (!user.store_id) { $('offers-list').innerHTML = '<div class="empty-state">No store assigned.</div>'; return }
    try {
      const promos = await API.getStorePromotions(user.store_id)
      const offers = promos.filter(p => p.type === 'offer')
      if (offers.length === 0) {
        $('offers-list').innerHTML = '<div class="empty-state">' + I18N.t('noOffers') + '</div>'; return
      }
      let html = '<table><thead><tr><th>Image</th><th>Title</th><th>Trigger</th><th>Active</th><th></th></tr></thead><tbody>'
      for (const o of offers) {
        const trigger = o.trigger_type ? o.trigger_type + ': ' + esc(o.trigger_value) : '<span class="tag success">Default</span>'
        const offerImg = o.image_url || o.image_data
        const thumb = offerImg
          ? `<img src="${esc(offerImg)}" class="offer-thumb" alt="">`
          : '<span class="offer-thumb offer-thumb-empty"></span>'
        html += `<tr>
          <td>${thumb}</td>
          <td><strong>${esc(o.title || 'Untitled')}</strong></td>
          <td class="meta">${esc(trigger)}</td>
          <td>${o.active ? '<span style="color:#00c875">✓</span>' : '<span style="color:#ffc107">○</span>'}</td>
          <td class="actions-cell" style="display:flex;gap:4px">
            <button class="btn small" onclick="editOffer('${o.id}')">Edit</button>
            <button class="btn small danger" onclick="deleteOffer('${o.id}')">${I18N.t('delete')}</button>
          </td>
        </tr>`
      }
      $('offers-list').innerHTML = html + '</tbody></table>'
    } catch { $('offers-list').innerHTML = '<div class="empty-state">Could not load offers.</div>' }
  }

  $('btn-add-offer').onclick = () => openOfferModal(null)

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
        <div class="form-row">
          <label>${I18N.t('triggerValue')}</label>
          <input id="mod-offer-trigger-value" class="form-input" value="${esc(triggerValue)}" placeholder="e.g. Beverages or barcode">
        </div>
        <div class="form-row">
          <label>${I18N.t('offerActive')}</label>
          <input type="checkbox" id="mod-offer-active" ${active ? 'checked' : ''}>
        </div>
      </div>
    `, async () => {
      const imageVal = $('mod-offer-image').value
      const isDataUrl = imageVal && imageVal.startsWith('data:')
      const data = {
        store_id: user.store_id,
        type: 'offer',
        title: $('mod-offer-title').value,
        trigger_type: $('mod-offer-trigger-type').value || null,
        trigger_value: $('mod-offer-trigger-value').value || null,
        active: $('mod-offer-active').checked
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
        if (isEdit) await API.updatePromotion(existing.id, data)
        else await API.createPromotion(data)
        closeModal(); loadOffers(); showToast(I18N.t('offerSaved'))
      } catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
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

  window.editOffer = async (id) => {
    try {
      const promo = await API.getPromotion(id)
      openOfferModal(promo)
    } catch (err) { showToast('Error: ' + err.message) }
  }

  window.deleteOffer = async (id) => {
    showModal(I18N.t('deleteOffer'), I18N.t('deleteOfferConfirm'), async () => {
      await API.deletePromotion(id)
      closeModal(); loadOffers()
    }, true)
  }

  // ─── Discount Items ───
  async function loadDiscounts() {
    if (!user.store_id) { $('discount-list').innerHTML = '<div class="empty-state">No store assigned.</div>'; return }
    try {
      const items = await API.getDiscounts(user.store_id)
      if (items.length === 0) {
        $('discount-list').innerHTML = '<div class="empty-state">' + I18N.t('noDiscounts') + '</div>'; return
      }
      let html = '<table><thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Featured</th><th>Active</th><th></th></tr></thead><tbody>'
      for (const d of items) {
        const discImg = d.image_url || d.image_data
        const thumb = discImg ? `<img src="${esc(discImg)}" class="offer-thumb" alt="">` : '<span class="offer-thumb offer-thumb-empty"></span>'
        const priceHtml = `<span style="text-decoration:line-through;color:var(--text-tertiary);font-size:var(--text-xs)">${parseFloat(d.original_price).toFixed(2)}</span> <strong style="color:var(--color-success)">${parseFloat(d.new_price).toFixed(2)}</strong>`
        html += `<tr>
          <td>${thumb}</td>
          <td><strong>${esc(d.name)}</strong>${d.barcode ? '<br><span class="meta" style="font-size:11px">' + esc(d.barcode) + '</span>' : ''}</td>
          <td class="meta">${esc(d.category || '—')}</td>
          <td style="white-space:nowrap">${priceHtml}${d.discount_percent ? ' <span class="tag danger" style="font-size:10px">-' + d.discount_percent + '%</span>' : ''}</td>
          <td>${d.featured ? '<span style="color:var(--color-warning)">★</span>' : '—'}</td>
          <td>${d.active ? '<span style="color:var(--color-success)">✓</span>' : '<span style="color:var(--text-disabled)">○</span>'}</td>
          <td class="actions-cell" style="display:flex;gap:4px">
            <button class="btn small" onclick="editDiscount('${d.id}')">${I18N.t('edit')}</button>
            <button class="btn small danger" onclick="deleteDiscount('${d.id}')">${I18N.t('delete')}</button>
          </td>
        </tr>`
      }
      $('discount-list').innerHTML = html + '</tbody></table>'
    } catch { $('discount-list').innerHTML = '<div class="empty-state">Could not load discounts.</div>' }
  }

  $('btn-add-discount').onclick = () => openDiscountModal(null)

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
          <input id="mod-disc-barcode" class="form-input" value="${esc(barcode)}" placeholder="e.g. 5901234123457">
        </div>
        <div class="form-row">
          <label>${I18N.t('discName')}</label>
          <input id="mod-disc-name" class="form-input" value="${esc(name)}" placeholder="e.g. Organic Honey">
        </div>
        <div class="form-row">
          <label>${I18N.t('discImage')}</label>
          <div class="logo-picker">
            <input type="file" id="mod-disc-image-input" accept="image/png,image/jpeg,image/webp" capture="environment">
            <input type="hidden" id="mod-disc-image" value="${esc(existingImage)}">
            <img id="mod-disc-image-preview" class="logo-preview ${existingImage ? '' : 'hidden'}" src="${esc(existingImage)}">
            <button id="mod-disc-image-remove" class="btn small ${existingImage ? '' : 'hidden'}" type="button">${I18N.t('removeImage')}</button>
          </div>
        </div>
        <div class="form-row">
          <label>${I18N.t('discCategory')}</label>
          <input id="mod-disc-category" class="form-input" value="${esc(category)}" placeholder="e.g. Beverages">
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
      } catch (err) { showToast(I18N.t('errorPrefix') + err.message) }
    })
    $('modal-confirm').textContent = I18N.t('saveDiscount')

    // Image picker with camera capture — crop then upload to R2
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
          // Upload cropped image to R2
          const result = await API.uploadImage(cropped, user.store_id, 'discount')
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
      imgHidden.value = ''; imgInput.value = ''; imgPreview.classList.add('hidden'); imgRemove.classList.add('hidden')
    })

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
    catch (err) { showToast('Error: ' + err.message) }
  }

  window.deleteDiscount = async (id) => {
    showModal(I18N.t('deleteDiscount'), I18N.t('deleteDiscountConfirm'), async () => {
      await API.deleteDiscount(id)
      closeModal(); await loadDiscounts()
    }, true)
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
          try { await API.getStore(user.store_id) } catch { logout() }
        }
        if (user) {
          API.getStores().then(s => { stores = s }).catch(() => {})
          routeDash()
          return
        }
      }
    }
    window.location.href = '/auth/'
  })()
})()
