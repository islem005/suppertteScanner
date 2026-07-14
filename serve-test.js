const http = require('http')
const fs = require('fs')
const path = require('path')
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' }
const dir = __dirname
http.createServer((req, res) => {
  const filePath = path.join(dir, req.url === '/' ? '/home/test.html' : req.url)
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('not found'); return }
  const ext = path.extname(filePath)
  res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain', 'Cache-Control': 'no-cache' })
  fs.createReadStream(filePath).pipe(res)
}).listen(5174, () => console.log('http://localhost:5174'))
