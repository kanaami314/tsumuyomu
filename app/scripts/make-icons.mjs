// public/icon.svg から、アプリ用の PNG アイコンを作る。デザインを変えたときだけ、実行する。
//   npm install --no-save sharp && node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url))
// 角丸なしの全面塗り(OS が、好きな形に切り抜く)
const maskableSvg = Buffer.from(svg.toString().replace(' rx="112"', ''))

const out = (name) => new URL(`../public/${name}`, import.meta.url)
for (const size of [192, 512]) {
  writeFileSync(out(`icon-${size}.png`), await sharp(svg).resize(size, size).png().toBuffer())
}
writeFileSync(out('icon-maskable-512.png'), await sharp(maskableSvg).resize(512, 512).png().toBuffer())
writeFileSync(out('apple-touch-icon.png'), await sharp(maskableSvg).resize(180, 180).png().toBuffer())
console.log('done')
