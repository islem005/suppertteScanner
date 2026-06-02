// ─── Seed Admin Account ──────────────────────────────────────────
// Creates admin@store.com / admin123 with 'admin' role.
// Run with: node seed-admin.mjs
// Requires the backend (wrangler dev) to be running on port 3002.
// ─────────────────────────────────────────────────────────────────

const API = 'http://localhost:3002/api'

async function main() {
  // 1. Sign up the admin user
  console.log('Creating admin user...')
  const signupRes = await fetch(`${API}/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:5173'
    },
    body: JSON.stringify({
      email: 'admin@store.com',
      password: 'admin123',
      name: 'Admin User'
    })
  })

  const signupBody = signupRes.status === 200 ? await signupRes.json().catch(() => null) : null
  console.log(`Sign-up status: ${signupRes.status}`)
  if (signupBody) console.log('Sign-up response:', JSON.stringify(signupBody, null, 2))

  if (signupRes.status === 200) {
    // 2. Update role to admin via D1 (Better Auth blocks role on input)
    console.log('Updating role to admin...')
    // We need to use wrangler d1 execute for this
    const { execSync } = await import('child_process')
    const cmd = `D:\\projects\\suppertteScanner\\api\\node_modules\\.bin\\wrangler.cmd d1 execute shelf-scanner-db --local --command="UPDATE user SET role='admin' WHERE email='admin@store.com'"`
    console.log(`Running: ${cmd}`)
    try {
      const result = execSync(cmd, { cwd: 'D:\\projects\\suppertteScanner\\api', timeout: 30000 })
      console.log('Role update result:', result.stdout?.toString() || '(no stdout)')
    } catch (e) {
      console.error('Role update failed:', e.message)
    }
  } else if (signupRes.status === 422) {
    // User might already exist — try logging in
    console.log('User may already exist. Trying login...')
    const loginRes = await fetch(`${API}/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({ email: 'admin@store.com', password: 'admin123' })
    })
    const loginBody = loginRes.status === 200 ? await loginRes.json().catch(() => null) : null
    console.log(`Login status: ${loginRes.status}`)
    if (loginBody) console.log('Login works:', JSON.stringify(loginBody, null, 2))
  }

  // 3. Verify
  console.log('\nVerifying admin user...')
  const verifyRes = await fetch(`${API}/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:5173'
    },
    body: JSON.stringify({ email: 'admin@store.com', password: 'admin123' })
  })
  console.log(`Verify login status: ${verifyRes.status}`)
  if (verifyRes.status === 200) {
    const data = await verifyRes.json()
    console.log('Admin login SUCCESS')
    console.log('User:', JSON.stringify(data.user, null, 2))
  } else {
    const errText = await verifyRes.text().catch(() => 'unknown')
    console.log('Admin login FAILED:', errText)
  }
}

main().catch(e => {
  console.error('Seed failed:', e)
  process.exit(1)
})
