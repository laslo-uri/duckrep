import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const svgPath = path.join(root, 'src-tauri', 'icon-source.svg')
const outDir = path.join(root, 'src-tauri', 'icons')
const icoPath = path.join(outDir, 'icon.ico')

const sizes = [16, 24, 32, 48, 64, 128, 256]
const svg = fs.readFileSync(svgPath)

const master = await sharp(svg)
  .resize(1024, 1024)
  .png()
  .toBuffer()

const pngBuffers = await Promise.all(
  sizes.map((size) => sharp(master).resize(size, size).png().toBuffer()),
)

const ico = await pngToIco(pngBuffers)
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(icoPath, ico)

for (const size of [32, 64, 128, 256]) {
  await sharp(master).resize(size, size).png().toFile(path.join(outDir, `${size}x${size}.png`))
}
await sharp(master).resize(256, 256).png().toFile(path.join(outDir, '128x128@2x.png'))
await sharp(master).resize(512, 512).png().toFile(path.join(outDir, 'icon.png'))

console.log(`Wrote ${icoPath} (${ico.length} bytes)`)
