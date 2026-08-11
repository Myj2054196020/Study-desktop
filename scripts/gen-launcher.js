const fs = require('node:fs')
const path = require('node:path')

const q = String.fromCharCode(34)
const exe = 'E:\\code\\learning-desktop\\release\\win-unpacked\\Study desktop.exe'
const content = '@echo off\r\nstart ' + q + '' + q + ' ' + q + exe + q + '\r\n'

const targets = [
  path.join(__dirname, '..', '启动学习应用.bat'),
  'E:\\code\\启动学习应用.bat',
]
for (const t of targets) {
  fs.writeFileSync(t, content, 'utf8')
  console.log('launcher written: ' + t)
}
