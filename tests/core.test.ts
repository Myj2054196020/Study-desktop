import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DataStore } from '../electron/ipc/database'
import { buildIndex, search, tokenize } from '../electron/ipc/search'
import { buildWeeklyReport, buildWeeklyReportHtml } from '../src/lib/report'

const seed = join(__dirname, '..', 'data', 'default-textbooks.json')

function makeStore() {
  const dir = mkdtempSync(join(tmpdir(), 'study-test-'))
  const store = new DataStore(join(dir, 'learning-data.json'), seed)
  return { store, dir }
}

function cleanup(dir: string) {
  rmSync(dir, { recursive: true, force: true })
}

describe('search', function () {
  it('tokenizes chinese with 2-gram', function () {
    const tokens = tokenize('极限与连续')
    expect(tokens).toContain('极限')
    expect(tokens).toContain('连续')
  })

  it('finds chapters by keyword', function () {
    const { store, dir } = makeStore()
    const index = buildIndex(store.getAllChapters(), store.getTextbooks())
    const results = search(index, '极限')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toContain('极限')
    cleanup(dir)
  })
})

describe('data store', function () {
  it('seeds default data', function () {
    const { store, dir } = makeStore()
    expect(store.getAllChapters().length).toBe(2)
    expect(store.getTextbooks().length).toBe(1)
    cleanup(dir)
  })

  it('grades cards with FSRS and schedules future review', function () {
    const { store, dir } = makeStore()
    store.saveCard({
      id: 'c1',
      front: 'f',
      back: 'b',
      status: 'new',
      due: new Date().toISOString(),
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const graded = store.gradeCard('c1', 3)
    expect(graded).not.toBeNull()
    expect(graded!.fsrsState).toBeDefined()
    expect(graded!.stability).toBeDefined()
    expect(new Date(graded!.due).getTime()).toBeGreaterThan(Date.now())
    cleanup(dir)
  })

  it('syncs due cards into daily tasks', function () {
    const { store, dir } = makeStore()
    store.saveCard({
      id: 'c2',
      front: '极限',
      back: '答',
      status: 'new',
      due: new Date().toISOString(),
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const tasks = store.getDailyTasks()
    expect(tasks.some(function (t) { return t.sourceCardId === 'c2' && t.taskType === 'card-review' })).toBe(true)
    cleanup(dir)
  })

  it('generates repeating tasks only once per day', function () {
    const { store, dir } = makeStore()
    store.saveDailyTask({
      id: 'tpl',
      date: '',
      text: '背单词',
      completed: false,
      createdAt: new Date().toISOString(),
      repeat: 'daily',
    })
    store.getDailyTasks()
    store.getDailyTasks()
    const generated = store.getAllDailyTasks().filter(function (t) { return t.templateId === 'tpl' })
    expect(generated.length).toBe(1)
    cleanup(dir)
  })

  it('manages mistakes and converts to cards', function () {
    const { store, dir } = makeStore()
    const now = new Date().toISOString()
    store.saveMistake({
      id: 'm1',
      question: '1+1=？',
      correctAnswer: '2',
      reason: '粗心',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })
    expect(store.getMistakes().length).toBe(1)
    const m = store.getMistakes()[0]
    store.saveMistake(Object.assign({}, m, { status: 'mastered', updatedAt: new Date().toISOString() }))
    expect(store.getMistakes()[0].status).toBe('mastered')
    store.deleteMistake('m1')
    expect(store.getMistakes().length).toBe(0)
    cleanup(dir)
  })

  it('saves quiz records', function () {
    const { store, dir } = makeStore()
    store.saveQuiz({
      id: 'q1',
      title: '自测：极限',
      items: [{ q: '问题', options: ['A', 'B'], answer: 1 }],
      userAnswers: [1],
      score: 1,
      total: 1,
      createdAt: new Date().toISOString(),
    })
    expect(store.getQuizzes().length).toBe(1)
    expect(store.getQuizzes()[0].score).toBe(1)
    store.deleteQuiz('q1')
    expect(store.getQuizzes().length).toBe(0)
    cleanup(dir)
  })

  it('builds a weekly report', function () {
    const { store, dir } = makeStore()
    store.savePomodoroRecord({
      id: 'p2',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationMinutes: 25,
      completed: true,
    })
    const stats = store.getStats(7)
    const report = buildWeeklyReport(stats, { tasksDone: 1, tasksTotal: 2, mistakesOpen: 3, mistakesMastered: 1, cardsDue: 5 }, 7)
    expect(report).toContain('学习周报')
    expect(report).toContain('25')
    expect(report).toContain('1 / 2')
    cleanup(dir)
  })

  it('search covers reflections and tasks', function () {
    const { store, dir } = makeStore()
    store.saveReflection({
      id: 'r1',
      title: '极限心得',
      content: 'epsilon-delta 语言理解',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    store.saveDailyTask({
      id: 't1',
      date: new Date().toISOString().slice(0, 10),
      text: '整理极限笔记',
      completed: false,
      createdAt: new Date().toISOString(),
    })
    const index = buildIndex(store.getAllChapters(), store.getTextbooks(), {
      reflections: store.getReflections(),
      tasks: store.getAllDailyTasks(),
    })
    const found = search(index, '极限')
    expect(found.some(function (r) { return r.kind === 'reflection' && r.chapterId === 'r1' })).toBe(true)
    expect(found.some(function (r) { return r.kind === 'task' })).toBe(true)
    cleanup(dir)
  })

  it('builds an HTML weekly report', function () {
    const { store, dir } = makeStore()
    const stats = store.getStats(7)
    const html = buildWeeklyReportHtml(stats, { tasksDone: 1, tasksTotal: 2, mistakesOpen: 3, mistakesMastered: 1, cardsDue: 5 }, 7)
    expect(html).toContain('学习周报')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('总学习时长')
    cleanup(dir)
  })

  it('FSRS interval grows after repeated good reviews', function () {
    const { store, dir } = makeStore()
    store.saveCard({
      id: 'c3',
      front: 'f',
      back: 'b',
      status: 'new',
      due: new Date().toISOString(),
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const first = store.gradeCard('c3', 2)
    const second = store.gradeCard('c3', 2)
    expect(second).not.toBeNull()
    expect(second!.reps).toBeGreaterThan(first!.reps)
    expect(second!.intervalDays).toBeGreaterThanOrEqual(first!.intervalDays)
    cleanup(dir)
  })

  it('computes stats with subject breakdown', function () {
    const { store, dir } = makeStore()
    store.savePomodoroRecord({
      id: 'p1',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationMinutes: 25,
      completed: true,
      subjectId: store.getSubjects()[0].id,
    })
    const stats = store.getStats(7)
    expect(stats.pomodoroTotal).toBe(1)
    expect(stats.pomodoroCompleted).toBe(1)
    expect(stats.subjectDaily.length).toBeGreaterThan(0)
    cleanup(dir)
  })
})


