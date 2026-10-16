// Builds the raster web icons and the Open Graph image from public/logo.svg.
// Run after a logo change: node scripts/build-web-icons.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const logo = fs.readFileSync(path.join(publicDir, 'logo.svg'))

const master = await sharp(logo).resize(1024, 1024).png().toBuffer()

await sharp(master).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'))
await sharp(master).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'))
await sharp(master).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'))

// Open Graph card: dark paper, the mark on the left, the name and tagline on the right.
const W = 1200
const H = 630
const mark = await sharp(master).resize(400, 400).png().toBuffer()
const text = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#121418"/>
  <text x="560" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="112" font-weight="600" fill="#f3f6f8" letter-spacing="-3">YouPeak</text>
  <text x="564" y="372" font-family="Arial, Helvetica, sans-serif" font-size="36" fill="#9eb3c0">Local gym journal</text>
  <text x="564" y="424" font-family="Arial, Helvetica, sans-serif" font-size="36" fill="#9eb3c0">Activities, exercises, food, body stats</text>
</svg>`)

await sharp(text)
  .composite([{ input: mark, left: 120, top: Math.round((H - 400) / 2) }])
  .png()
  .toFile(path.join(publicDir, 'og-image.png'))

console.log('Wrote apple-touch-icon.png, icon-192.png, icon-512.png, og-image.png')
