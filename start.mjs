import { spawn, spawnSync } from 'child_process'
import { request as httpRequest } from 'http'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const ROOT = dirname(fileURLToPath(import.meta.url))
const WORKER = resolve(ROOT, 'worker')
const API_PORT = 3001
const API_URL = `http://localhost:${API_PORT}`
const ADMIN_EMAIL = 'admin@store.com'
const ADMIN_PASS = 'admin123'
const STORE_NAME = 'My Store'
const STORE_SLUG = 'my-store'

function log(tag, msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${tag.padEnd(8)} ${msg}`)
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function run(dir, cmd) {
  log('RUN', `${cmd} (in ${dir})`)
  const r = spawnSync('powershell.exe', ['-NoLogo', '-NonInteractive', '-Command', cmd], { cwd: dir, stdio: 'pipe' })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`Exit ${r.status}: ${(r.stderr || '').toString().slice(0, 200)}`)
}

function httpGet(url, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = httpRequest({
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: 'GET', timeout
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)) })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject('timeout') })
    req.end()
  })
}

async function waitForAPI(url, retries = 30) {
  for (let i = 0; i < retries; i++) {
    try { await httpGet(url); return true } catch { await sleep(500) }
  }
  return false
}

function fetchJSON(url, method, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = httpRequest({
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' }, timeout: 5000
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve(d) } }) })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject('timeout') })
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function main() {
  console.log('\n  ╔══════════════════════════════════════╗')
  console.log('  ║      Shelf Scanner - Quick Start      ║')
  console.log('  ╚══════════════════════════════════════╝\n')

  log('STEP 1', 'Installing frontend dependencies...')
  run(ROOT, 'npm.cmd install')
  log('STEP 1', 'Installing backend dependencies...')
  run(WORKER, 'npm.cmd install')

  log('STEP 2', 'Freeing port ' + API_PORT + '...')
  const ns = spawnSync('netstat.exe', ['-ano'], { encoding: 'utf8', stdio: 'pipe' })
  if (!ns.error) {
    for (const line of (ns.stdout || '').split('\n').filter(l => l.includes(`:${API_PORT}`) && l.includes('LISTENING'))) {
      const m = line.match(/(\d+)$/m)
      if (m) try { process.kill(parseInt(m[1])) } catch {}
    }
  }

  log('STEP 3', 'Starting API server...')
  const backend = spawn('node.exe', ['src/index.js'], {
    cwd: WORKER, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(API_PORT) }
  })
  backend.stdout.on('data', d => process.stdout.write(`  [api] ${d}`))
  backend.stderr.on('data', d => process.stderr.write(`  [api] ${d}`))
  backend.on('exit', c => log('API', `exited (${c})`))

  if (!await waitForAPI(`${API_URL}/api/health`)) {
    log('ERROR', 'API failed to start'); process.exit(1)
  }
  log('STEP 3', 'API ready')

  log('STEP 4', `Setup: ${ADMIN_EMAIL} / ${STORE_NAME}...`)
  try {
    await fetchJSON(`${API_URL}/api/setup`, 'POST', {
      email: ADMIN_EMAIL, password: ADMIN_PASS,
      displayName: 'Admin', storeName: STORE_NAME, storeSlug: STORE_SLUG
    })
    log('STEP 4', 'Done')
  } catch { log('STEP 4', 'Already configured') }

  log('STEP 4b', 'Seeding product catalog...')
  const seed = spawnSync('node.exe', ['src/seed.mjs', STORE_SLUG], { cwd: WORKER, stdio: 'pipe' })
  if (seed.status === 0) {
    const out = (seed.stdout || '').toString().trim()
    if (out) log('STEP 4b', out.split('\n').pop())
  } else {
    log('STEP 4b', `Skip: ${(seed.stderr || '').toString().slice(0, 80)}`)
  }

  log('STEP 5', 'Starting frontend...')
  let networkURL = null
  const frontend = spawn('powershell.exe', [
    '-NoLogo', '-NonInteractive', '-Command', 'npm.cmd run dev'
  ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  frontend.stdout.on('data', d => {
    const t = d.toString()
    process.stdout.write(`  [fe] ${t}`)
    const m = t.match(/https?:\/\/192\.\d+\.\d+\.\d+:\d+/)
    if (m) networkURL = m[0]
  })
  frontend.stderr.on('data', d => process.stderr.write(`  [fe] ${d}`))
  frontend.on('exit', c => log('FE', `exited (${c})`))

  await sleep(4000)

  const localURL = `https://localhost:5173`
  const homeURL = networkURL ? `${networkURL}/` : `${localURL}/`
  const storeURL = networkURL ? `${networkURL}/${STORE_SLUG}` : `${localURL}/${STORE_SLUG}`
  const authURL = networkURL ? `${networkURL}/auth/` : `${localURL}/auth/`
  const dashURL = networkURL ? `${networkURL}/dashboard/` : `${localURL}/dashboard/`
  const adminURL = networkURL ? `${networkURL}/admin/` : `${localURL}/admin/`

  console.log()
  console.log('  ╔══════════════════════════════════════════════╗')
  console.log('  ║              READY TO SCAN                   ║')
  console.log('  ╠══════════════════════════════════════════════╣')
  console.log(`  ║  Homepage:  ${(homeURL + ' ').padEnd(36)}║`)
  console.log(`  ║  Scanner:   ${(storeURL + ' ').padEnd(36)}║`)
  console.log(`  ║  Sign In:   ${(authURL + ' ').padEnd(36)}║`)
  console.log(`  ║  Dashboard: ${(dashURL + ' ').padEnd(36)}║`)
  console.log(`  ║  Admin:     ${(adminURL + ' ').padEnd(36)}║`)
  console.log(`  ║  Admin:     ${(ADMIN_EMAIL + ' ').padEnd(36)}║`)
  console.log(`  ║  Password:  ${(ADMIN_PASS + ' ').padEnd(36)}║`)
  console.log('  ╚══════════════════════════════════════════════╝')
  console.log('\n  Press Ctrl+C to stop both servers\n')

  process.on('SIGINT', () => { log('SHUTDOWN', 'Stopping...'); backend.kill(); frontend.kill(); process.exit(0) })
}

main().catch(e => { console.error('FAILED:', e); process.exit(1) })
