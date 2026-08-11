const { spawn } = require('node:child_process')
const path = require('node:path')

const exe = path.join(__dirname, '..', 'release', 'win-unpacked', 'learning-desktop.exe')
const env = Object.assign({}, process.env, { SMOKE_TEST: '1' })
const child = spawn(exe, [], { env, stdio: 'inherit' })
child.on('exit', function (code) {
  console.log('packaged app exited with code ' + code)
  process.exit(code || 0)
})
child.on('error', function (err) {
  console.error('failed to start packaged app: ' + err.message)
  process.exit(1)
})
