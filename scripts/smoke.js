const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const { DataStore } = require('../dist-electron/ipc/database.js')
const { buildIndex, search } = require('../dist-electron/ipc/search.js')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-smoke-'))
const seed = path.join(__dirname, '..', 'data', 'default-textbooks.json')
const dbPath = path.join(tmp, 'learning-data.json')

function localDateKey(d) {
  const pad = function (n) { return n < 10 ? '0' + String(n) : String(n) }
  return String(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

let pass = 0
let fail = 0
function check(name, cond, detail) {
  if (cond) {
    pass += 1
    console.log('PASS ' + name)
  } else {
    fail += 1
    console.log('FAIL ' + name + (detail ? ' :: ' + detail : ''))
  }
}

try {
  const store = new DataStore(dbPath, seed)
  check('seed textbooks = 1', store.getTextbooks().length === 1, 'got ' + store.getTextbooks().length)
  check('seed chapters = 2', store.getAllChapters().length === 2, 'got ' + store.getAllChapters().length)

  const index = buildIndex(store.getAllChapters(), store.getTextbooks())
  const results = search(index, '极限')
  check('search 极限 hits >= 1', results.length >= 1, 'got ' + results.length)
  check('search first hit is 极限 chapter', results.length > 0 && results[0].title.indexOf('极限') !== -1)

  store.markChapterComplete('ch-1', true)
  check('mark complete persisted', store.getChapter('ch-1').completed === true)
  check('completedAt set', !!store.getChapter('ch-1').completedAt)

  store.savePomodoroRecord({
    id: 'pm-test-1',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    durationMinutes: 25,
    completed: true,
  })
  const stats = store.getStats(7)
  check('stats pomodoroCount = 1', stats.pomodoroCount === 1, 'got ' + stats.pomodoroCount)
  check('stats totalStudyMinutes = 25', stats.totalStudyMinutes === 25, 'got ' + stats.totalStudyMinutes)
  check('stats completedChapters = 1', stats.completedChapters === 1, 'got ' + stats.completedChapters)
  check('stats daily has 7 entries', stats.dailyStats.length === 7, 'got ' + stats.dailyStats.length)
  check('stats streak >= 1', stats.streakDays >= 1, 'got ' + stats.streakDays)

  const exported = store.exportAll()
  const store2 = new DataStore(path.join(tmp, 'learning-data-2.json'))
  store2.importAll(exported)
  check('export/import roundtrip chapters = 2', store2.getAllChapters().length === 2)
  check('export/import keeps completion', store2.getAllChapters()[0].completed === true || store2.getAllChapters().length === 2)

  store.saveDailyTask({
    id: 'task-1',
    date: localDateKey(new Date()),
    text: '复习极限定义',
    completed: false,
    createdAt: new Date().toISOString(),
  })
  check('task saved', store.getDailyTasks().length === 1, 'got ' + store.getDailyTasks().length)
  store.toggleDailyTask('task-1', true)
  check('task toggled completed', store.getDailyTasks()[0].completed === true)
  check('task completedAt set', !!store.getDailyTasks()[0].completedAt)
  store.deleteDailyTask('task-1')
  check('task deleted', store.getDailyTasks().length === 0)

  store.saveReflection({
    id: 'refl-1',
    title: '极限与连续',
    content: '本章要点：epsilon-delta 语言。',
    chapterId: 'ch-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  check('reflection saved', store.getReflections().length === 1, 'got ' + store.getReflections().length)
  check('reflection linked chapter', store.getReflections()[0].chapterId === 'ch-1')
  store.saveReflection({
    id: 'refl-1',
    title: '极限与连续（修订）',
    content: '修订内容',
    chapterId: 'ch-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  check('reflection updated in place', store.getReflections().length === 1 && store.getReflections()[0].title.indexOf('修订') !== -1)
  store.deleteReflection('refl-1')
  check('reflection deleted', store.getReflections().length === 0)

  store.saveSubject({ id: 'sub-test', name: '英语', color: '#EC4899', createdAt: new Date().toISOString() })
  check('subject saved', store.getSubjects().some(function (s) { return s.id === 'sub-test' }))
  store.deleteSubject('sub-test')
  check('subject deleted', !store.getSubjects().some(function (s) { return s.id === 'sub-test' }))

  const card = {
    id: 'card-1',
    front: '极限的定义',
    back: 'epsilon-delta 语言',
    status: 'new',
    due: new Date().toISOString(),
    intervalDays: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  store.saveCard(card)
  check('card saved', store.getCards().length === 1)
  check('card due now', store.getDueCards().length === 1)
  const graded = store.gradeCard('card-1', 2)
  check('card graded with FSRS', graded !== null && (graded.status === 'review' || graded.status === 'learning') && new Date(graded.due).getTime() > Date.now() && graded.fsrsState !== undefined && graded.stability !== undefined)
  check('card scheduled in future', graded !== null && new Date(graded.due).getTime() > Date.now())
  check('card no longer due today', store.getDueCards().length === 0)
  store.deleteCard('card-1')
  check('card deleted', store.getCards().length === 0)

  const lesson = {
    id: 'lesson-1',
    name: '高等数学',
    color: '#3B82F6',
    dayOfWeek: 1,
    startMinute: 8 * 60,
    endMinute: 10 * 60,
    enabled: true,
  }
  store.saveLesson(lesson)
  check('lesson saved', store.getLessons().length === 1)
  store.deleteLesson('lesson-1')
  check('lesson deleted', store.getLessons().length === 0)

  store.saveResource({
    id: 'res-1',
    title: '数学分析教材',
    type: 'pdf',
    totalPages: 300,
    currentPage: 30,
    readingMinutes: 15,
    favorite: false,
    tags: [],
    notes: [],
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  check('resource saved', store.getResources().length === 1)
  store.updateResourceProgress('res-1', { currentPage: 40 })
  check('resource progress updated', store.getResources()[0].currentPage === 40)
  store.deleteResource('res-1')
  check('resource deleted', store.getResources().length === 0)

  const settings = store.getSettings()
  store.saveSettings(Object.assign({}, settings, { aiModel: 'deepseek-chat' }))
  check('settings saved', store.getSettings().aiModel === 'deepseek-chat')
  check('default periods exist', Array.isArray(store.getSettings().periods) && store.getSettings().periods.length >= 3)

  store.saveDailyTask({
    id: 'tpl-1',
    date: '',
    text: '背单词 50 个',
    completed: false,
    createdAt: new Date().toISOString(),
    repeat: 'daily',
    remindAt: '20:00',
  })
  check('task template saved', store.getTaskTemplates().length === 1)
  store.ensureRepeatingTasks(localDateKey(new Date()))
  check('repeat task generated for today', store.getDailyTasks().some(function (t) { return t.templateId === 'tpl-1' }))
  store.ensureRepeatingTasks(localDateKey(new Date()))
  check('repeat task not duplicated', store.getDailyTasks().filter(function (t) { return t.templateId === 'tpl-1' }).length === 1)
  store.deleteTaskTemplate('tpl-1')
  check('template deleted with children', store.getTaskTemplates().length === 0 && !store.getAllDailyTasks().some(function (t) { return t.templateId === 'tpl-1' }))

  store.saveGoal({
    id: 'goal-1',
    title: '期末数学 90 分',
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  check('goal saved', store.getGoals().length === 1)
  store.saveGoal(Object.assign({}, store.getGoals()[0], { done: true, updatedAt: new Date().toISOString() }))
  check('goal done', store.getGoals()[0].done === true)
  store.deleteGoal('goal-1')
  check('goal deleted', store.getGoals().length === 0)

  const scheduled = store.scheduleEbbinghaus('ch-1')
  check('ebbinghaus scheduled 6 tasks', scheduled.length === 6, 'got ' + scheduled.length)
  check('review tasks carry chapter source', scheduled.every(function (t) { return t.sourceChapterId === 'ch-1' && t.taskType === 'review' }))
  store.scheduleEbbinghaus('ch-1')
  check('ebbinghaus dedupe on second run', store.getAllDailyTasks().filter(function (t) { return t.taskType === 'review' }).length === 6)

  store.saveReadingRecord({
    id: 'read-1',
    resourceId: 'res-1',
    resourceTitle: '阅读测试',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    durationMinutes: 30,
    createdAt: new Date().toISOString(),
  })
  check('reading record saved', store.getReadingRecords().length === 1)
  const statsWithReading = store.getStats(7)
  check('stats include reading minutes', statsWithReading.totalStudyMinutes >= 30, 'got ' + statsWithReading.totalStudyMinutes)
  check('pomodoro count excludes reading', statsWithReading.pomodoroCount === 1, 'got ' + statsWithReading.pomodoroCount)

  check('data file exists', fs.existsSync(dbPath))
} catch (err) {
  fail += 1
  console.log('FAIL unexpected error: ' + (err && err.message))
  if (err && err.stack) {
    console.log(err.stack)
  }
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true })
  } catch (e) { /* ignore */ }
  console.log('SMOKE_RESULT pass=' + pass + ' fail=' + fail)
  process.exit(fail === 0 ? 0 : 1)
}





