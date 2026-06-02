import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(__dirname, 'dist')

// Root files to copy to dist (SW, manifest, etc.)
const rootFiles = ['sw.js', 'manifest.json']

// Directory trees to mirror to dist
const dirs = ['js', 'css', 'dashboard/js', 'dashboard/css', 'admin/js', 'admin/css', 'auth/js', 'auth/css', 'home/css', 'home/js', 'assets/icons']

// Copy root-level files
for (const f of rootFiles) {
  const src = resolve(__dirname, f)
  const dest = resolve(DIST, f)
  if (existsSync(src)) {
    copyFileSync(src, dest)
  }
}

for (const d of dirs) {
  const src = resolve(__dirname, d)
  const dest = resolve(DIST, d)
  if (existsSync(src)) {
    mkdirSync(dest, { recursive: true })
    for (const f of readdirSync(src)) {
      copyFileSync(resolve(src, f), resolve(dest, f))
    }
  }
}
