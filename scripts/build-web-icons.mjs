// Builds the raster web icons and the Open Graph image from public/logo.svg (rounded tile)
// and public/logo-fullbleed.svg (square tile for platforms that round icons themselves).
// Run after a logo change: node scripts/build-web-icons.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const render = (file) => sharp(fs.readFileSync(path.join(publicDir, file))).resize(1024, 1024).png().toBuffer()

const rounded = await render('logo.svg')
const fullBleed = await render('logo-fullbleed.svg')

// iOS and Android mask the icon themselves, so they get the square tile.
await sharp(fullBleed).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'))
await sharp(fullBleed).resize(512, 512).png().toFile(path.join(publicDir, 'icon-maskable-512.png'))
await sharp(rounded).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'))
await sharp(rounded).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'))

// Open Graph card: navy tile colour, the mark on the left, the name and tagline on the right.
const W = 1200
const H = 630
const mark = await sharp(rounded).resize(400, 400).png().toBuffer()
const text = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="bg" cx="0.2" cy="0.1" r="1.1">
      <stop offset="0" stop-color="#18203A"/>
      <stop offset="1" stop-color="#0D1220"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="560" y="300" font-family="Inter, 'Segoe UI', Arial, Helvetica, sans-serif" font-size="112" font-weight="700" fill="#F1E4C8" letter-spacing="-3">Duck<tspan fill="#2EC4B6">rep</tspan></text>
  <text x="564" y="372" font-family="Inter, 'Segoe UI', Arial, Helvetica, sans-serif" font-size="36" fill="#9EB3C0">Every rep, logged.</text>
  <text x="564" y="424" font-family="Inter, 'Segoe UI', Arial, Helvetica, sans-serif" font-size="32" fill="#9EB3C0">Training and body stats, on your device.</text>
</svg>`)

await sharp(text)
  .composite([{ input: mark, left: 120, top: Math.round((H - 400) / 2) }])
  .png()
  .toFile(path.join(publicDir, 'og-image.png'))

console.log('Wrote apple-touch-icon.png, icon-maskable-512.png, icon-192.png, icon-512.png, og-image.png')
