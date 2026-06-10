(function() {
  if (typeof feather !== 'undefined') feather.replace()
  if (typeof I18N !== 'undefined') I18N.applyHtml()
  const $ = id => { if (typeof document === 'undefined' || typeof document.getElementById !== 'function') { console.error('DOM not available'); return null }; return document.getElementById(id) }

  // ─── Language selector ───
  document.querySelectorAll('.auth-lang-btn').forEach(b => {
    b.addEventListener('click', () => {
      if (typeof I18N !== 'undefined') {
        I18N.setLang(b.dataset.lang)
        location.reload()
      }
    })
  })

  // ─── Tab Switching ───
  const tabs = document.querySelectorAll('.auth-tab')
  const loginWrap = $('form-login')
  const registerWrap = $('form-register')

  if (tabs && typeof tabs.forEach === 'function') {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab
        tabs.forEach(t => t.classList.remove('active'))
        tab.classList.add('active')

        if (loginWrap) loginWrap.classList.toggle('active', target === 'login')
        if (registerWrap) registerWrap.classList.toggle('active', target === 'register')

        const loginErr = $('login-error')
        const regErr = $('register-error')
        const regSuccess = $('register-success')
        if (loginErr) loginErr.textContent = ''
        if (regErr) regErr.textContent = ''
        if (regSuccess) regSuccess.classList.add('hidden')
      })
    })
  }

  // ─── API health check on load ───
  (async function checkApi() {
    try {
      const h = await fetch('/api/health', { method: 'GET' })
      if (!h.ok) throw new Error('unreachable')
    } catch {
      const banner = document.createElement('div')
      banner.id = 'api-warning'
      banner.style.cssText = 'background:var(--color-danger-muted);color:var(--color-danger);padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--text-sm);text-align:center;margin-bottom:var(--space-4)'
      const msg = typeof I18N !== 'undefined' ? I18N.t('apiUnreachable') : '⚠ API server unreachable — make sure the backend is running'
      banner.textContent = msg
      if (loginWrap) loginWrap.insertBefore(banner, loginWrap.querySelector('form'))
    }
  })()

  // ─── Slug auto-generation + availability ───
  const storeNameInput = $('reg-store-name')
  const slugInput = $('reg-store-slug')
  const slugHint = $('slug-availability')

  let slugCheckTimeout = null

  function slugify(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  storeNameInput.addEventListener('input', () => {
    if (!slugInput.dataset.manual) {
      slugInput.value = slugify(storeNameInput.value)
    }
    checkSlug()
  })

  slugInput.addEventListener('input', () => {
    slugInput.dataset.manual = 'true'
    checkSlug()
  })

  async function checkSlug() {
    clearTimeout(slugCheckTimeout)
    const slug = slugInput.value.trim()
    const t = typeof I18N !== 'undefined' ? I18N.t : (k) => k
    if (!slug || slug.length < 2) {
      slugHint.textContent = ''
      slugHint.className = 'field-hint'
      return
    }

    const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/
    if (!slugRegex.test(slug)) {
      slugHint.textContent = t('slugInvalid')
      slugHint.className = 'field-hint error'
      return
    }

    slugHint.textContent = t('slugChecking')
    slugHint.className = 'field-hint'

    slugCheckTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stores/slug/${encodeURIComponent(slug)}`)
        if (res.ok) {
          slugHint.textContent = t('slugTaken')
          slugHint.className = 'field-hint error'
        } else if (res.status === 404) {
          slugHint.textContent = t('slugAvailable')
          slugHint.className = 'field-hint success'
        } else {
          slugHint.textContent = t('slugCheckFailed')
          slugHint.className = 'field-hint error'
        }
      } catch {
        slugHint.textContent = t('slugCheckFailed')
        slugHint.className = 'field-hint error'
      }
    }, 500)
  }

  // ─── Login ───
  const loginForm = $('login-form')
  if (loginForm) loginForm.addEventListener('submit', async e => {
    e.preventDefault()
    const t = typeof I18N !== 'undefined' ? I18N.t : (k) => k
    const btn = document.querySelector('#login-form button[type="submit"]')
    btn.disabled = true; btn.textContent = t('signingIn')
    $('login-error').textContent = ''

    try {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('login-email').value, password: $('login-password').value }),
        credentials: 'include'
      })
      let data = {}
      try { data = await res.json() } catch { data = {} }
      if (!res.ok) {
        const statusText = data.error || data.message || t('loginFailed')
        throw new Error(statusText)
      }

      const userData = data.user || data

      if (userData.role === 'admin') {
        throw new Error(t('adminsUseAdminPanel'))
      }

      localStorage.setItem('user', JSON.stringify(userData))
      window.location.href = '/dashboard/'
    } catch (err) {
      $('login-error').textContent = err.message
      btn.disabled = false; btn.textContent = t('signIn')
    }
  })

  // ─── Registration ───
  const registerForm = $('register-form')
  if (registerForm) registerForm.addEventListener('submit', async e => {
    e.preventDefault()
    const t = typeof I18N !== 'undefined' ? I18N.t : (k) => k
    const btn = document.querySelector('#register-form button[type="submit"]')
    btn.disabled = true; btn.textContent = t('submitting')
    $('register-error').textContent = ''
    $('register-success').classList.add('hidden')

    const payload = {
      store_name: $('reg-store-name').value.trim(),
      store_slug: $('reg-store-slug').value.trim(),
      contact_name: $('reg-name').value.trim(),
      contact_email: $('reg-email').value.trim(),
      contact_phone: $('reg-phone').value.trim() || null,
      message: $('reg-message').value.trim() || null
    }

    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      let data = {}
      try { data = await res.json() } catch { data = {} }

      if (!res.ok) {
        throw new Error(data.error || t('submissionFailed'))
      }

      $('register-form').reset()
      slugInput.dataset.manual = ''
      slugHint.textContent = ''
      slugHint.className = 'field-hint'

      $('register-success').classList.remove('hidden')
      $('register-success').textContent = t('requestSubmitted') + payload.contact_email
      btn.textContent = t('submitted')
      btn.disabled = false
    } catch (err) {
      $('register-error').textContent = err.message
      btn.disabled = false; btn.textContent = t('submitRequest')
    }
  })
})()
