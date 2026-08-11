const { spawn } = require('node:child_process')
const path = require('node:path')

const exe = path.join('C:', 'Users', '20541', 'AppData', 'Local', 'Programs', 'Study desktop', 'Study desktop.exe')
const env = Object.assign({}, process.env, { SMOKE_TEST: '1' })
const child = spawn(exe, [], { env, stdio: 'inherit' })
child.on('exit', function (code) {
  console.log('installed app exited with code ' + code)
  process.exit(code || 0)
})
child.on('error', function (err) {
  console.error('failed to start installed app: ' + err.message)
  process.exit(1)
})
