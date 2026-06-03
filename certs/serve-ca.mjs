import { createServer } from 'http'
import { readFile } from 'fs'
createServer((req, res) => {
  readFile(new URL('rootCA.pem', import.meta.url), (err, data) => {
    res.writeHead(200, { 'Content-Type': 'application/x-pem-file', 'Content-Disposition': 'attachment;filename=rootCA.pem' })
    res.end(data || err?.message || 'not found')
  })
}).listen(8080, () => console.log('CA cert server on port 8080'))
