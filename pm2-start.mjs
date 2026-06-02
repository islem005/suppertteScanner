// ─── PM2 Launcher Helper ─────────────────────────────────────────────
// Sets up PATH so node/npx are found, then starts PM2 with the
// ecosystem config.
// Run: node pm2-start.mjs
// ─────────────────────────────────────────────────────────────────────

import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NODE = 'C:\\Program Files\\nodejs\\node.exe'
const PM2 = resolve(process.env.APPDATA, 'npm', 'node_modules', 'pm2', 'bin', 'pm2')

const env = {
  ...process.env,
  PATH: `C:\\Program Files\\nodejs;C:\\Users\\pc1\\AppData\\Roaming\\npm;${process.env.PATH || ''}`
}

const args = process.argv.slice(2)
const cmd = args.length > 0 ? args : ['start', resolve(__dirname, 'ecosystem.config.cjs')]

const child = spawn(NODE, [PM2, ...cmd], {
  cwd: __dirname,
  env,
  stdio: 'inherit',
  shell: true
})

child.on('exit', (code) => process.exit(code))
child.on('error', (err) => { console.error('Failed:', err); process.exit(1) })
