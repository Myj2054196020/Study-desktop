const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const SIZE = 256

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n += 1) {
    c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

const px = Buffer.alloc(SIZE * SIZE * 4, 0)

function setPx(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = a
}

function mix(c1, c2, t) {
  return Math.round(c1 + (c2 - c1) * t)
}

function inRoundedRect(x, y, x0, y0, x1, y1, rad) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.max(x0 + rad, Math.min(x, x1 - rad))
  const cy = Math.max(y0 + rad, Math.min(y, y1 - rad))
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= rad * rad
}

function drawLine(x0, y0, x1, y1, width, r, g, b) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2))
  const w = width / 2
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const x = Math.round(x0 + (x1 - x0) * t)
    const y = Math.round(y0 + (y1 - y0) * t)
    for (let dy = -w; dy <= w; dy += 1) {
      for (let dx = -w; dx <= w; dx += 1) {
        if (dx * dx + dy * dy <= w * w) {
          setPx(x + dx, y + dy, r, g, b, 255)
        }
      }
    }
  }
}

// gradient rounded background (indigo -> blue)
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    if (inRoundedRect(x, y, 14, 14, 241, 241, 52)) {
      const t = (x + y) / (2 * SIZE)
      setPx(x, y, mix(79, 59, t), mix(70, 130, t), mix(229, 246, t), 255)
    }
  }
}

// graduation cap: diamond
const capCx = 128
const capCy = 112
const capW = 66
const capH = 30
for (let y = capCy - capH; y <= capCy + capH; y += 1) {
  for (let x = capCx - capW; x <= capCx + capW; x += 1) {
    const dx = Math.abs(x - capCx) / capW
    const dy = Math.abs(y - capCy) / capH
    if (dx + dy <= 1) {
      setPx(x, y, 255, 255, 255, 255)
    }
  }
}

// cap band
for (let y = 130; y <= 152; y += 1) {
  for (let x = 66; x <= 190; x += 1) {
    if (x >= 66 && x <= 190) {
      setPx(x, y, 255, 255, 255, 255)
    }
  }
}

// cap button
for (let dy = -6; dy <= 6; dy += 1) {
  for (let dx = -6; dx <= 6; dx += 1) {
    if (dx * dx + dy * dy <= 36) {
      setPx(capCx + dx, capCy + dy, 251, 191, 36, 255)
    }
  }
}

// tassel
drawLine(176, 92, 200, 70, 6, 251, 191, 36)
for (let dy = -5; dy <= 5; dy += 1) {
  for (let dx = -5; dx <= 5; dx += 1) {
    if (dx * dx + dy * dy <= 25) {
      setPx(208 + dx, 62 + dy, 251, 191, 36, 255)
    }
  }
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y += 1) {
  const rowStart = y * (SIZE * 4 + 1)
  raw[rowStart] = 0
  px.copy(raw, rowStart + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const idat = zlib.deflateSync(raw)
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
])

const out = path.join(__dirname, '..', 'assets', 'icon.png')
fs.writeFileSync(out, png)
console.log('icon.png written: ' + png.length + ' bytes -> ' + out)
