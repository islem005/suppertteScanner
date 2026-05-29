(function() {
  if (typeof feather !== 'undefined') feather.replace()
  const $ = id => document.getElementById(id)

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

  // ─── Quick Login (testing) ───
  const CREDS = { admin: { email: 'admin@store.com', password: 'admin123' }, manager: { email: 'manager@test.com', password: 'password123' } }

  function fillQuickLogin(role) {
    const c = CREDS[role]
    if (c) { $('login-email').value = c.email; $('login-password').value = c.password }
  }
  fillQuickLogin('admin')
  document.querySelectorAll('input[name="ql-role"]').forEach(r => r.addEventListener('change', () => fillQuickLogin(r.value)))

  // ─── Login ───
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault()
    const btn = $('login-form').querySelector('button[type="submit"]')
    btn.disabled = true; btn.textContent = 'Signing in...'
    $('login-error').textContent = ''

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('login-email').value, password: $('login-password').value })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      if (data.user.role === 'admin') window.location.href = '/admin/'
      else window.location.href = '/dashboard/'
    } catch (err) {
      $('login-error').textContent = err.message
      btn.disabled = false; btn.textContent = 'Sign In'
    }
  })

  // ─── Register / Setup ───
  $('register-form').addEventListener('submit', async e => {
    e.preventDefault()
    const btn = $('register-form').querySelector('button[type="submit"]')
    btn.disabled = true; btn.textContent = 'Creating...'
    $('register-error').textContent = ''; $('register-success').textContent = ''

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: $('reg-email').value,
          password: $('reg-password').value,
          displayName: $('reg-name').value,
          storeName: $('reg-store').value,
          storeSlug: $('reg-slug').value
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      $('register-success').textContent = 'Store created! Redirecting...'
      setTimeout(() => { window.location.href = '/dashboard/' }, 1200)
    } catch (err) {
      $('register-error').textContent = err.message
      btn.disabled = false; btn.textContent = 'Create Store'
    }
  })
})()
