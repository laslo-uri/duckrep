// Android launcher icons for the Capacitor shell: legacy square + round from the full-bleed tile,
// adaptive foreground = the duck alone inside the 66% safe zone (background colour is #09090B).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pub = (f) => fs.readFileSync(path.join(root, 'public', f))
const res = path.join(root, 'android/app/src/main/res')
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const full = await sharp(pub('logo-fullbleed.svg')).resize(1024, 1024).png().toBuffer()
const mark = await sharp(pub('duckrep-mark.svg')).resize(1024, 1024).png().toBuffer()
for (const [d, k] of Object.entries(dens)) {
  const dir = path.join(res, `mipmap-${d}`)
  const legacy = Math.round(48 * k)
  await sharp(full).resize(legacy, legacy).png().toFile(path.join(dir, 'ic_launcher.png'))
  const circle = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`)
  await sharp(full).resize(legacy, legacy).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(path.join(dir, 'ic_launcher_round.png'))
  const fg = Math.round(108 * k)
  const inner = Math.round(fg * 0.72)
  const duck = await sharp(mark).resize(inner, inner).png().toBuffer()
  await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: duck, left: Math.round((fg - inner) / 2), top: Math.round((fg - inner) / 2) }])
    .png().toFile(path.join(dir, 'ic_launcher_foreground.png'))
}
console.log('android icons written')
