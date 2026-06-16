#!/usr/bin/env node
// ─── Post-Deploy Test Runner ──────────────────────────────────────────────
// Polls the API health endpoint, then runs the full integration test suite.
// Called by `npm run deploy:all` after frontend + backend are deployed.
// ──────────────────────────────────────────────────────────────────────────

const WORKERS_DEV_URL = process.env.WORKERS_DEV_URL || 'https://scanner-api.islemhassini.workers.dev'
const API_BASE = `${WORKERS_DEV_URL}/api`
const HEALTH_URL = `${API_BASE}/health`

async function waitForHealth() {
  console.log(`\n■ Waiting for API health check at ${HEALTH_URL} ...`)
  for (let i = 1; i <= 12; i++) {
    try {
      const res = await fetch(HEALTH_URL)
      if (res.ok) {
        console.log(`  ✓ API ready (attempt ${i})`)
        return
      }
      console.log(`  Attempt ${i}/12: HTTP ${res.status}`)
    } catch {
      console.log(`  Attempt ${i}/12: connection refused`)
    }
    await new Promise(r => setTimeout(r, 10000))
  }
  console.error('  ✗ API not ready after ~120s')
  process.exit(1)
}

async function run() {
  await waitForHealth()

  console.log('\n■ Running integration tests ...')
  const { execSync } = await import('child_process')
  try {
    execSync('npx vitest run --reporter=verbose', {
      stdio: 'inherit',
      env: {
        ...process.env,
        API_BASE,
        ORIGIN: process.env.ORIGIN || 'https://ivond.com',
        ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@store.com',
        ADMIN_PASS: process.env.ADMIN_PASS || 'admin123',
      }
    })
    console.log('\n✓ All tests passed')
  } catch {
    console.error('\n✗ Tests failed — check the output above')
    process.exit(1)
  }
}

run()
