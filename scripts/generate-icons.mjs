/**
 * Generates simple PNG icons for the MediScribe PWA.
 * Creates a blue rounded-square with a stethoscope cross symbol.
 * Uses pure Node.js Buffer + zlib to write valid PNG binary.
 */
import { createWriteStream } from 'fs'
import { deflateRawSync } from 'zlib'

function writeUint32BE(buf, offset, value) {
  buf[offset]     = (value >>> 24) & 0xff
  buf[offset + 1] = (value >>> 16) & 0xff
  buf[offset + 2] = (value >>> 8) & 0xff
  buf[offset + 3] = value & 0xff
}

function crc32(data) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); writeUint32BE(len, 0, data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBuf = Buffer.alloc(4); writeUint32BE(crcBuf, 0, crc32(crcInput))
  return Buffer.concat([len, typeBytes, data, crcBuf])
}

function generatePNG(size) {
  // RGB pixel data
  const pixels = Buffer.alloc(size * size * 3)
  const cx = size / 2, cy = size / 2
  const r = size * 0.45  // outer circle radius
  const r2 = size * 0.38 // inner area
  const crossW = size * 0.12, crossH = size * 0.32

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const off = (y * size + x) * 3

      // Background: dark blue (#0f172a)
      let pr = 0x0f, pg = 0x17, pb = 0x2a

      if (dist <= r) {
        // Circle background: #1e40af (blue-800)
        pr = 0x1e; pg = 0x40; pb = 0xaf

        // Medical cross (white) — horizontal bar
        if (Math.abs(dy) <= crossW && Math.abs(dx) <= crossH) {
          pr = 0xf8; pg = 0xfa; pb = 0xfc
        }
        // Medical cross (white) — vertical bar
        if (Math.abs(dx) <= crossW && Math.abs(dy) <= crossH) {
          pr = 0xf8; pg = 0xfa; pb = 0xfc
        }
      }

      pixels[off] = pr; pixels[off + 1] = pg; pixels[off + 2] = pb
    }
  }

  // Build PNG scanlines (filter byte 0 = None, then RGB row)
  const scanlines = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    scanlines[y * (1 + size * 3)] = 0  // filter type None
    pixels.copy(scanlines, y * (1 + size * 3) + 1, y * size * 3, (y + 1) * size * 3)
  }

  const compressed = deflateRawSync(scanlines, { level: 6 })

  // IHDR
  const ihdr = Buffer.alloc(13)
  writeUint32BE(ihdr, 0, size)   // width
  writeUint32BE(ihdr, 4, size)   // height
  ihdr[8] = 8                    // bit depth
  ihdr[9] = 2                    // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ])
}

for (const size of [192, 512]) {
  const png = generatePNG(size)
  const path = `public/icons/icon-${size}.png`
  const ws = createWriteStream(path)
  ws.write(png)
  ws.end()
  console.log(`✅ ${path} (${png.length} bytes)`)
}
