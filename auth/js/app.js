(function() {
  if (typeof feather !== 'undefined') feather.replace()
  const $ = id => document.getElementById(id)

  // ─── API health check on load ───
  (async function checkApi() {
    try {
      const h = await fetch('/api/health', { method: 'GET' })
      if (!h.ok) throw new Error('unreachable')
    } catch {
      const banner = document.createElement('div')
      banner.id = 'api-warning'
      banner.style.cssText = 'background:var(--color-danger-muted);color:var(--color-danger);padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--text-sm);text-align:center;margin-bottom:var(--space-4)'
      banner.textContent = '⚠ API server unreachable — make sure the backend is running on port 3002'
      $('login-form').parentNode.insertBefore(banner, $('login-form'))
    }
  })()

  // ─── Tab switching ───
  $('tab-login').addEventListener('click', () => { setTab('login') })
  $('tab-register').addEventListener('click', () => { setTab('register') })

  function setTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab))
    document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === tab + '-form'))
  }

  // ─── Auto-slug from store name ───
  $('reg-store').addEventListener('input', () => {
    const slug = $('reg-store').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    $('reg-slug').value = slug
  })

  // ─── Login ───
  $('login-form').addEventListener('submit', async e => {
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

      // Store user for UI state (token is in the cookie, managed by Better Auth)
      localStorage.setItem('user', JSON.stringify(data.user || data))

      // Redirect to dashboard
      window.location.href = '/dashboard/'
    } catch (err) {
      $('login-error').textContent = err.message
      btn.disabled = false; btn.textContent = 'Sign In'
    }
  })

  // ─── Register via Better Auth ───
  $('register-form').addEventListener('submit', async e => {
    e.preventDefault()
    const btn = $('register-form').querySelector('button[type="submit"]')
    btn.disabled = true; btn.textContent = 'Creating...'
    $('register-error').textContent = ''; $('register-success').textContent = ''

    try {
      const res = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: $('reg-email').value,
          password: $('reg-password').value,
          name: $('reg-name').value
        }),
        credentials: 'include'
      })
      let data = {}
      try { data = await res.json() } catch { data = {} }
      if (!res.ok) throw new Error(data.error || `Registration failed (HTTP ${res.status})`)

      // Store user for UI state
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user))
      }

      $('register-success').textContent = 'Account created! You can now sign in.'
      setTimeout(() => { setTab('login') }, 1500)
    } catch (err) {
      $('register-error').textContent = err.message
      btn.disabled = false; btn.textContent = 'Create Account'
    }
  })
})()
