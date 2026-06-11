// Builds the frontend and copies dist/ into frontend-worker/public/
// Run: node build-frontend.mjs
import { copyFile, mkdir, rm, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const DIST = join(ROOT, 'dist')
const PUBLIC = join(ROOT, 'frontend-worker', 'public')

console.log('[1/3] Building frontend...')
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })

console.log('[2/3] Cleaning public/...')
if (existsSync(PUBLIC)) await rm(PUBLIC, { recursive: true })
await mkdir(PUBLIC, { recursive: true })

console.log('[3/3] Copying dist/ -> frontend-worker/public/ ...')
await copyDir(DIST, PUBLIC)

console.log('Done! Run: cd frontend-worker && wrangler deploy')

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src)
  for (const entry of entries) {
    const srcPath = join(src, entry)
    const destPath = join(dest, entry)
    const s = await stat(srcPath)
    if (s.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await copyFile(srcPath, destPath)
    }
  }
}
