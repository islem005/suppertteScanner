import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = 'c1a9c77e51deb2655ceb8700c6723f3d';
const PROJECT_NAME = 'shelf-scanner';
const DIST_DIR = 'dist';

if (!CLOUDFLARE_API_TOKEN) {
  console.error('Error: CLOUDFLARE_API_TOKEN environment variable required');
  process.exit(1);
}

const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}`;

async function getFiles(dir, base = '') {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = {};
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      Object.assign(files, getFiles(fullPath, relPath));
    } else {
      const content = readFileSync(fullPath);
      const hash = Array.from(new Uint8Array(content))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      files[relPath] = { content, hash: hash.slice(0, 16) };
    }
  }
  return files;
}

async function deploy() {
  const files = await getFiles(DIST_DIR);
  const fileEntries = Object.entries(files);
  console.log(`Deploying ${fileEntries.length} files from ${DIST_DIR}/`);

  const boundary = '----FormBoundary' + Date.now();
  const chunks = [];

  const manifest = {};
  for (const [path, { hash }] of fileEntries) {
    manifest[path] = hash;
  }

  chunks.push(`--${boundary}`);
  chunks.push('Content-Disposition: form-data; name="manifest"');
  chunks.push('Content-Type: application/json');
  chunks.push('');
  chunks.push(JSON.stringify(manifest));

  for (const [path, { content }] of fileEntries) {
    chunks.push(`--${boundary}`);
    chunks.push(`Content-Disposition: form-data; name="${path}"; filename="${path.split('/').pop()}"`);
    if (path.endsWith('.js')) chunks.push('Content-Type: application/javascript');
    else if (path.endsWith('.css')) chunks.push('Content-Type: text/css');
    else if (path.endsWith('.html')) chunks.push('Content-Type: text/html');
    else if (path.endsWith('.json')) chunks.push('Content-Type: application/json');
    else if (path.endsWith('.svg')) chunks.push('Content-Type: image/svg+xml');
    else if (path.endsWith('.png')) chunks.push('Content-Type: image/png');
    else if (path.endsWith('.ico')) chunks.push('Content-Type: image/x-icon');
    else if (path.endsWith('.webp')) chunks.push('Content-Type: image/webp');
    else chunks.push('Content-Type: application/octet-stream');
    chunks.push('');
    chunks.push(content.toString('base64'));
  }
  chunks.push(`--${boundary}--`);

  const body = chunks.join('\r\n');

  console.log('Uploading...');
  const res = await fetch(`${API_BASE}/deployments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body
  });

  const data = await res.json();
  if (data.success) {
    console.log('✓ Deployment created:', data.result?.url || 'unknown');
  } else {
    console.error('✗ Deployment failed:', JSON.stringify(data.errors, null, 2));
    process.exit(1);
  }
}

deploy().catch(err => { console.error(err); process.exit(1); });
