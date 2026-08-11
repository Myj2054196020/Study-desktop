/**
 * gen-icon-final.js — 最终图标合成（SVG 生成）
 * 组成：Noto 猫头鹰（Apache-2.0, Google）+ Twemoji 月牙（CC-BY 4.0, Twitter）
 *       + 原创夜空渐变 / 四角星 / 厚书
 * 生成: assets/brand/xiaogu-final.svg 与 xiaogu-tray-final.svg
 * 用法: node scripts/gen-icon-final.js
 * 注: 栅格化（PNG/ICO）用 Electron 无头渲染，见 docs/品牌设计规范-小咕.md
 */
const fs = require('node:fs')
const path = require('node:path')
const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'assets', 'brand')

const noto = fs.readFileSync(path.join(OUT, 'noto-owl.svg'), 'utf8')
const inner = noto.replace(/<\?xml[^>]*\?>\s*/g, '').replace(/<!--[\s\S]*?-->/g, '')
const m = inner.match(/<svg[\s\S]*?viewBox="0 0 128 128"[\s\S]*?>(<g>[\s\S]*?)<\/svg>/)
let owlContent
if (m) owlContent = m[1]
else {
  const open = inner.indexOf('>', inner.indexOf('<svg'))
  owlContent = inner.slice(open + 1, inner.lastIndexOf('</svg>'))
}
owlContent = owlContent.replace(/^<g>/, '').replace(/<\/g>$/, '')

function star4(cx, cy, ro, ri) {
  let d = ''
  for (let i = 0; i < 8; i += 1) {
    const r = i % 2 === 0 ? ro : ri
    const ang = (i / 8) * Math.PI * 2 - Math.PI / 2
    const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang)
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' '
  }
  return d + 'Z'
}
// Twemoji 🌙 标准月牙
const MOON = 'M30.312.776C32 19 20 32 .776 30.312c8.199 7.717 21.091 7.588 29.107-.429C37.9 21.867 38.03 8.975 30.312.776z'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
  <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4A50A8"/>
    <stop offset="1" stop-color="#242958"/>
  </linearGradient>
</defs>
<rect width="512" height="512" fill="url(#night)"/>
<g transform="translate(51.2, 61.8) scale(1.49)"><path d="${MOON}" fill="#F5B83D"/></g>
<path d="${star4(128, 62, 8, 3)}" fill="#FFFFFF" opacity="0.95"/>
<path d="${star4(66, 128, 6, 2.2)}" fill="#FFFFFF" opacity="0.85"/>
<g transform="translate(48, 62.4) scale(3.2)">${owlContent}</g>
<rect x="146" y="458" width="220" height="16" rx="6" fill="#8E2F3C"/>
<path d="M156,458 L256,458 L246,440 L166,440 Z" fill="#F5EFDD"/>
<path d="M256,458 L356,458 L346,440 L266,440 Z" fill="#F5EFDD"/>
<rect x="253" y="440" width="6" height="18" fill="#8E2F3C"/>
</svg>`
fs.writeFileSync(path.join(OUT, 'xiaogu-final.svg'), svg, 'utf8')

const traySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<g transform="translate(9, 6) scale(0.86)">${owlContent}</g>
</svg>`
fs.writeFileSync(path.join(OUT, 'xiaogu-tray-final.svg'), traySvg, 'utf8')
console.log('xiaogu-final.svg / xiaogu-tray-final.svg generated')
