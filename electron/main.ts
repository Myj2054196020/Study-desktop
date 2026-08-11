import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DataStore } from './ipc/database'
import { buildIndex, search } from './ipc/search'
import { exportAllData, exportCardsCsv, exportChapterToMarkdown, exportMarkdownFolder, exportTextToFile, importChaptersFolder, importData } from './ipc/fileSystem'
import type { AISession, AppSettings, Chapter, DailyTask, Goal, Lesson, Mistake, PomodoroRecord, QuizRecord, ReadingRecord, Reflection, Resource, ReviewCard, Subject, Textbook, VideoNote } from './types'

const isDev = process.env.NODE_ENV === 'development'
const isSmoke = process.env.SMOKE_TEST === '1'

let mainWindow: BrowserWindow | null = null
let store: DataStore | null = null
let tray: Tray | null = null
let isQuitting = false
let isFirstRun = false
let pseudoMaximized = false
let maxRestoreBounds: Electron.Rectangle | null = null
let widgetWindow: BrowserWindow | null = null
let notesWindow: BrowserWindow | null = null
let lastPomodoroState: { isRunning: boolean; timeLeft: number; totalSession: number } | null = null
let hasShownTrayHint = false
const lastLessonNotified: Record<string, string> = {}
const lastTaskNotified: Record<string, string> = {}

function createNotesWindow(): void {
  if (notesWindow) {
    notesWindow.show()
    notesWindow.focus()
    return
  }
  notesWindow = new BrowserWindow({
    width: 280,
    height: 240,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  notesWindow.setAlwaysOnTop(true, 'screen-saver')
  const display = screen.getPrimaryDisplay()
  const area = display.workArea
  notesWindow.setPosition(area.x + area.width - 300, area.y + area.height - 300)
  if (isDev) {
    notesWindow.loadURL('http://localhost:5174/notes.html')
  } else {
    notesWindow.loadFile(path.join(__dirname, '..', 'dist', 'notes.html'))
  }
  notesWindow.on('closed', function () {
    notesWindow = null
  })
}

function createWidgetWindow(): void {
  if (widgetWindow) {
    widgetWindow.show()
    widgetWindow.focus()
    return
  }
  widgetWindow = new BrowserWindow({
    width: 250,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  widgetWindow.setAlwaysOnTop(true, 'screen-saver')
  const display = screen.getPrimaryDisplay()
  const area = display.workArea
  widgetWindow.setPosition(area.x + area.width - 270, area.y + area.height - 130)
  if (isDev) {
    widgetWindow.loadURL('http://localhost:5174/widget.html')
  } else {
    widgetWindow.loadFile(path.join(__dirname, '..', 'dist', 'widget.html'))
  }
  widgetWindow.on('closed', function () {
    widgetWindow = null
  })
  sendPomodoroState()
}

function sendPomodoroState(): void {
  if (widgetWindow && lastPomodoroState) {
    widgetWindow.webContents.send('widget:state', lastPomodoroState)
  }
}

function notifyUser(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:notify', { title, body })
  }
}

function syncToFolder(): string {
  if (!store) return ''
  const folder = store.getSettings().syncFolder
  if (!folder) return ''
  try {
    fs.mkdirSync(folder, { recursive: true })
    const file = path.join(folder, 'study-desktop-data.json')
    fs.writeFileSync(file, store.exportAll(), 'utf8')
    return file
  } catch (err) {
    console.log('folder sync failed: ' + String(err))
    return ''
  }
}

function backupData(): void {
  if (!store) return
  try {
    const backupsDir = path.join(app.getPath('userData'), 'backups')
    fs.mkdirSync(backupsDir, { recursive: true })
    const now = new Date()
    const pad = function (n: number) { return n < 10 ? '0' + String(n) : String(n) }
    const stamp = String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes())
    const file = path.join(backupsDir, 'learning-backup-' + stamp + '.json')
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, store.exportAll(), 'utf8')
      console.log('backup written: ' + file)
    }
    const files = fs.readdirSync(backupsDir).filter(function (f) { return f.endsWith('.json') }).sort()
    while (files.length > 10) {
      const oldest = files.shift()
      if (oldest) {
        fs.unlinkSync(path.join(backupsDir, oldest))
      }
    }
  } catch (err) {
    console.log('backup failed: ' + String(err))
  }
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    title: 'Study desktop',
    backgroundColor: '#f7f8fa',
    icon: path.join(__dirname, '..', 'assets', 'brand', 'xiaogu-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  if (process.argv.indexOf('--hidden') !== -1 && !isFirstRun) {
    mainWindow.hide()
  }

  mainWindow.on('close', function (event) {
    if (!isQuitting) {
      event.preventDefault()
      if (mainWindow) mainWindow.hide()
    }
  })
  mainWindow.on('closed', function () {
    mainWindow = null
  })

  // ????????/???? Win+? ??????????????????
  mainWindow.on('maximize', function () {
    pseudoMaximized = true
  })
  mainWindow.on('unmaximize', function () {
    pseudoMaximized = false
    maxRestoreBounds = null
  })

  if (isSmoke) {
    const failTimer = setTimeout(function () {
      console.log('SMOKE_FAIL timeout')
      app.exit(1)
    }, 60000)
    mainWindow.webContents.on('console-message', function (_event, ...args: unknown[]) {
      console.log('SMOKE_CONSOLE ' + args.join(' '))
    })
    mainWindow.webContents.on('did-fail-load', function (_event, code, desc, url) {
      console.log('SMOKE_LOAD_FAIL ' + code + ' ' + desc + ' ' + url)
    })
    mainWindow.webContents.on('did-finish-load', function () {
      clearTimeout(failTimer)
      const sq = String.fromCharCode(39)
      const probe = function (ms: number, label: string, script: string) {
        setTimeout(function () {
          if (!mainWindow) return
          mainWindow.webContents.executeJavaScript(script).then(function (result) {
            console.log('SMOKE_PROBE ' + label + ' ' + String(result))
          }).catch(function (err) {
            console.log('SMOKE_PROBE_ERROR ' + label + ' ' + String(err))
          })
        }, ms)
      }
      probe(2500, 'renderer', 'JSON.stringify({ api: typeof window.electronAPI, root: document.getElementById(' + sq + 'root' + sq + ') !== null, navItems: document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + ').length, title: document.title })')
      probe(3000, 'dashboard', 'JSON.stringify({ hero: document.querySelectorAll(' + sq + '.dashboard-hero' + sq + ').length, dashCards: document.querySelectorAll(' + sq + '.dash-card' + sq + ').length, goalAdd: document.querySelectorAll(' + sq + '.goal-add-row' + sq + ').length })')
      probe(3500, 'click-tasks', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[1]) { items[1].click(); return true } return false })()')
      probe(4700, 'tasks', 'JSON.stringify({ input: document.querySelectorAll(' + sq + '.task-input' + sq + ').length, repeatSection: document.querySelectorAll(' + sq + '.repeat-section' + sq + ').length })')
      probe(5200, 'click-mistakes', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[3]) { items[3].click(); return true } return false })()')
      probe(6200, 'mistakes', 'JSON.stringify({ filters: document.querySelectorAll(' + sq + '.filter-chip' + sq + ').length, newBtn: document.querySelectorAll(' + sq + '.mistakes-page .page-header .btn' + sq + ').length })')
      probe(6700, 'click-ai', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[11]) { items[11].click(); return true } return false })()')
      probe(7700, 'ai', 'JSON.stringify({ page: document.querySelectorAll(' + sq + '.ai-page' + sq + ').length, unconfigured: document.querySelectorAll(' + sq + '.ai-unconfigured' + sq + ').length })')
      probe(8200, 'click-bilibili', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[12]) { items[12].click(); return true } return false })()')
      probe(9200, 'bilibili', 'JSON.stringify({ cards: document.querySelectorAll(' + sq + '.bili-card' + sq + ').length, chips: document.querySelectorAll(' + sq + '.bili-chip' + sq + ').length })')
      probe(9700, 'click-cards', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[4]) { items[4].click(); return true } return false })()')
      probe(11000, 'cards', 'JSON.stringify({ reviewSection: document.querySelectorAll(' + sq + '.review-section' + sq + ').length, generateSection: document.querySelectorAll(' + sq + '.generate-section' + sq + ').length })')
      probe(11500, 'click-timetable', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[7]) { items[7].click(); return true } return false })()')
      probe(12600, 'timetable', 'JSON.stringify({ wrap: document.querySelectorAll(' + sq + '.timetable-wrap' + sq + ').length, cols: document.querySelectorAll(' + sq + '.timetable-col' + sq + ').length })')
      probe(13100, 'click-bookshelf', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[8]) { items[8].click(); return true } return false })()')
      probe(14200, 'bookshelf', 'JSON.stringify({ addBtn: document.querySelectorAll(' + sq + '.bookshelf-page .page-header .btn' + sq + ').length })')
      probe(14700, 'click-reflections', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[5]) { items[5].click(); return true } return false })()')
      probe(16000, 'reflections', 'JSON.stringify({ newBtn: document.querySelectorAll(' + sq + '.reflections-page .page-header .btn' + sq + ').length })')
      probe(16500, 'click-graph', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[10]) { items[10].click(); return true } return false })()')
      probe(18500, 'graph', 'JSON.stringify({ canvases: document.querySelectorAll(' + sq + '.graph-container canvas' + sq + ').length, legend: document.querySelector(' + sq + '.legend-count' + sq + ') ? document.querySelector(' + sq + '.legend-count' + sq + ').textContent : ' + sq + 'none' + sq + ' })')
      probe(19000, 'click-stats', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[9]) { items[9].click(); return true } return false })()')
      probe(21200, 'stats', 'JSON.stringify({ chartSvgs: document.querySelectorAll(' + sq + '.chart-card svg' + sq + ').length, statCards: document.querySelectorAll(' + sq + '.stat-card' + sq + ').length, heatmap: document.querySelectorAll(' + sq + '.heatmap-wrap svg rect' + sq + ').length })')
      probe(21700, 'click-settings', '(function () { var items = document.querySelectorAll(' + sq + '.sidebar-nav-item' + sq + '); if (items[13]) { items[13].click(); return true } return false })()')
      probe(23000, 'settings', 'JSON.stringify({ subjectCards: document.querySelectorAll(' + sq + '.setting-card' + sq + ').length, toggleRows: document.querySelectorAll(' + sq + '.setting-toggle-row' + sq + ').length })')
      setTimeout(function () {
        console.log('SMOKE_OK')
        app.quit()
      }, 24500)
    })
  }
}

function registerIpc(): void {
  ipcMain.handle('search', function (_event, query: string) {
    if (!store) return []
    const index = buildIndex(store.getAllChapters(), store.getTextbooks(), {
      reflections: store.getReflections(),
      tasks: store.getAllDailyTasks(),
    })
    return search(index, query || '', 30)
  })

  ipcMain.handle('chapters:getAll', function () {
    return store ? store.getAllChapters() : []
  })
  ipcMain.handle('chapters:getTextbooks', function () {
    return store ? store.getTextbooks() : []
  })
  ipcMain.handle('chapters:get', function (_event, id: string) {
    return store ? store.getChapter(id) || null : null
  })
  ipcMain.handle('chapters:update', function (_event, id: string, data: Partial<Chapter>) {
    if (!store) return false
    store.updateChapter(id, data)
    return true
  })
  ipcMain.handle('chapters:add', function (_event, data: Partial<Chapter>) {
    if (!store) return null
    return store.insertChapter(data)
  })
  ipcMain.handle('chapters:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteChapter(id)
    return true
  })

  ipcMain.handle('pomodoro:history', function () {
    return store ? store.getPomodoroRecords() : []
  })
  ipcMain.handle('pomodoro:save', function (_event, record: PomodoroRecord) {
    if (!store) return false
    store.savePomodoroRecord(record)
    return true
  })

  ipcMain.handle('stats:get', function (_event, days?: number) {
    return store ? store.getStats(days) : null
  })

  ipcMain.handle('tasks:get', function (_event, date?: string) {
    return store ? store.getDailyTasks(date) : []
  })
  ipcMain.handle('tasks:getAll', function () {
    return store ? store.getAllDailyTasks() : []
  })
  ipcMain.handle('tasks:save', function (_event, task: DailyTask) {
    if (!store) return null
    store.saveDailyTask(task)
    return task
  })
  ipcMain.handle('tasks:toggle', function (_event, id: string, completed: boolean) {
    if (!store) return false
    store.toggleDailyTask(id, completed)
    return true
  })
  ipcMain.handle('tasks:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteDailyTask(id)
    return true
  })
  ipcMain.handle('tasks:addFocused', function (_event, id: string, minutes: number) {
    if (!store) return false
    store.addTaskFocusedMinutes(id, minutes)
    return true
  })
  ipcMain.handle('tasks:setEstimate', function (_event, id: string, minutes: number) {
    if (!store) return false
    store.setTaskEstimate(id, minutes)
    return true
  })
  ipcMain.handle('reflections:get', function () {
    return store ? store.getReflections() : []
  })
  ipcMain.handle('reflections:save', function (_event, reflection: Reflection) {
    if (!store) return null
    store.saveReflection(reflection)
    return reflection
  })
  ipcMain.handle('reflections:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteReflection(id)
    return true
  })

  ipcMain.handle('subjects:get', function () {
    return store ? store.getSubjects() : []
  })
  ipcMain.handle('subjects:save', function (_event, subject: Subject) {
    if (!store) return null
    store.saveSubject(subject)
    return subject
  })
  ipcMain.handle('subjects:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteSubject(id)
    return true
  })
  ipcMain.handle('textbooks:update', function (_event, id: string, patch: Partial<Textbook>) {
    if (!store) return false
    store.updateTextbook(id, patch)
    return true
  })
  ipcMain.handle('textbooks:add', function (_event, data: Partial<Textbook>) {
    if (!store) return null
    return store.insertTextbook(data)
  })
  ipcMain.handle('cards:get', function () {
    return store ? store.getCards() : []
  })
  ipcMain.handle('cards:due', function (_event, limit?: number) {
    return store ? store.getDueCards(limit) : []
  })
  ipcMain.handle('cards:save', function (_event, card: ReviewCard) {
    if (!store) return null
    store.saveCard(card)
    return card
  })
  ipcMain.handle('cards:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteCard(id)
    return true
  })
  ipcMain.handle('cards:grade', function (_event, id: string, grade: number) {
    if (!store) return null
    return store.gradeCard(id, grade)
  })
  ipcMain.handle('lessons:get', function () {
    return store ? store.getLessons() : []
  })
  ipcMain.handle('lessons:save', function (_event, lesson: Lesson) {
    if (!store) return null
    store.saveLesson(lesson)
    return lesson
  })
  ipcMain.handle('lessons:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteLesson(id)
    return true
  })
  ipcMain.handle('resources:get', function () {
    return store ? store.getResources() : []
  })
  ipcMain.handle('resources:save', function (_event, resource: Resource) {
    if (!store) return null
    store.saveResource(resource)
    return resource
  })
  ipcMain.handle('resources:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteResource(id)
    return true
  })
  ipcMain.handle('resources:progress', function (_event, id: string, patch: Partial<Resource>) {
    if (!store) return false
    store.updateResourceProgress(id, patch)
    return true
  })
  ipcMain.handle('resources:pickFile', async function () {
    if (!mainWindow || !store) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择资料文件',
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths || !result.filePaths[0]) {
      return null
    }
    return result.filePaths[0]
  })
  ipcMain.handle('resources:openFile', function (_event, filePath: string) {
    if (!filePath) return 'no path'
    shell.openPath(filePath).then(function (err) {
      if (err) console.log('open path error: ' + err)
    })
    return 'ok'
  })
  ipcMain.handle('settings:get', function () {
    return store ? store.getSettings() : null
  })
  ipcMain.handle('settings:save', function (_event, settings: AppSettings) {
    if (!store) return false
    store.saveSettings(settings)
    try {
      app.setLoginItemSettings({
        openAtLogin: !!settings.autoStart,
        args: settings.autoStart && settings.startHidden ? ['--hidden'] : [],
      })
    } catch (err) {
      console.log('setLoginItemSettings failed: ' + String(err))
    }
    if (settings.syncFolder) {
      syncToFolder()
    }
    return true
  })
  ipcMain.handle('schedule:ebbinghaus', function (_event, chapterId: string) {
    if (!store) return []
    return store.scheduleEbbinghaus(chapterId)
  })
  ipcMain.handle('ai:chat', async function (_event, messages: { role: string; content: string }[]) {
    if (!store) return 'AI 未配置'
    const settings = store.getSettings()
    if (!settings.aiApiKey) {
      return 'AI 未配置：请在「设置」中填写 API Key'
    }
    try {
      const base = settings.aiBaseUrl.replace(/\/+$/, '')
      const res = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + settings.aiApiKey,
        },
        body: JSON.stringify({
          model: settings.aiModel,
          messages: messages.map(function (m) { return { role: m.role, content: m.content } }),
          temperature: 0.4,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        return 'AI 请求失败（' + String(res.status) + '）：' + text.slice(0, 200)
      }
      const json: any = await res.json()
      const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content
      return content ? String(content) : 'AI 返回为空'
    } catch (err) {
      return 'AI 请求异常：' + String(err)
    }
  })
  ipcMain.handle('goals:get', function () {
    return store ? store.getGoals() : []
  })
  ipcMain.handle('goals:save', function (_event, goal: Goal) {
    if (!store) return null
    store.saveGoal(goal)
    return goal
  })
  ipcMain.handle('goals:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteGoal(id)
    return true
  })
  ipcMain.handle('tasks:templates', function () {
    return store ? store.getTaskTemplates() : []
  })
  ipcMain.handle('tasks:deleteTemplate', function (_event, id: string) {
    if (!store) return false
    store.deleteTaskTemplate(id)
    return true
  })
  ipcMain.handle('chapters:importMarkdown', async function () {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入 Markdown 文件',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths || !result.filePaths[0]) {
      return null
    }
    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
    const titleMatch = content.match(/^#\s+(.+)/m)
    return {
      filePath,
      title: titleMatch ? titleMatch[1].trim() : undefined,
      content,
    }
  })
  ipcMain.handle('resources:readFile', function (_event, filePath: string) {
    try {
      return fs.readFileSync(filePath)
    } catch (err) {
      return null
    }
  })
  ipcMain.handle('app:checkUpdate', async function () {
    if (!app.isPackaged) {
      return '开发模式不支持自动更新'
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      return result && result.updateInfo ? '发现新版本：' + result.updateInfo.version : '当前已是最新版本'
    } catch (err) {
      return '检查更新失败：' + String(err)
    }
  })
  ipcMain.handle('aiSessions:get', function () {
    return store ? store.getAISessions() : []
  })
  ipcMain.handle('aiSessions:save', function (_event, session: AISession) {
    if (!store) return null
    store.saveAISession(session)
    return session
  })
  ipcMain.handle('aiSessions:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteAISession(id)
    return true
  })
  ipcMain.handle('quizzes:get', function () {
    return store ? store.getQuizzes() : []
  })
  ipcMain.handle('quizzes:save', function (_event, quiz: QuizRecord) {
    if (!store) return null
    store.saveQuiz(quiz)
    return quiz
  })
  ipcMain.handle('quizzes:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteQuiz(id)
    return true
  })
  ipcMain.handle('export:saveText', async function (_event, title: string, content: string, ext?: string) {
    if (!mainWindow) return 'no window'
    return exportTextToFile(mainWindow, title || 'export', content, ext)
  })
  ipcMain.handle('obsidian:export', async function () {
    if (!mainWindow || !store) return ''
    const folder = store.getSettings().obsidianFolder
    if (!folder) return 'no folder'
    return exportMarkdownFolder(mainWindow, store, folder)
  })
  ipcMain.handle('obsidian:import', async function () {
    if (!mainWindow || !store) return 0
    const folder = store.getSettings().obsidianFolder
    if (!folder) return 0
    return importChaptersFolder(mainWindow, store, folder)
  })
  ipcMain.handle('notesWidget:toggle', function () {
    if (notesWindow) {
      notesWindow.close()
      return 'closed'
    }
    createNotesWindow()
    return 'opened'
  })
  ipcMain.handle('notesWidget:load', function () {
    try {
      const file = path.join(app.getPath('userData'), 'notes-widget.txt')
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    } catch (err) {
      return ''
    }
  })
  ipcMain.handle('notesWidget:save', function (_event, content: string) {
    try {
      fs.writeFileSync(path.join(app.getPath('userData'), 'notes-widget.txt'), content || '', 'utf8')
      return true
    } catch (err) {
      return false
    }
  })
  ipcMain.handle('app:show', function () {
    showMainWindow()
    return true
  })
  ipcMain.handle('widget:toggle', function () {
    if (widgetWindow) {
      widgetWindow.close()
      return 'closed'
    }
    createWidgetWindow()
    return 'opened'
  })
  ipcMain.handle('widget:close', function () {
    if (widgetWindow) {
      widgetWindow.close()
    }
    return true
  })
  ipcMain.handle('pomodoro:sync', function (_event, state: { isRunning: boolean; timeLeft: number; totalSession: number }) {
    lastPomodoroState = state
    sendPomodoroState()
    return true
  })
  ipcMain.handle('app:backupNow', function () {
    if (!store) return ''
    backupData()
    return path.join(app.getPath('userData'), 'backups')
  })

  ipcMain.handle('mistakes:get', function () {
    return store ? store.getMistakes() : []
  })
  ipcMain.handle('mistakes:save', function (_event, mistake: Mistake) {
    if (!store) return null
    store.saveMistake(mistake)
    return mistake
  })
  ipcMain.handle('videoNotes:get', function () {
    return store ? store.getVideoNotes() : []
  })
  ipcMain.handle('videoNotes:save', function (_event, video: VideoNote) {
    if (!store) return null
    store.saveVideoNote(video)
    return video
  })
  ipcMain.handle('videoNotes:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteVideoNote(id)
    return true
  })
  ipcMain.handle('openExternal', function (_event, url: string) {
    if (url) shell.openExternal(url)
    return true
  })
  ipcMain.handle('mistakes:delete', function (_event, id: string) {
    if (!store) return false
    store.deleteMistake(id)
    return true
  })
  ipcMain.handle('export:cardsCsv', async function () {
    if (!mainWindow || !store) return 'no window'
    return exportCardsCsv(mainWindow, store)
  })
  ipcMain.handle('export:markdownFolder', async function () {
    if (!mainWindow || !store) return 'no window'
    return exportMarkdownFolder(mainWindow, store)
  })
  ipcMain.handle('chapters:importFolder', async function () {
    if (!mainWindow || !store) return 0
    return importChaptersFolder(mainWindow, store)
  })
  ipcMain.handle('app:pickFolder', async function () {
    if (!mainWindow) return ''
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择文件夹',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths || !result.filePaths[0]) {
      return ''
    }
    return result.filePaths[0]
  })
  ipcMain.handle('sync:now', function () {
    return syncToFolder()
  })
  ipcMain.handle('bilibili:search', function (_event, keyword: string) {
    if (keyword && keyword.trim()) {
      shell.openExternal('https://search.bilibili.com/all?keyword=' + encodeURIComponent(keyword.trim()))
    }
    return true
  })
  ipcMain.handle('bilibili:favorites', function (_event, uid: string) {
    if (uid && uid.trim()) {
      shell.openExternal('https://space.bilibili.com/' + encodeURIComponent(uid.trim()) + '/favlist')
    }
    return true
  })

  ipcMain.handle('data:export', async function () {
    if (!mainWindow || !store) return 'no window'
    return exportAllData(mainWindow, store)
  })
  ipcMain.handle('data:importFromFile', async function () {
    if (!mainWindow || !store) return 'no window'
    try {
      return await importData(mainWindow, store)
    } catch (err) {
      return 'error: ' + String(err)
    }
  })
  ipcMain.handle('data:import', async function (_event, json: string) {
    if (!store) return false
    try {
      store.importAll(json)
      return true
    } catch (err) {
      return false
    }
  })
  ipcMain.handle('data:exportChapter', async function (_event, chapterId: string) {
    if (!mainWindow || !store) return 'no window'
    return exportChapterToMarkdown(mainWindow, store, chapterId)
  })

  ipcMain.handle('window:setTitle', function (_event, title: string) {
    if (mainWindow) mainWindow.setTitle(title)
    return true
  })
  ipcMain.handle('window:minimize', function () {
    if (mainWindow) mainWindow.minimize()
    return true
  })
  ipcMain.handle('window:toggleMaximize', function () {
    if (!mainWindow) return true
    // frameless system maximize extends ~7px beyond work area and can overlap the taskbar;
    // expand manually to the current display workArea, hugging the taskbar top edge.
    if (mainWindow.isMaximized() || pseudoMaximized) {
      if (maxRestoreBounds) mainWindow.setBounds(maxRestoreBounds)
      else mainWindow.unmaximize()
      pseudoMaximized = false
      maxRestoreBounds = null
    } else {
      maxRestoreBounds = mainWindow.getBounds()
      const display = screen.getDisplayMatching(mainWindow.getBounds())
      const area = display.workArea
      mainWindow.setBounds(area)
      pseudoMaximized = true
    }
    return true
  })
  ipcMain.handle('window:close', function () {
    if (mainWindow) mainWindow.close()
    return true
  })
  ipcMain.handle('app:notify', function (_event, title: string, body: string) {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
    return true
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', function () {
    showMainWindow()
  })

  app.whenReady().then(function () {
    const dataDir = app.getPath('userData')
    const dataFile = path.join(dataDir, 'learning-data.json')
isFirstRun = !fs.existsSync(dataFile)
    if (!fs.existsSync(dataFile)) {
      const oldFile = path.join(app.getPath('appData'), 'learning-desktop', 'learning-data.json')
      if (fs.existsSync(oldFile)) {
        try {
          fs.mkdirSync(dataDir, { recursive: true })
          fs.copyFileSync(oldFile, dataFile)
          console.log('migrated data from ' + oldFile)
        } catch (err) {
          console.log('data migration failed: ' + String(err))
        }
      }
    }
    const seedPath = path.join(__dirname, '..', 'data', 'default-textbooks.json')
    const seed = fs.existsSync(seedPath) ? seedPath : undefined
    store = new DataStore(dataFile, seed)
    backupData()
    setInterval(function () {
      backupData()
    }, 12 * 60 * 60 * 1000)
    syncToFolder()
    setInterval(function () {
      syncToFolder()
    }, 30 * 60 * 1000)

    registerIpc()
    createWindow()

    globalShortcut.register('CommandOrControl+Shift+F', function () {
      showMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('app:open-search')
      }
    })
    globalShortcut.register('CommandOrControl+Shift+P', function () {
      showMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('app:toggle-pomodoro')
      }
    })
    globalShortcut.register('CommandOrControl+Shift+T', function () {
      showMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('app:quick-task')
      }
    })

    const iconPath = path.join(__dirname, '..', 'assets', 'brand', 'xiaogu-tray.png')
    let icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty()
    }
    tray = new Tray(icon.resize({ width: 16, height: 16 }))
    tray.setToolTip('Study desktop')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示主窗口', click: function () { showMainWindow() } },
      {
        label: '开始番茄钟',
        click: function () {
          if (mainWindow) {
            mainWindow.webContents.send('app:start-pomodoro')
          }
          showMainWindow()
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: function () {
          isQuitting = true
          app.quit()
        },
      },
    ]))
    tray.on('double-click', function () {
      showMainWindow()
    })

    setInterval(function () {
      if (!store) return
      const now = new Date()
      const day = now.getDay() === 0 ? 7 : now.getDay()
      const minute = now.getHours() * 60 + now.getMinutes()
      const dayKey = String(now.getFullYear()) + '-' + String(now.getMonth() + 1) + '-' + String(now.getDate())
      for (const lesson of store.getLessons()) {
        if (!lesson.enabled || lesson.dayOfWeek !== day || lesson.startMinute !== minute) {
          continue
        }
        const notifKey = lesson.id + '|' + dayKey + '|' + String(minute)
        if (lastLessonNotified[notifKey]) {
          continue
        }
        lastLessonNotified[notifKey] = '1'
        notifyUser('🔔 上课提醒', lesson.name + (lesson.location ? '（' + lesson.location + '）' : ''))
      }
      // 晚间未完成待办提醒：到达设置时间时提醒一次（当天去重）
      const remindAt = store.getSettings().unfinishedRemindAt
      if (remindAt) {
        const pad2 = function (n: number) { return n < 10 ? '0' + String(n) : String(n) }
        const hhmm = pad2(now.getHours()) + ':' + pad2(now.getMinutes())
        if (hhmm === remindAt) {
          const taskDayKey = String(now.getFullYear()) + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate())
          const key = 'unfinished|' + taskDayKey
          if (!lastTaskNotified[key]) {
            const open = store.getDailyTasks(taskDayKey).filter(function (t) { return !t.completed })
            if (open.length > 0) {
              lastTaskNotified[key] = '1'
              notifyUser('📌 今天还有 ' + open.length + ' 件必做没完成', '还差一点就齐了：' + open.slice(0, 3).map(function (t) { return t.text }).join('、') + (open.length > 3 ? '…' : ''))
            }
          }
        }
      }
    }, 60000)

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', function () {
    if (isQuitting && process.platform !== 'darwin') app.quit()
  })
  app.on('before-quit', function () {
    isQuitting = true
  })
}







































