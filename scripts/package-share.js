const { execSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const root = path.join(__dirname, '..')
process.env.ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
console.log('1/2 构建并打包安装程序...')
execSync('npm run package', { cwd: root, stdio: 'inherit' })

const release = path.join(root, 'release')
const unpacked = path.join(release, 'win-unpacked')
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
const zipName = 'Study desktop-便携版-v' + version + '.zip'
const zipPath = path.join(release, zipName)

console.log('2/2 生成便携版压缩包（免安装，发给别人直接解压运行）...')
const q = String.fromCharCode(39)
const ps = 'Compress-Archive -Path ' + q + path.join(unpacked, '*') + q + ' -DestinationPath ' + q + zipPath + q + ' -Force'
execSync('powershell -NoProfile -Command ' + ps, { cwd: root, stdio: 'inherit' })

console.log('')
console.log('完成！分享以下文件即可：')
console.log('  1. 安装包: ' + path.join(release, 'Study desktop Setup ' + version + '.exe'))
console.log('  2. 便携版: ' + zipPath)




