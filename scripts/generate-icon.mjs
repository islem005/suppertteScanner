// ── Generate a minimal 192x192 PNG icon for PWA manifest ──
// Uses only Node.js built-ins (zlib, buffer) — no external deps
import { writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

function crc32(buf) {
  let crc = 0xffffffff
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeB = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeB, data])
  const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc32(crcData), 0)
  return Buffer.concat([len, typeB, data, crcB])
}

const SIZE = 192

// Generate pixel data: dark background with a barcode-like shape
const raw = Buffer.alloc(SIZE * SIZE * 3, 0x0c) // dark bg
// Draw a white-ish barcode rectangle
for (let y = 40; y < 152; y++) {
  for (let x = 36; x < 156; x++) {
    const i = (y * SIZE + x) * 3
    if (x >= 36 && x <= 40) { raw[i] = 0x63; raw[i+1] = 0x66; raw[i+2] = 0xf1 } // primary blue
    else if (x >= 48 && x <= 50) { raw[i] = 0xff; raw[i+1] = 0xff; raw[i+2] = 0xff }
    else if (x >= 56 && x <= 62) { raw[i] = 0x63; raw[i+1] = 0x66; raw[i+2] = 0xf1 }
    else if (x >= 68 && x <= 70) { raw[i] = 0xff; raw[i+1] = 0xff; raw[i+2] = 0xff }
    else if (x >= 76 && x <= 82) { raw[i] = 0xff; raw[i+1] = 0xff; raw[i+2] = 0xff }
    else if (x >= 88 && x <= 92) { raw[i] = 0x63; raw[i+1] = 0x66; raw[i+2] = 0xf1 }
    else if (x >= 100 && x <= 102) { raw[i] = 0xff; raw[i+1] = 0xff; raw[i+2] = 0xff }
    else if (x >= 108 && x <= 110) { raw[i] = 0x63; raw[i+1] = 0x66; raw[i+2] = 0xf1 }
    else if (x >= 116 && x <= 120) { raw[i] = 0xff; raw[i+1] = 0xff; raw[i+2] = 0xff }
    else if (x >= 126 && x <= 130) { raw[i] = 0x10; raw[i+1] = 0xb9; raw[i+2] = 0x81 } // green
    else if (x >= 136 && x <= 140) { raw[i] = 0xff; raw[i+1] = 0xff; raw[i+2] = 0xff }
    else if (x >= 146 && x <= 150) { raw[i] = 0x63; raw[i+1] = 0x66; raw[i+2] = 0xf1 }
  }
}

// Add filter bytes per row
const filtered = Buffer.alloc(SIZE * SIZE * 3 + SIZE)
for (let y = 0; y < SIZE; y++) {
  filtered[y * (SIZE * 3 + 1)] = 0
  raw.copy(filtered, y * (SIZE * 3 + 1) + 1, y * SIZE * 3, (y + 1) * SIZE * 3)
}

const compressed = deflateSync(filtered)
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const ihdrData = Buffer.alloc(13)
ihdrData.writeUInt32BE(SIZE, 0)
ihdrData.writeUInt32BE(SIZE, 4)
ihdrData[8] = 8  // bit depth
ihdrData[9] = 2  // RGB
ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdrData),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0))
])

writeFileSync('assets/icons/icon-192.png', png)
console.log('✓ Generated assets/icons/icon-192.png (' + png.length + ' bytes)')
