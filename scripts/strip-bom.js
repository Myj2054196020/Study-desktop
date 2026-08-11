const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const skip = new Set(['node_modules', 'dist', 'dist-electron', 'release', '.git'])

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else {
      const buf = fs.readFileSync(full)
      if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        fs.writeFileSync(full, buf.slice(3))
        console.log('stripped BOM: ' + path.relative(root, full))
      }
    }
  }
}

walk(root)
console.log('BOM strip done')
