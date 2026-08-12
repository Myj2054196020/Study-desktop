import * as fs from 'node:fs'
import * as path from 'node:path'
import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs'
import type {
  VideoNote,
  AISession, AppSettings, Chapter, DailyTask, Goal, Lesson, Mistake, PeriodTemplate, PomodoroRecord, ReadingRecord,
  QuizRecord, Reflection, Resource, ReviewCard, StudyStats, Subject, SubjectDailyStat, SubjectStat, Textbook,
} from '../types'

export interface StoreData {
  textbooks: Textbook[]
  chapters: Chapter[]
  pomodoroRecords: PomodoroRecord[]
  readingRecords: ReadingRecord[]
  dailyTasks: DailyTask[]
  reflections: Reflection[]
  subjects: Subject[]
  cards: ReviewCard[]
  lessons: Lesson[]
  resources: Resource[]
  goals: Goal[]
  mistakes: Mistake[]
  quizzes: QuizRecord[]
  aiSessions: AISession[]
  videoNotes: VideoNote[]
  settings: AppSettings
}

export interface SeedChapter {
  title: string
  order?: number
  tags?: string[]
  parentId?: string
  content?: string
}

export interface SeedTextbook {
  name: string
  subject?: string
  chapters: SeedChapter[]
}

const DEFAULT_CONTENT = [
  '# 在这里记录你的学习笔记',
  '',
  '> 支持 Markdown 与 LaTeX 公式，例如：',
  '',
  String.fromCharCode(36) + String.fromCharCode(36),
  'f(x) = \\int_a^b g(t) \\, dt',
  String.fromCharCode(36) + String.fromCharCode(36),
  '',
].join('\n')

const SUBJECT_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#84CC16']

const DEFAULT_PERIODS: PeriodTemplate[] = [
  { id: 'p1', name: '第1节', startMinute: 8 * 60, endMinute: 8 * 60 + 45 },
  { id: 'p2', name: '第2节', startMinute: 8 * 60 + 55, endMinute: 9 * 60 + 40 },
  { id: 'p3', name: '第3节', startMinute: 10 * 60, endMinute: 10 * 60 + 45 },
  { id: 'p4', name: '第4节', startMinute: 10 * 60 + 55, endMinute: 11 * 60 + 40 },
  { id: 'p5', name: '第5节', startMinute: 14 * 60, endMinute: 14 * 60 + 45 },
  { id: 'p6', name: '第6节', startMinute: 14 * 60 + 55, endMinute: 15 * 60 + 40 },
  { id: 'p7', name: '第7节', startMinute: 16 * 60, endMinute: 16 * 60 + 45 },
  { id: 'p8', name: '第8节', startMinute: 16 * 60 + 55, endMinute: 17 * 60 + 40 },
  { id: 'p9', name: '晚自习', startMinute: 19 * 60, endMinute: 21 * 60 },
]

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'deepseek',
  aiBaseUrl: 'https://api.deepseek.com',
  aiApiKey: '',
  aiModel: 'deepseek-chat',
  autoStart: false,
  startHidden: false,
  periods: DEFAULT_PERIODS,
  onboardingDone: false,
  accentColor: '#3B82F6',
  fontSize: 'normal',
  density: 'comfortable',
  dailyPomodoroGoal: 4,
  autoReviewOnComplete: false,
  autoCardOnMistake: false,
  autoCycle: false,
  chapterTemplates: [],
}

const fsrsInstance = fsrs(generatorParameters({ enable_fuzz: false, maximum_interval: 365 }))

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '')
}

function nowIso(): string {
  return new Date().toISOString()
}

function uid(prefix: string): string {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

export class DataStore {
  private filePath: string
  private data: StoreData

  constructor(filePath: string, seedFilePath?: string) {
    this.filePath = filePath
    this.data = this.load(seedFilePath)
  }

  private load(seedFilePath?: string): StoreData {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(stripBom(raw)) as Partial<StoreData>
      if (!parsed || !Array.isArray(parsed.chapters)) {
        throw new Error('invalid store file')
      }
      const data: StoreData = {
        textbooks: parsed.textbooks || [],
        chapters: parsed.chapters || [],
        pomodoroRecords: parsed.pomodoroRecords || [],
        readingRecords: parsed.readingRecords || [],
        dailyTasks: parsed.dailyTasks || [],
        reflections: parsed.reflections || [],
        subjects: parsed.subjects || [],
        cards: parsed.cards || [],
        lessons: parsed.lessons || [],
        resources: parsed.resources || [],
        goals: parsed.goals || [],
        mistakes: parsed.mistakes || [],
        quizzes: parsed.quizzes || [],
        aiSessions: parsed.aiSessions || [],
        videoNotes: parsed.videoNotes || [],
        settings: Object.assign({}, DEFAULT_SETTINGS, parsed.settings || {}),
      }
      const normalized = this.normalize(data)
      this.persist(normalized)
      return normalized
    } catch (err) {
      const seeded = this.seed(seedFilePath)
      this.persist(seeded)
      return seeded
    }
  }

  private persist(data: StoreData): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  private seed(seedFilePath?: string): StoreData {
    const textbooks: Textbook[] = []
    const chapters: Chapter[] = []
    const subjects: Subject[] = []
    const subjectByName: Record<string, Subject> = {}
    const ensureSubject = function (name: string): Subject {
      const key = name || '未分类'
      if (subjectByName[key]) {
        return subjectByName[key]
      }
      const subject: Subject = {
        id: 'sub-' + String(subjects.length + 1),
        name: key,
        color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length],
        createdAt: nowIso(),
      }
      subjects.push(subject)
      subjectByName[key] = subject
      return subject
    }
    if (seedFilePath && fs.existsSync(seedFilePath)) {
      const raw = fs.readFileSync(seedFilePath, 'utf8')
      const seeds = JSON.parse(stripBom(raw)) as SeedTextbook[]
      let counter = 0
      const created = nowIso()
      for (const tb of seeds || []) {
        const subject = ensureSubject(tb.subject || '未分类')
        const textbookId = 'tb-' + String(counter + 1)
        textbooks.push({
          id: textbookId,
          name: tb.name || '未命名课本',
          subject: tb.subject || '',
          subjectId: subject.id,
          totalChapters: (tb.chapters || []).length,
          createdAt: created,
        })
        for (const ch of tb.chapters || []) {
          counter += 1
          const chapterId = 'ch-' + String(counter)
          chapters.push({
            id: chapterId,
            textbookId,
            title: ch.title || '未命名章节',
            order: ch.order || counter,
            content: ch.content || DEFAULT_CONTENT,
            completed: false,
            studyMinutes: 0,
            tags: ch.tags || [],
            parentId: ch.parentId,
            createdAt: created,
          })
        }
      }
      const ids = new Set(chapters.map(function (c) { return c.id }))
      for (const c of chapters) {
        if (c.parentId && !ids.has(c.parentId)) {
          delete c.parentId
        }
      }
    }
    return {
      textbooks,
      chapters,
      pomodoroRecords: [],
      readingRecords: [],
      dailyTasks: [],
      reflections: [],
      subjects,
      cards: [],
      lessons: [],
      resources: [],
      goals: [],
      mistakes: [],
      quizzes: [],
      aiSessions: [],
      videoNotes: [],
      settings: Object.assign({}, DEFAULT_SETTINGS),
    }
  }

  private normalize(data: StoreData): StoreData {
    const tbIds = new Set(data.textbooks.map(function (t) { return t.id }))
    let defaultTextbookId = data.textbooks.length > 0 ? data.textbooks[0].id : ''
    if (!defaultTextbookId) {
      const tb: Textbook = {
        id: 'tb-default',
        name: '我的笔记',
        subject: '',
        subjectId: this.ensureSubjectId(data, '未分类'),
        totalChapters: 0,
        createdAt: nowIso(),
      }
      data.textbooks.push(tb)
      defaultTextbookId = tb.id
    }
    for (const ch of data.chapters) {
      if (!ch.textbookId || !tbIds.has(ch.textbookId)) {
        ch.textbookId = defaultTextbookId
      }
    }
    for (const tb of data.textbooks) {
      if (!tb.subjectId) {
        tb.subjectId = this.ensureSubjectId(data, tb.subject || '未分类')
      }
    }
    if (!Array.isArray(data.subjects) || data.subjects.length === 0) {
      data.subjects = []
      data.subjects.push(this.ensureSubject(data, '未分类'))
      for (const tb of data.textbooks) {
        tb.subjectId = this.ensureSubjectId(data, tb.subject || '未分类')
      }
    }
    if (!Array.isArray(data.cards)) data.cards = []
    if (!Array.isArray(data.readingRecords)) data.readingRecords = []
    if (!Array.isArray(data.lessons)) data.lessons = []
    if (!Array.isArray(data.resources)) data.resources = []
    if (!Array.isArray(data.goals)) data.goals = []
    if (!Array.isArray(data.mistakes)) data.mistakes = []
    if (!Array.isArray(data.videoNotes)) data.videoNotes = []
    if (!Array.isArray(data.quizzes)) data.quizzes = []
    if (!Array.isArray(data.aiSessions)) data.aiSessions = []
    if (!data.settings) data.settings = Object.assign({}, DEFAULT_SETTINGS)
    if (!Array.isArray(data.settings.periods)) {
      data.settings.periods = DEFAULT_PERIODS
    }
    return data
  }

  private ensureSubject(data: StoreData, name: string): Subject {
    const trimmed = (name || '未分类').trim() || '未分类'
    const found = data.subjects.find(function (s) { return s.name === trimmed })
    if (found) {
      return found
    }
    const subject: Subject = {
      id: uid('sub'),
      name: trimmed,
      color: SUBJECT_COLORS[data.subjects.length % SUBJECT_COLORS.length],
      createdAt: nowIso(),
    }
    data.subjects.push(subject)
    return subject
  }

  private ensureSubjectId(data: StoreData, name: string): string {
    return this.ensureSubject(data, name).id
  }

  private subjectName(data: StoreData, id?: string): string {
    if (!id) return '未分类'
    const found = data.subjects.find(function (s) { return s.id === id })
    return found ? found.name : '未分类'
  }

  private subjectColor(data: StoreData, id?: string): string {
    if (!id) return '#9CA3AF'
    const found = data.subjects.find(function (s) { return s.id === id })
    return found ? found.color : '#9CA3AF'
  }

  private subjectIdForTextbook(textbookId: string): string | undefined {
    const tb = this.data.textbooks.find(function (t) { return t.id === textbookId })
    return tb ? tb.subjectId : undefined
  }

  // ---------------- textbooks & subjects ----------------

  getTextbooks(): Textbook[] {
    return this.data.textbooks
  }

  insertTextbook(data: Partial<Textbook>): Textbook {
    const tb: Textbook = {
      id: data.id || uid('tb'),
      name: data.name || '新课本',
      subject: data.subject || '',
      subjectId: data.subjectId || this.ensureSubjectId(this.data, '未分类'),
      totalChapters: 0,
      createdAt: data.createdAt || nowIso(),
    }
    this.data.textbooks.push(tb)
    this.persist(this.data)
    return tb
  }

  updateTextbook(id: string, patch: Partial<Textbook>): void {
    const idx = this.data.textbooks.findIndex(function (t) { return t.id === id })
    if (idx === -1) {
      return
    }
    this.data.textbooks[idx] = Object.assign({}, this.data.textbooks[idx], patch)
    this.persist(this.data)
  }

  getSubjects(): Subject[] {
    return this.data.subjects
  }

  saveSubject(subject: Subject): void {
    const idx = this.data.subjects.findIndex(function (s) { return s.id === subject.id })
    if (idx === -1) {
      this.data.subjects.push(subject)
    } else {
      this.data.subjects[idx] = subject
    }
    this.persist(this.data)
  }

  deleteSubject(id: string): void {
    const defaultId = this.data.subjects.length > 0 ? this.data.subjects[0].id : ''
    this.data.subjects = this.data.subjects.filter(function (s) { return s.id !== id })
    for (const tb of this.data.textbooks) {
      if (tb.subjectId === id) tb.subjectId = defaultId || undefined
    }
    for (const t of this.data.dailyTasks) {
      if (t.subjectId === id) t.subjectId = defaultId || undefined
    }
    for (const r of this.data.reflections) {
      if (r.subjectId === id) r.subjectId = defaultId || undefined
    }
    for (const c of this.data.cards) {
      if (c.subjectId === id) c.subjectId = defaultId || undefined
    }
    for (const l of this.data.lessons) {
      if (l.subjectId === id) l.subjectId = defaultId || undefined
    }
    this.persist(this.data)
  }

  // ---------------- chapters ----------------

  getAllChapters(): Chapter[] {
    return this.data.chapters
  }

  getChapter(id: string): Chapter | undefined {
    return this.data.chapters.find(function (c) { return c.id === id })
  }

  insertChapter(data: Partial<Chapter>): Chapter {
    const chapter: Chapter = {
      id: data.id || uid('ch'),
      textbookId: data.textbookId || '',
      title: data.title || '新章节',
      order: data.order || this.data.chapters.length + 1,
      content: data.content || '',
      completed: data.completed || false,
      studyMinutes: data.studyMinutes || 0,
      tags: data.tags || [],
      parentId: data.parentId,
      createdAt: data.createdAt || nowIso(),
    }
    this.data.chapters.push(chapter)
    this.persist(this.data)
    return chapter
  }

  updateChapter(id: string, patch: Partial<Chapter>): void {
    const idx = this.data.chapters.findIndex(function (c) { return c.id === id })
    if (idx === -1) {
      throw new Error('chapter not found: ' + id)
    }
    this.data.chapters[idx] = Object.assign({}, this.data.chapters[idx], patch)
    this.persist(this.data)
  }

  deleteChapter(id: string): void {
    this.data.chapters = this.data.chapters.filter(function (c) { return c.id !== id })
    this.persist(this.data)
  }

  markChapterComplete(id: string, completed: boolean): void {
    this.updateChapter(id, {
      completed,
      completedAt: completed ? nowIso() : undefined,
    })
  }

  private defaultTextbookId(): string {
    if (this.data.textbooks.length > 0) {
      return this.data.textbooks[0].id
    }
    const tb: Textbook = {
      id: 'tb-default',
      name: '我的笔记',
      subject: '',
      subjectId: this.ensureSubjectId(this.data, '未分类'),
      totalChapters: 0,
      createdAt: nowIso(),
    }
    this.data.textbooks.push(tb)
    return tb.id
  }

  // ---------------- pomodoro ----------------

  getPomodoroRecords(): PomodoroRecord[] {
    return this.data.pomodoroRecords
  }

  getReadingRecords(): ReadingRecord[] {
    return this.data.readingRecords || []
  }

  saveReadingRecord(record: ReadingRecord): void {
    this.data.readingRecords = (this.data.readingRecords || []).concat([record])
    this.persist(this.data)
  }

  savePomodoroRecord(record: PomodoroRecord): void {
    this.data.pomodoroRecords.push(record)
    this.persist(this.data)
  }

  // ---------------- daily tasks ----------------

  getDailyTasks(date?: string): DailyTask[] {
    const key = date || this.dateKey(new Date())
    this.ensureRepeatingTasks(key)
    this.syncDueCardsToTasks(key)
    return this.data.dailyTasks.filter(function (t) { return t.date === key })
  }

  syncDueCardsToTasks(date?: string): void {
    const key = date || this.dateKey(new Date())
    const dueCards = this.getDueCards(15)
    let changed = false
    for (const card of dueCards) {
      const exists = this.data.dailyTasks.some(function (t) {
        return t.date === key && t.sourceCardId === card.id && t.taskType === 'card-review'
      })
      if (exists) {
        continue
      }
      this.data.dailyTasks.push({
        id: uid('task'),
        date: key,
        text: '复习卡片：' + card.front,
        completed: false,
        createdAt: nowIso(),
        subjectId: card.subjectId,
        taskType: 'card-review',
        sourceCardId: card.id,
      })
      changed = true
    }
    if (changed) {
      this.persist(this.data)
    }
  }

  getAllDailyTasks(): DailyTask[] {
    return this.data.dailyTasks
  }

  saveDailyTask(task: DailyTask): void {
    const idx = this.data.dailyTasks.findIndex(function (t) { return t.id === task.id })
    if (idx === -1) {
      this.data.dailyTasks.push(task)
    } else {
      this.data.dailyTasks[idx] = task
    }
    this.persist(this.data)
  }

  toggleDailyTask(id: string, completed: boolean): void {
    const idx = this.data.dailyTasks.findIndex(function (t) { return t.id === id })
    if (idx === -1) {
      return
    }
    this.data.dailyTasks[idx] = Object.assign({}, this.data.dailyTasks[idx], {
      completed,
      completedAt: completed ? nowIso() : undefined,
    })
    this.persist(this.data)
  }

  addTaskFocusedMinutes(id: string, minutes: number): void {
    const idx = this.data.dailyTasks.findIndex(function (t) { return t.id === id })
    if (idx === -1) {
      return
    }
    const cur = this.data.dailyTasks[idx].focusedMinutes || 0
    this.data.dailyTasks[idx] = Object.assign({}, this.data.dailyTasks[idx], { focusedMinutes: cur + minutes })
    this.persist(this.data)
  }

  setTaskEstimate(id: string, minutes: number): void {
    const idx = this.data.dailyTasks.findIndex(function (t) { return t.id === id })
    if (idx === -1) {
      return
    }
    this.data.dailyTasks[idx] = Object.assign({}, this.data.dailyTasks[idx], { estimateMinutes: minutes })
    this.persist(this.data)
  }

  deleteDailyTask(id: string): void {
    this.data.dailyTasks = this.data.dailyTasks.filter(function (t) { return t.id !== id })
    this.persist(this.data)
  }

  ensureRepeatingTasks(date?: string): void {
    const key = date || this.dateKey(new Date())
    const templates = this.data.dailyTasks.filter(function (t) {
      return t.repeat === 'daily' || t.repeat === 'weekly'
    })
    let changed = false
    for (const tpl of templates) {
      const base = new Date(tpl.createdAt)
      if (tpl.repeat === 'weekly') {
        const target = new Date(key + 'T00:00:00')
        if (target.getDay() !== base.getDay()) {
          continue
        }
      }
      const exists = this.data.dailyTasks.some(function (t) {
        return t.templateId === tpl.id && t.date === key
      })
      if (!exists) {
        this.data.dailyTasks.push({
          id: uid('task'),
          date: key,
          text: tpl.text,
          completed: false,
          createdAt: nowIso(),
          subjectId: tpl.subjectId,
          taskType: 'normal',
          templateId: tpl.id,
          remindAt: tpl.remindAt,
        })
        changed = true
      }
    }
    if (changed) {
      this.persist(this.data)
    }
  }

  getTaskTemplates(): DailyTask[] {
    return this.data.dailyTasks.filter(function (t) {
      return t.repeat === 'daily' || t.repeat === 'weekly'
    })
  }

  deleteTaskTemplate(id: string): void {
    this.data.dailyTasks = this.data.dailyTasks.filter(function (t) {
      return t.id !== id && t.templateId !== id
    })
    this.persist(this.data)
  }

  getReminderTasks(date?: string): DailyTask[] {
    const key = date || this.dateKey(new Date())
    this.ensureRepeatingTasks(key)
    return this.data.dailyTasks.filter(function (t) {
      return t.date === key && !t.completed && !!t.remindAt
    })
  }

  scheduleEbbinghaus(chapterId: string): DailyTask[] {
    const chapter = this.getChapter(chapterId)
    if (!chapter) {
      return []
    }
    const intervals = [1, 2, 4, 7, 15, 30]
    const created: DailyTask[] = []
    const today = new Date()
    for (const days of intervals) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)
      const key = this.dateKey(d)
      const text = '复习：' + chapter.title
      const exists = this.data.dailyTasks.some(function (t) {
        return t.date === key && t.text === text
      })
      if (!exists) {
        const task: DailyTask = {
          id: uid('task'),
          date: key,
          text,
          completed: false,
          createdAt: nowIso(),
          taskType: 'review',
          sourceChapterId: chapterId,
          subjectId: this.subjectIdForTextbook(chapter.textbookId),
        }
        this.data.dailyTasks.push(task)
        created.push(task)
      }
    }
    this.persist(this.data)
    return created
  }

  // ---------------- reflections ----------------

  getReflections(): Reflection[] {
    return this.data.reflections.slice().sort(function (a, b) {
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }

  saveReflection(reflection: Reflection): void {
    const idx = this.data.reflections.findIndex(function (r) { return r.id === reflection.id })
    if (idx === -1) {
      this.data.reflections.push(reflection)
    } else {
      this.data.reflections[idx] = reflection
    }
    this.persist(this.data)
  }

  deleteReflection(id: string): void {
    this.data.reflections = this.data.reflections.filter(function (r) { return r.id !== id })
    this.persist(this.data)
  }

  // ---------------- review cards (SM-2) ----------------

  getCards(): ReviewCard[] {
    return this.data.cards.slice().sort(function (a, b) {
      return a.due.localeCompare(b.due)
    })
  }

  getDueCards(limit = 30): ReviewCard[] {
    const now = Date.now()
    return this.data.cards
      .filter(function (c) { return c.status === 'new' || new Date(c.due).getTime() <= now })
      .sort(function (a, b) { return a.due.localeCompare(b.due) })
      .slice(0, limit)
  }

  saveCard(card: ReviewCard): void {
    const idx = this.data.cards.findIndex(function (c) { return c.id === card.id })
    if (idx === -1) {
      this.data.cards.push(card)
    } else {
      this.data.cards[idx] = card
    }
    this.persist(this.data)
  }

  deleteCard(id: string): void {
    this.data.cards = this.data.cards.filter(function (c) { return c.id !== id })
    this.persist(this.data)
  }

  gradeCard(id: string, grade: number): ReviewCard | null {
    const idx = this.data.cards.findIndex(function (c) { return c.id === id })
    if (idx === -1) {
      return null
    }
    const card = this.data.cards[idx]
    const now = new Date()
    const rating = grade === 0 ? Rating.Again : grade === 1 ? Rating.Hard : grade === 2 ? Rating.Good : Rating.Easy
    const fsrsCard: any = {
      due: card.due ? new Date(card.due) : now,
      stability: card.stability || 0,
      difficulty: card.difficulty || 0,
      elapsed_days: 0,
      scheduled_days: card.intervalDays || 0,
      reps: card.reps || 0,
      lapses: card.lapses || 0,
      state: card.fsrsState || 0,
      last_review: card.lastReviewedAt ? new Date(card.lastReviewedAt) : undefined,
    }
    const scheduling: any = fsrsInstance.repeat(fsrsCard, now)
    const next = scheduling[rating].card
    const updated: ReviewCard = Object.assign({}, card, {
      intervalDays: next.scheduled_days,
      due: next.due.toISOString(),
      status: next.state === 0 ? 'new' : next.state === 1 ? 'learning' : 'review',
      reps: next.reps,
      lapses: next.lapses,
      ease: Math.round(next.difficulty * 100) / 100,
      stability: next.stability,
      difficulty: next.difficulty,
      fsrsState: next.state,
      lastReviewedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    this.data.cards[idx] = updated
    this.persist(this.data)
    return updated
  }

  private nextSchedule(card: ReviewCard, grade: number): { intervalDays: number; ease: number; due: string; status: ReviewCard['status']; reps: number; lapses: number } {
    let ease = card.ease || 2.5
    let interval = card.intervalDays || 0
    let reps = card.reps || 0
    let lapses = card.lapses || 0
    let status: ReviewCard['status'] = card.status === 'new' ? 'learning' : card.status
    if (grade === 0) {
      lapses += 1
      reps = 0
      interval = 0
      ease = Math.max(1.3, ease - 0.2)
      status = 'learning'
    } else if (grade === 1) {
      ease = Math.max(1.3, ease - 0.15)
      interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2))
      reps += 1
      status = 'learning'
    } else if (grade === 2) {
      if (reps === 0) interval = 1
      else if (reps === 1) interval = 6
      else interval = Math.max(1, Math.round(interval * ease))
      reps += 1
      ease = Math.min(2.5, ease + 0.05)
      status = 'review'
    } else {
      if (reps === 0) interval = 4
      else if (reps === 1) interval = 7
      else interval = Math.max(1, Math.round(interval * ease * 1.3))
      reps += 1
      ease = Math.min(2.5, ease + 0.15)
      status = 'review'
    }
    let dueMs = Date.now() + interval * 24 * 60 * 60 * 1000
    if (interval === 0) {
      dueMs = Date.now() + 10 * 60 * 1000
    }
    return { intervalDays: interval, ease: Math.round(ease * 100) / 100, due: new Date(dueMs).toISOString(), status, reps, lapses }
  }

  // ---------------- lessons (timetable) ----------------

  getLessons(): Lesson[] {
    return this.data.lessons
  }

  saveLesson(lesson: Lesson): void {
    const idx = this.data.lessons.findIndex(function (l) { return l.id === lesson.id })
    if (idx === -1) {
      this.data.lessons.push(lesson)
    } else {
      this.data.lessons[idx] = lesson
    }
    this.persist(this.data)
  }

  deleteLesson(id: string): void {
    this.data.lessons = this.data.lessons.filter(function (l) { return l.id !== id })
    this.persist(this.data)
  }

  // ---------------- resources (bookshelf) ----------------

  getResources(): Resource[] {
    return this.data.resources.slice().sort(function (a, b) {
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }

  saveResource(resource: Resource): void {
    const idx = this.data.resources.findIndex(function (r) { return r.id === resource.id })
    if (idx === -1) {
      this.data.resources.push(resource)
    } else {
      this.data.resources[idx] = resource
    }
    this.persist(this.data)
  }

  deleteResource(id: string): void {
    this.data.resources = this.data.resources.filter(function (r) { return r.id !== id })
    this.persist(this.data)
  }

  updateResourceProgress(id: string, patch: Partial<Resource>): void {
    const idx = this.data.resources.findIndex(function (r) { return r.id === id })
    if (idx === -1) {
      return
    }
    this.data.resources[idx] = Object.assign({}, this.data.resources[idx], patch, { updatedAt: nowIso() })
    this.persist(this.data)
  }

  // ---------------- settings ----------------

  getSettings(): AppSettings {
    return this.data.settings
  }

  saveSettings(settings: AppSettings): void {
    this.data.settings = Object.assign({}, DEFAULT_SETTINGS, settings)
    this.persist(this.data)
  }

  // ---------------- mistakes ----------------

  getMistakes(): Mistake[] {
    return this.data.mistakes.slice().sort(function (a, b) {
      return Number(a.status === 'mastered') - Number(b.status === 'mastered') || b.updatedAt.localeCompare(a.updatedAt)
    })
  }

  saveMistake(mistake: Mistake): void {
    const idx = this.data.mistakes.findIndex(function (m) { return m.id === mistake.id })
    if (idx === -1) {
      this.data.mistakes.push(mistake)
    } else {
      this.data.mistakes[idx] = mistake
    }
    this.persist(this.data)
  }

  deleteMistake(id: string): void {
    this.data.mistakes = this.data.mistakes.filter(function (m) { return m.id !== id })
    this.persist(this.data)
  }

  getVideoNotes(): VideoNote[] {
    return this.data.videoNotes || []
  }

  saveVideoNote(video: VideoNote): void {
    const idx = this.data.videoNotes.findIndex(function (v) { return v.id === video.id })
    if (idx === -1) {
      this.data.videoNotes.push(video)
    } else {
      this.data.videoNotes[idx] = video
    }
    this.persist(this.data)
  }

  deleteVideoNote(id: string): void {
    this.data.videoNotes = this.data.videoNotes.filter(function (v) { return v.id !== id })
    this.persist(this.data)
  }

  // ---------------- ai sessions ----------------

  getAISessions(): AISession[] {
    return this.data.aiSessions.slice().sort(function (a, b) {
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }

  saveAISession(session: AISession): void {
    const idx = this.data.aiSessions.findIndex(function (s) { return s.id === session.id })
    if (idx === -1) {
      this.data.aiSessions.push(session)
    } else {
      this.data.aiSessions[idx] = session
    }
    this.persist(this.data)
  }

  deleteAISession(id: string): void {
    this.data.aiSessions = this.data.aiSessions.filter(function (s) { return s.id !== id })
    this.persist(this.data)
  }

  // ---------------- quizzes ----------------

  getQuizzes(): QuizRecord[] {
    return this.data.quizzes.slice().sort(function (a, b) {
      return b.createdAt.localeCompare(a.createdAt)
    })
  }

  saveQuiz(quiz: QuizRecord): void {
    const idx = this.data.quizzes.findIndex(function (q) { return q.id === quiz.id })
    if (idx === -1) {
      this.data.quizzes.push(quiz)
    } else {
      this.data.quizzes[idx] = quiz
    }
    this.persist(this.data)
  }

  deleteQuiz(id: string): void {
    this.data.quizzes = this.data.quizzes.filter(function (q) { return q.id !== id })
    this.persist(this.data)
  }

  // ---------------- goals ----------------

  getGoals(): Goal[] {
    return this.data.goals.slice().sort(function (a, b) {
      return Number(a.done) - Number(b.done) || b.updatedAt.localeCompare(a.updatedAt)
    })
  }

  saveGoal(goal: Goal): void {
    const idx = this.data.goals.findIndex(function (g) { return g.id === goal.id })
    if (idx === -1) {
      this.data.goals.push(goal)
    } else {
      this.data.goals[idx] = goal
    }
    this.persist(this.data)
  }

  deleteGoal(id: string): void {
    this.data.goals = this.data.goals.filter(function (g) { return g.id !== id })
    this.persist(this.data)
  }

  // ---------------- stats ----------------

  getStats(days?: number): StudyStats {
    const completed = this.data.chapters.filter(function (c) { return c.completed })
    const donePomodoros = this.data.pomodoroRecords.filter(function (r) { return r.completed })
    // 统计专注时长时也计入“专注 10 秒以上被中断”的番茄（未完成但真实投入的时间）
    const countedPomodoros = this.data.pomodoroRecords.filter(function (r) {
      return r.completed || (r.durationMinutes || 0) >= 10 / 60
    })
    const readingRecords = this.data.readingRecords || []
    const totalStudyMinutes = countedPomodoros.reduce(function (sum, r) { return sum + (r.durationMinutes || 0) }, 0)
      + readingRecords.reduce(function (sum, r) { return sum + (r.durationMinutes || 0) }, 0)
    const totalChapters = this.data.chapters.length
    const completedChapters = completed.length
    const pomodoroCount = donePomodoros.length

    const minutesByDay: Record<string, number> = {}
    const chaptersByDay: Record<string, number> = {}
    for (const r of countedPomodoros) {
      const key = this.dateKey(new Date(r.startTime))
      minutesByDay[key] = (minutesByDay[key] || 0) + (r.durationMinutes || 0)
    }
    for (const r of readingRecords) {
      const key = this.dateKey(new Date(r.startTime))
      minutesByDay[key] = (minutesByDay[key] || 0) + (r.durationMinutes || 0)
    }
    for (const c of completed) {
      if (!c.completedAt) {
        continue
      }
      const key = this.dateKey(new Date(c.completedAt))
      chaptersByDay[key] = (chaptersByDay[key] || 0) + 1
    }

    const subjectStats = this.buildSubjectStats(countedPomodoros, completed, totalChapters)
    const minutesBySubjectDay: Record<string, Record<string, number>> = {}
    for (const r of donePomodoros) {
      const key = this.dateKey(new Date(r.startTime))
      const sub = r.subjectId || 'unassigned'
      if (!minutesBySubjectDay[sub]) {
        minutesBySubjectDay[sub] = {}
      }
      minutesBySubjectDay[sub][key] = (minutesBySubjectDay[sub][key] || 0) + (r.durationMinutes || 0)
    }

    return {
      totalStudyMinutes,
      completedChapters,
      totalChapters,
      dailyStats: this.buildDailyStats(minutesByDay, chaptersByDay, days),
      pomodoroCount,
      streakDays: this.computeStreak(minutesByDay),
      subjectStats,
      subjectDaily: this.buildSubjectDaily(minutesBySubjectDay, days),
      heatmap: this.buildHeatmap(minutesByDay),
      pomodoroTotal: this.data.pomodoroRecords.length,
      pomodoroCompleted: pomodoroCount,
    }
  }

  private buildSubjectDaily(minutesBySubjectDay: Record<string, Record<string, number>>, days?: number): SubjectDailyStat[] {
    const count = days && days > 0 ? days : 30
    const today = new Date()
    return this.data.subjects.map((sub) => {
      const dayMap = minutesBySubjectDay[sub.id] || {}
      const result: { date: string; minutes: number }[] = []
      for (let i = count - 1; i >= 0; i -= 1) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
        const key = this.dateKey(d)
        result.push({ date: key, minutes: dayMap[key] || 0 })
      }
      return { subjectId: sub.id, name: sub.name, color: sub.color, days: result }
    })
  }

  private buildSubjectStats(donePomodoros: PomodoroRecord[], completedChapters: Chapter[], totalChapters: number): SubjectStat[] {
    const result: SubjectStat[] = []
    for (const sub of this.data.subjects) {
      const stat: SubjectStat = {
        subjectId: sub.id,
        name: sub.name,
        color: sub.color,
        minutes: 0,
        completedChapters: 0,
        totalChapters: 0,
        tasksDone: 0,
        tasksTotal: 0,
      }
      result.push(stat)
    }
    const byId: Record<string, SubjectStat> = {}
    for (const s of result) {
      byId[s.subjectId] = s
    }
    const fallback: SubjectStat = {
      subjectId: 'unassigned',
      name: '未分类',
      color: '#9CA3AF',
      minutes: 0,
      completedChapters: 0,
      totalChapters: 0,
      tasksDone: 0,
      tasksTotal: 0,
    }
    const getStat = (id?: string): SubjectStat => {
      if (id && byId[id]) return byId[id]
      return fallback
    }
    for (const r of donePomodoros) {
      getStat(r.subjectId).minutes += r.durationMinutes || 0
    }
    for (const tb of this.data.textbooks) {
      const count = this.data.chapters.filter(function (c) { return c.textbookId === tb.id }).length
      const done = completedChapters.filter(function (c) { return c.textbookId === tb.id }).length
      const stat = getStat(tb.subjectId)
      stat.totalChapters += count
      stat.completedChapters += done
    }
    const today = this.dateKey(new Date())
    for (const t of this.data.dailyTasks) {
      if (t.date !== today) continue
      const stat = getStat(t.subjectId)
      stat.tasksTotal += 1
      if (t.completed) stat.tasksDone += 1
    }
    return result.concat([fallback]).filter(function (s) {
      return s.minutes > 0 || s.totalChapters > 0 || s.tasksTotal > 0
    })
  }

  private buildHeatmap(minutesByDay: Record<string, number>): { date: string; minutes: number }[] {
    const result: { date: string; minutes: number }[] = []
    const today = new Date()
    for (let i = 363; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
      const key = this.dateKey(d)
      result.push({ date: key, minutes: minutesByDay[key] || 0 })
    }
    return result
  }

  private pad2(n: number): string {
    return n < 10 ? '0' + String(n) : String(n)
  }

  private dateKey(d: Date): string {
    return String(d.getFullYear()) + '-' + this.pad2(d.getMonth() + 1) + '-' + this.pad2(d.getDate())
  }

  private buildDailyStats(minutesByDay: Record<string, number>, chaptersByDay: Record<string, number>, days?: number): { date: string; minutes: number; chapters: number }[] {
    const result: { date: string; minutes: number; chapters: number }[] = []
    const today = new Date()
    const count = days && days > 0 ? days : 3650
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
      const key = this.dateKey(d)
      result.push({
        date: key,
        minutes: minutesByDay[key] || 0,
        chapters: chaptersByDay[key] || 0,
      })
    }
    return result
  }

  private computeStreak(minutesByDay: Record<string, number>): number {
    const today = new Date()
    let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (!minutesByDay[this.dateKey(cursor)]) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
    }
    let streak = 0
    while (minutesByDay[this.dateKey(cursor)]) {
      streak += 1
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
    }
    return streak
  }

  // ---------------- export / import ----------------

  exportAll(): string {
    return JSON.stringify(this.data, null, 2)
  }

  importAll(json: string): void {
    const parsed = JSON.parse(stripBom(json)) as Partial<StoreData>
    if (!parsed || !Array.isArray(parsed.chapters)) {
      throw new Error('invalid import data')
    }
    this.data = this.normalize({
      textbooks: parsed.textbooks || [],
      chapters: parsed.chapters || [],
      pomodoroRecords: parsed.pomodoroRecords || [],
      readingRecords: parsed.readingRecords || [],
      dailyTasks: parsed.dailyTasks || [],
      reflections: parsed.reflections || [],
      subjects: parsed.subjects || [],
      cards: parsed.cards || [],
      lessons: parsed.lessons || [],
      resources: parsed.resources || [],
      goals: parsed.goals || [],
      mistakes: parsed.mistakes || [],
      quizzes: parsed.quizzes || [],
      aiSessions: parsed.aiSessions || [],
      videoNotes: parsed.videoNotes || [],
      settings: Object.assign({}, DEFAULT_SETTINGS, parsed.settings || {}),
    })
    this.persist(this.data)
  }
}











