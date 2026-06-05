(function() {
  if (typeof feather !== 'undefined') feather.replace()
  const $ = id => { if (typeof document === 'undefined' || typeof document.getElementById !== 'function') { console.error('DOM not available'); return null }; return document.getElementById(id) }

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

        // Clear errors
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
      banner.textContent = '⚠ API server unreachable — make sure the backend is running'
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
    if (!slug || slug.length < 2) {
      slugHint.textContent = ''
      slugHint.className = 'field-hint'
      return
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/
    if (!slugRegex.test(slug)) {
      slugHint.textContent = 'Only lowercase letters, numbers, and hyphens allowed'
      slugHint.className = 'field-hint error'
      return
    }

    slugHint.textContent = 'Checking availability...'
    slugHint.className = 'field-hint'

    slugCheckTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stores/slug/${encodeURIComponent(slug)}`)
        if (res.ok) {
          slugHint.textContent = 'This URL is already taken'
          slugHint.className = 'field-hint error'
        } else if (res.status === 404) {
          slugHint.textContent = '✓ Available!'
          slugHint.className = 'field-hint success'
        } else {
          slugHint.textContent = 'Could not check availability'
          slugHint.className = 'field-hint error'
        }
      } catch {
        slugHint.textContent = 'Could not check availability'
        slugHint.className = 'field-hint error'
      }
    }, 500)
  }

  // ─── Login ───
  const loginForm = $('login-form')
  if (loginForm) loginForm.addEventListener('submit', async e => {
    e.preventDefault()
    const btn = $('login-form').querySelector('button[type="submit"]')
    btn.disabled = true; btn.textContent = 'Signing in...'
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
        const statusText = data.error || data.message || `HTTP ${res.status}${res.status === 405 ? ' — server may not be running' : ''}`
        throw new Error(statusText)
      }

      const userData = data.user || data

      // Reject admins — they must use the admin panel login
      if (userData.role === 'admin') {
        throw new Error('Admins must sign in through the admin panel')
      }

      // Store user for UI state
      localStorage.setItem('user', JSON.stringify(userData))

      window.location.href = '/dashboard/'
    } catch (err) {
      $('login-error').textContent = err.message
      btn.disabled = false; btn.textContent = 'Sign In'
    }
  })

  // ─── Registration ───
  const registerForm = $('register-form')
  if (registerForm) registerForm.addEventListener('submit', async e => {
    e.preventDefault()
    const btn = $('register-form').querySelector('button[type="submit"]')
    btn.disabled = true; btn.textContent = 'Submitting...'
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
        throw new Error(data.error || 'Submission failed')
      }

      // Success — show success message, clear form
      $('register-form').reset()
      slugInput.dataset.manual = ''
      slugHint.textContent = ''
      slugHint.className = 'field-hint'

      $('register-success').classList.remove('hidden')
      $('register-success').textContent = 'Your request has been submitted! Our team will review it and get back to you at ' + payload.contact_email
      btn.textContent = 'Submitted ✓'
      btn.disabled = false
    } catch (err) {
      $('register-error').textContent = err.message
      btn.disabled = false; btn.textContent = 'Submit Request'
    }
  })
})()
