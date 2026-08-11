const { spawn } = require('node:child_process')
const path = require('node:path')

const root = path.join(__dirname, '..')
const env = Object.assign({}, process.env, { NODE_ENV: 'development' })
const children = []

function run(name, cmd, args) {
  const child = spawn(cmd, args, { cwd: root, env, stdio: 'inherit' })
  children.push(child)
  child.on('exit', function (code) {
    console.log('[dev] ' + name + ' exited with code ' + code)
    shutdown(code)
  })
  child.on('error', function (err) {
    console.error('[dev] failed to start ' + name + ': ' + err.message)
    shutdown(1)
  })
}

function shutdown(code) {
  for (const c of children) {
    try { c.kill() } catch (e) { /* ignore */ }
  }
  process.exit(code || 0)
}

process.on('SIGINT', function () { shutdown(0) })
process.on('SIGTERM', function () { shutdown(0) })

run('vite', process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')])
run('electron', process.execPath, [path.join(root, 'node_modules', 'electron', 'cli.js'), '.'])
