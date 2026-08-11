import type {
  AISession, AppSettings, Chapter, DailyTask, Goal, Lesson, Mistake, PomodoroRecord, QuizRecord, ReadingRecord, Reflection, Resource,
  ReviewCard, SearchResult, StudyStats, Subject, Textbook, VideoNote,
} from '../types'

export interface DBApi {
  search(query: string): Promise<SearchResult[]>
  getChapters(): Promise<Chapter[]>
  getTextbooks(): Promise<Textbook[]>
  getChapter(id: string): Promise<Chapter | null>
  updateChapter(id: string, data: Partial<Chapter>): Promise<void>
  addChapter(data: Partial<Chapter>): Promise<Chapter>
  deleteChapter(id: string): Promise<void>
  getPomodoroHistory(): Promise<PomodoroRecord[]>
  savePomodoroRecord(record: PomodoroRecord): Promise<void>
  getReadingRecords(): Promise<ReadingRecord[]>
  saveReadingRecord(record: ReadingRecord): Promise<void>
  getStats(days?: number): Promise<StudyStats>
  exportData(): Promise<string>
  importData(json: string): Promise<void>
  importDataFromFile(): Promise<string>
  notify(title: string, body: string): Promise<void>
  getDailyTasks(date?: string): Promise<DailyTask[]>
  getAllDailyTasks(): Promise<DailyTask[]>
  saveDailyTask(task: DailyTask): Promise<DailyTask>
  toggleDailyTask(id: string, completed: boolean): Promise<void>
  deleteDailyTask(id: string): Promise<void>
  addTaskFocusedMinutes(id: string, minutes: number): Promise<void>
  setTaskEstimate(id: string, minutes: number): Promise<void>
  getReflections(): Promise<Reflection[]>
  saveReflection(reflection: Reflection): Promise<Reflection>
  deleteReflection(id: string): Promise<void>
  getSubjects(): Promise<Subject[]>
  saveSubject(subject: Subject): Promise<Subject>
  deleteSubject(id: string): Promise<void>
  updateTextbook(id: string, patch: Partial<Textbook>): Promise<void>
  addTextbook(data: Partial<Textbook>): Promise<Textbook>
  getCards(): Promise<ReviewCard[]>
  getDueCards(limit?: number): Promise<ReviewCard[]>
  saveCard(card: ReviewCard): Promise<ReviewCard>
  deleteCard(id: string): Promise<void>
  gradeCard(id: string, grade: number): Promise<ReviewCard | null>
  getLessons(): Promise<Lesson[]>
  saveLesson(lesson: Lesson): Promise<Lesson>
  deleteLesson(id: string): Promise<void>
  getResources(): Promise<Resource[]>
  saveResource(resource: Resource): Promise<Resource>
  deleteResource(id: string): Promise<void>
  updateResourceProgress(id: string, patch: Partial<Resource>): Promise<void>
  pickResourceFile(): Promise<string | null>
  openResourceFile(filePath: string): Promise<string>
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<void>
  scheduleEbbinghaus(chapterId: string): Promise<DailyTask[]>
  aiChat(messages: { role: string; content: string }[]): Promise<string>
  getGoals(): Promise<Goal[]>
  saveGoal(goal: Goal): Promise<Goal>
  deleteGoal(id: string): Promise<void>
  getTaskTemplates(): Promise<DailyTask[]>
  deleteTaskTemplate(id: string): Promise<void>
  importChapterMarkdown(): Promise<{ filePath: string; title?: string; content: string } | null>
  readResourceFile(filePath: string): Promise<Uint8Array | null>
  checkUpdate(): Promise<string>
  syncPomodoro(state: { isRunning: boolean; timeLeft: number; totalSession: number }): Promise<void>
  toggleWidget(): Promise<string>
  closeWidget(): Promise<boolean>
  backupNow(): Promise<string>
  getMistakes(): Promise<Mistake[]>
  saveMistake(mistake: Mistake): Promise<Mistake>
  deleteMistake(id: string): Promise<void>
  getVideoNotes(): Promise<VideoNote[]>
  saveVideoNote(video: VideoNote): Promise<VideoNote>
  deleteVideoNote(id: string): Promise<void>
  exportCardsCsv(): Promise<string>
  exportMarkdownFolder(): Promise<string>
  importChaptersFolder(): Promise<number>
  pickFolder(): Promise<string>
  syncNow(): Promise<string>
  openBilibiliSearch(keyword: string): Promise<boolean>
  openBilibiliFavorites(uid: string): Promise<boolean>
  getAISessions(): Promise<AISession[]>
  saveAISession(session: AISession): Promise<AISession>
  deleteAISession(id: string): Promise<void>
  getQuizzes(): Promise<QuizRecord[]>
  saveQuiz(quiz: QuizRecord): Promise<QuizRecord>
  deleteQuiz(id: string): Promise<void>
  exportTextFile(title: string, content: string, ext?: string): Promise<string>
  obsidianExport(): Promise<string>
  obsidianImport(): Promise<number>
  notesWidgetToggle(): Promise<string>
  loadNotesWidget(): Promise<string>
  saveNotesWidget(content: string): Promise<boolean>
}

export function createDb(): DBApi {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (api) {
    return {
      search: (query) => api.search(query),
      getChapters: () => api.getChapters(),
      getTextbooks: () => api.getTextbooks(),
      getChapter: (id) => api.getChapter(id),
      updateChapter: (id, data) => api.updateChapter(id, data).then(() => undefined),
      addChapter: (data) => api.addChapter(data),
      deleteChapter: (id) => api.deleteChapter(id).then(() => undefined),
      getPomodoroHistory: () => api.getPomodoroHistory(),
      savePomodoroRecord: (record) => api.savePomodoroRecord(record).then(() => undefined),
      getReadingRecords: () => api.getReadingRecords(),
      saveReadingRecord: (record) => api.saveReadingRecord(record).then(() => undefined),
      getStats: (days) => api.getStats(days),
      exportData: () => api.exportData(),
      importData: (json) => api.importData(json).then(() => undefined),
      importDataFromFile: () => api.importDataFromFile(),
      notify: (title, body) => api.notify(title, body).then(() => undefined),
      getDailyTasks: (date) => api.getDailyTasks(date),
      getAllDailyTasks: () => api.getAllDailyTasks(),
      saveDailyTask: (task) => api.saveDailyTask(task),
      toggleDailyTask: (id, completed) => api.toggleDailyTask(id, completed).then(() => undefined),
      deleteDailyTask: (id) => api.deleteDailyTask(id).then(() => undefined),
      addTaskFocusedMinutes: (id, minutes) => api.addTaskFocusedMinutes(id, minutes).then(() => undefined),
      setTaskEstimate: (id, minutes) => api.setTaskEstimate(id, minutes).then(() => undefined),
      getReflections: () => api.getReflections(),
      saveReflection: (reflection) => api.saveReflection(reflection),
      deleteReflection: (id) => api.deleteReflection(id).then(() => undefined),
      getSubjects: () => api.getSubjects(),
      saveSubject: (subject) => api.saveSubject(subject),
      deleteSubject: (id) => api.deleteSubject(id).then(() => undefined),
      updateTextbook: (id, patch) => api.updateTextbook(id, patch).then(() => undefined),
      addTextbook: (data) => api.addTextbook(data),
      getCards: () => api.getCards(),
      getDueCards: (limit) => api.getDueCards(limit),
      saveCard: (card) => api.saveCard(card),
      deleteCard: (id) => api.deleteCard(id).then(() => undefined),
      gradeCard: (id, grade) => api.gradeCard(id, grade),
      getLessons: () => api.getLessons(),
      saveLesson: (lesson) => api.saveLesson(lesson),
      deleteLesson: (id) => api.deleteLesson(id).then(() => undefined),
      getResources: () => api.getResources(),
      saveResource: (resource) => api.saveResource(resource),
      deleteResource: (id) => api.deleteResource(id).then(() => undefined),
      updateResourceProgress: (id, patch) => api.updateResourceProgress(id, patch).then(() => undefined),
      pickResourceFile: () => api.pickResourceFile(),
      openResourceFile: (filePath) => api.openResourceFile(filePath),
      getSettings: () => api.getSettings(),
      saveSettings: (settings) => api.saveSettings(settings).then(() => undefined),
      scheduleEbbinghaus: (chapterId) => api.scheduleEbbinghaus(chapterId),
      aiChat: (messages) => api.aiChat(messages),
      getGoals: () => api.getGoals(),
      saveGoal: (goal) => api.saveGoal(goal),
      deleteGoal: (id) => api.deleteGoal(id).then(() => undefined),
      getTaskTemplates: () => api.getTaskTemplates(),
      deleteTaskTemplate: (id) => api.deleteTaskTemplate(id).then(() => undefined),
      importChapterMarkdown: () => api.importChapterMarkdown(),
      readResourceFile: (filePath) => api.readResourceFile(filePath),
      checkUpdate: () => api.checkUpdate(),
      syncPomodoro: (state) => api.syncPomodoro(state).then(() => undefined),
      toggleWidget: () => api.toggleWidget(),
      closeWidget: () => api.closeWidget(),
      backupNow: () => api.backupNow(),
      getMistakes: () => api.getMistakes(),
      saveMistake: (mistake) => api.saveMistake(mistake),
      deleteMistake: (id) => api.deleteMistake(id).then(() => undefined),
  getVideoNotes: () => api.getVideoNotes(),
  saveVideoNote: (video) => api.saveVideoNote(video),
  deleteVideoNote: (id) => api.deleteVideoNote(id).then(() => undefined),
      exportCardsCsv: () => api.exportCardsCsv(),
      exportMarkdownFolder: () => api.exportMarkdownFolder(),
      importChaptersFolder: () => api.importChaptersFolder(),
      pickFolder: () => api.pickFolder(),
      syncNow: () => api.syncNow(),
      openBilibiliSearch: (keyword) => api.openBilibiliSearch(keyword),
      openBilibiliFavorites: (uid) => api.openBilibiliFavorites(uid),
      getAISessions: () => api.getAISessions(),
      saveAISession: (session) => api.saveAISession(session),
      deleteAISession: (id) => api.deleteAISession(id).then(() => undefined),
      getQuizzes: () => api.getQuizzes(),
      saveQuiz: (quiz) => api.saveQuiz(quiz),
      deleteQuiz: (id) => api.deleteQuiz(id).then(() => undefined),
      exportTextFile: (title, content, ext) => api.exportTextFile(title, content, ext),
      obsidianExport: () => api.obsidianExport(),
      obsidianImport: () => api.obsidianImport(),
      notesWidgetToggle: () => api.notesWidgetToggle(),
      loadNotesWidget: () => api.loadNotesWidget(),
      saveNotesWidget: (content) => api.saveNotesWidget(content),
    }
  }
  return createBrowserDb()
}

// ---------------- browser fallback (localStorage demo mode) ----------------

const DEMO_KEY = 'learning-desktop-demo-v1'

interface DemoData {
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

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '')
}

function todayKeyLocal(): string {
  const d = new Date()
  return dateKey(d)
}

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n)
}

function dateKey(d: Date): string {
  return String(d.getFullYear()) + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

function seedDemo(): DemoData {
  const now = new Date().toISOString()
  const content = '# 在这里记录你的学习笔记\n\n> 浏览器演示模式（localStorage）。使用 Electron 运行时数据将持久化到本地文件。\n\n## 学习目标\n\n- \n\n## 核心知识点\n\n- \n'
  const subjects: Subject[] = [
    { id: 'sub-1', name: '高等数学', color: '#2B3A67', createdAt: now },
  ]
  const textbooks: Textbook[] = [
    { id: 'tb-1', name: '高等数学', subject: '高等数学', subjectId: 'sub-1', totalChapters: 2, createdAt: now },
  ]
  const chapters: Chapter[] = [
    { id: 'ch-1', textbookId: 'tb-1', title: '第一章：函数与极限', order: 1, content, completed: false, studyMinutes: 0, tags: ['入门'], createdAt: now },
    { id: 'ch-2', textbookId: 'tb-1', title: '第二章：导数与微分', order: 2, content, completed: false, studyMinutes: 0, tags: ['基础'], parentId: 'ch-1', createdAt: now },
  ]
  return { textbooks, chapters, pomodoroRecords: [], readingRecords: [], dailyTasks: [], reflections: [], subjects, cards: [], lessons: [], resources: [], goals: [], mistakes: [], quizzes: [], aiSessions: [], videoNotes: [], settings: { aiBaseUrl: '', aiApiKey: '', aiModel: '', autoStart: false, startHidden: false, periods: [] } }
}

function loadDemo(): DemoData {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY)
    if (raw) {
      const parsed = JSON.parse(stripBom(raw)) as DemoData
      if (parsed && Array.isArray(parsed.chapters)) {
        return {
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
          videoNotes: parsed.videoNotes || [],
          quizzes: parsed.quizzes || [],
          aiSessions: parsed.aiSessions || [],
          settings: Object.assign({ aiBaseUrl: '', aiApiKey: '', aiModel: '' }, parsed.settings || {}),
        }
      }
    }
  } catch (err) {
    // ignore and reseed
  }
  return seedDemo()
}

function saveDemo(data: DemoData): void {
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(data))
}

function createBrowserDb(): DBApi {
  let data = loadDemo()

  const persist = function (): void {
    saveDemo(data)
  }

  const search = function (query: string): Promise<SearchResult[]> {
    const q = (query || '').trim().toLowerCase()
    const results: SearchResult[] = []
    if (!q) {
      return Promise.resolve([])
    }
    const names: Record<string, string> = {}
    for (const tb of data.textbooks) {
      names[tb.id] = tb.name
    }
    for (const ch of data.chapters) {
      const titleHit = ch.title.toLowerCase().indexOf(q) !== -1
      const contentHit = ch.content.toLowerCase().indexOf(q) !== -1
      if (!titleHit && !contentHit) {
        continue
      }
      const score = (titleHit ? 3 : 0) + (contentHit ? 1 : 0)
      results.push({
        chapterId: ch.id,
        kind: 'chapter',
        title: ch.title,
        snippet: contentHit ? ch.content.slice(0, 80) : '',
        textbookName: names[ch.textbookId] || '',
        score,
      })
    }
    results.sort(function (a, b) {
      return b.score - a.score
    })
    return Promise.resolve(results.slice(0, 20))
  }

  const getStats = function (days?: number): Promise<StudyStats> {
    const completed = data.chapters.filter(function (c) { return c.completed })
    const done = data.pomodoroRecords.filter(function (r) { return r.completed })
    const minutesByDay: Record<string, number> = {}
    const chaptersByDay: Record<string, number> = {}
    for (const r of done) {
      const key = dateKey(new Date(r.startTime))
      minutesByDay[key] = (minutesByDay[key] || 0) + (r.durationMinutes || 0)
    }
    for (const c of completed) {
      if (!c.completedAt) continue
      const key = dateKey(new Date(c.completedAt))
      chaptersByDay[key] = (chaptersByDay[key] || 0) + 1
    }
    const daily: { date: string; minutes: number; chapters: number }[] = []
    const today = new Date()
    const count = days && days > 0 ? days : 30
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
      const key = dateKey(d)
      daily.push({ date: key, minutes: minutesByDay[key] || 0, chapters: chaptersByDay[key] || 0 })
    }
    let streak = 0
    {
      let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      if (!minutesByDay[dateKey(cursor)]) {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
      }
      while (minutesByDay[dateKey(cursor)]) {
        streak += 1
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
      }
    }
    return Promise.resolve({
      totalStudyMinutes: done.reduce(function (sum, r) { return sum + (r.durationMinutes || 0) }, 0),
      completedChapters: completed.length,
      totalChapters: data.chapters.length,
      dailyStats: daily,
      pomodoroCount: done.length,
      streakDays: streak,
      subjectStats: [],
      subjectDaily: [],
      heatmap: [],
      pomodoroTotal: done.length,
      pomodoroCompleted: done.length,
    })
  }

  return {
    search,
    getChapters: () => Promise.resolve(data.chapters.slice()),
    getTextbooks: () => Promise.resolve(data.textbooks.slice()),
    getChapter: (id) => {
      const found = data.chapters.find(function (c) { return c.id === id })
      return Promise.resolve(found ? Object.assign({}, found) : null)
    },
    updateChapter: (id, patch) => {
      const idx = data.chapters.findIndex(function (c) { return c.id === id })
      if (idx !== -1) {
        data.chapters[idx] = Object.assign({}, data.chapters[idx], patch)
        persist()
      }
      return Promise.resolve()
    },
    addChapter: (patch) => {
      const chapter: Chapter = {
        id: 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        textbookId: patch.textbookId || '',
        title: patch.title || '新章节',
        order: patch.order || data.chapters.length + 1,
        content: patch.content || '',
        completed: false,
        studyMinutes: 0,
        tags: patch.tags || [],
        parentId: patch.parentId,
        createdAt: new Date().toISOString(),
      }
      data.chapters.push(chapter)
      persist()
      return Promise.resolve(chapter)
    },
    deleteChapter: (id) => {
      data.chapters = data.chapters.filter(function (c) { return c.id !== id })
      persist()
      return Promise.resolve()
    },
    getPomodoroHistory: () => Promise.resolve(data.pomodoroRecords.slice().reverse()),
    getReadingRecords: () => Promise.resolve((data.readingRecords || []).slice()),
    saveReadingRecord: (record) => {
      data.readingRecords = (data.readingRecords || []).concat([record])
      persist()
      return Promise.resolve()
    },
    savePomodoroRecord: (record) => {
      data.pomodoroRecords.push(record)
      persist()
      return Promise.resolve()
    },
    getStats,
    exportData: () => Promise.resolve(JSON.stringify(data, null, 2)),
    importData: (json) => {
      const parsed = JSON.parse(stripBom(json)) as DemoData
      if (!parsed || !Array.isArray(parsed.chapters)) {
        throw new Error('invalid import data')
      }
      data = {
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
        settings: Object.assign({ aiBaseUrl: '', aiApiKey: '', aiModel: '' }, parsed.settings || {}),
      }
      persist()
      return Promise.resolve()
    },
    importDataFromFile: () => Promise.resolve('unsupported'),
    notify: (title, body) => {
      if (typeof Notification !== 'undefined') {
        try {
          new Notification(title, { body })
        } catch (err) {
          // ignore
        }
      }
      return Promise.resolve()
    },
    getDailyTasks: (date) => {
      const key = date || todayKeyLocal()
      const list = data.dailyTasks.filter(function (t) { return t.date === key })
      return Promise.resolve(list)
    },
    getAllDailyTasks: () => Promise.resolve(data.dailyTasks.slice()),
    saveDailyTask: (task) => {
      const idx = data.dailyTasks.findIndex(function (t) { return t.id === task.id })
      if (idx === -1) {
        data.dailyTasks.push(task)
      } else {
        data.dailyTasks[idx] = task
      }
      persist()
      return Promise.resolve(task)
    },
    toggleDailyTask: (id, completed) => {
      const idx = data.dailyTasks.findIndex(function (t) { return t.id === id })
      if (idx !== -1) {
        data.dailyTasks[idx] = Object.assign({}, data.dailyTasks[idx], {
          completed,
          completedAt: completed ? new Date().toISOString() : undefined,
        })
        persist()
      }
      return Promise.resolve()
    },
    deleteDailyTask: (id) => {
      data.dailyTasks = data.dailyTasks.filter(function (t) { return t.id !== id })
      persist()
      return Promise.resolve()
    },
    addTaskFocusedMinutes: (id, minutes) => {
      const idx = data.dailyTasks.findIndex(function (t) { return t.id === id })
      if (idx !== -1) {
        const cur = data.dailyTasks[idx].focusedMinutes || 0
        data.dailyTasks[idx] = Object.assign({}, data.dailyTasks[idx], { focusedMinutes: cur + minutes })
        persist()
      }
      return Promise.resolve()
    },
    setTaskEstimate: (id, minutes) => {
      const idx = data.dailyTasks.findIndex(function (t) { return t.id === id })
      if (idx !== -1) {
        data.dailyTasks[idx] = Object.assign({}, data.dailyTasks[idx], { estimateMinutes: minutes })
        persist()
      }
      return Promise.resolve()
    },
    getReflections: () => {
      const list = data.reflections.slice().sort(function (a, b) {
        return b.updatedAt.localeCompare(a.updatedAt)
      })
      return Promise.resolve(list)
    },
    saveReflection: (reflection) => {
      const idx = data.reflections.findIndex(function (r) { return r.id === reflection.id })
      if (idx === -1) {
        data.reflections.push(reflection)
      } else {
        data.reflections[idx] = reflection
      }
      persist()
      return Promise.resolve(reflection)
    },
    deleteReflection: (id) => {
      data.reflections = data.reflections.filter(function (r) { return r.id !== id })
      persist()
      return Promise.resolve()
    },
    getSubjects: () => Promise.resolve(data.subjects.slice()),
    saveSubject: (subject) => {
      const sidx = data.subjects.findIndex(function (s) { return s.id === subject.id })
      if (sidx === -1) data.subjects.push(subject)
      else data.subjects[sidx] = subject
      persist()
      return Promise.resolve(subject)
    },
    deleteSubject: (id) => {
      const fallbackId = data.subjects.length > 0 ? data.subjects[0].id : undefined
      data.subjects = data.subjects.filter(function (s) { return s.id !== id })
      for (const tb of data.textbooks) { if (tb.subjectId === id) tb.subjectId = fallbackId }
      for (const t of data.dailyTasks) { if (t.subjectId === id) t.subjectId = fallbackId }
      for (const r of data.reflections) { if (r.subjectId === id) r.subjectId = fallbackId }
      persist()
      return Promise.resolve()
    },
    addTextbook: (patch) => {
      const tb: Textbook = {
        id: 'tb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        name: patch.name || '新课本',
        subject: patch.subject || '',
        subjectId: patch.subjectId || '',
        totalChapters: 0,
        createdAt: new Date().toISOString(),
      }
      data.textbooks.push(tb)
      persist()
      return Promise.resolve(tb)
    },
    updateTextbook: (id, patch) => {
      const tidx = data.textbooks.findIndex(function (t) { return t.id === id })
      if (tidx !== -1) {
        data.textbooks[tidx] = Object.assign({}, data.textbooks[tidx], patch)
        persist()
      }
      return Promise.resolve()
    },
    getCards: () => Promise.resolve(data.cards.slice()),
    getDueCards: (limit) => {
      const now = Date.now()
      const list = data.cards.filter(function (c) { return c.status === 'new' || new Date(c.due).getTime() <= now })
        .sort(function (a, b) { return a.due.localeCompare(b.due) })
      return Promise.resolve(list.slice(0, limit || 30))
    },
    saveCard: (card) => {
      const cidx = data.cards.findIndex(function (c) { return c.id === card.id })
      if (cidx === -1) data.cards.push(card)
      else data.cards[cidx] = card
      persist()
      return Promise.resolve(card)
    },
    deleteCard: (id) => {
      data.cards = data.cards.filter(function (c) { return c.id !== id })
      persist()
      return Promise.resolve()
    },
    gradeCard: (id, grade) => {
      const cidx = data.cards.findIndex(function (c) { return c.id === id })
      if (cidx === -1) return Promise.resolve(null)
      const card = data.cards[cidx]
      let ease = card.ease || 2.5
      let interval = card.intervalDays || 0
      let reps = card.reps || 0
      let lapses = card.lapses || 0
      let status = card.status === 'new' ? 'learning' : card.status
      if (grade === 0) {
        lapses += 1; reps = 0; interval = 0; ease = Math.max(1.3, ease - 0.2); status = 'learning'
      } else if (grade === 1) {
        ease = Math.max(1.3, ease - 0.15)
        interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2))
        reps += 1; status = 'learning'
      } else if (grade === 2) {
        if (reps === 0) interval = 1
        else if (reps === 1) interval = 6
        else interval = Math.max(1, Math.round(interval * ease))
        reps += 1; ease = Math.min(2.5, ease + 0.05); status = 'review'
      } else {
        if (reps === 0) interval = 4
        else if (reps === 1) interval = 7
        else interval = Math.max(1, Math.round(interval * ease * 1.3))
        reps += 1; ease = Math.min(2.5, ease + 0.15); status = 'review'
      }
      let dueMs = Date.now() + interval * 24 * 60 * 60 * 1000
      if (interval === 0) dueMs = Date.now() + 10 * 60 * 1000
      const updated = Object.assign({}, card, {
        intervalDays: interval,
        ease: Math.round(ease * 100) / 100,
        due: new Date(dueMs).toISOString(),
        status,
        reps,
        lapses,
        lastReviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      data.cards[cidx] = updated
      persist()
      return Promise.resolve(updated)
    },
    getLessons: () => Promise.resolve(data.lessons.slice()),
    saveLesson: (lesson) => {
      const lidx = data.lessons.findIndex(function (l) { return l.id === lesson.id })
      if (lidx === -1) data.lessons.push(lesson)
      else data.lessons[lidx] = lesson
      persist()
      return Promise.resolve(lesson)
    },
    deleteLesson: (id) => {
      data.lessons = data.lessons.filter(function (l) { return l.id !== id })
      persist()
      return Promise.resolve()
    },
    getResources: () => Promise.resolve(data.resources.slice()),
    saveResource: (resource) => {
      const ridx = data.resources.findIndex(function (r) { return r.id === resource.id })
      if (ridx === -1) data.resources.push(resource)
      else data.resources[ridx] = resource
      persist()
      return Promise.resolve(resource)
    },
    deleteResource: (id) => {
      data.resources = data.resources.filter(function (r) { return r.id !== id })
      persist()
      return Promise.resolve()
    },
    updateResourceProgress: (id, patch) => {
      const ridx = data.resources.findIndex(function (r) { return r.id === id })
      if (ridx !== -1) {
        data.resources[ridx] = Object.assign({}, data.resources[ridx], patch, { updatedAt: new Date().toISOString() })
        persist()
      }
      return Promise.resolve()
    },
    pickResourceFile: () => Promise.resolve(null),
    openResourceFile: () => Promise.resolve('ok'),
    getSettings: () => Promise.resolve(Object.assign({ aiBaseUrl: '', aiApiKey: '', aiModel: '' }, data.settings)),
    saveSettings: (settings) => {
      data.settings = settings
      persist()
      return Promise.resolve()
    },
    scheduleEbbinghaus: (chapterId) => {
      const ch = data.chapters.find(function (c) { return c.id === chapterId })
      if (!ch) return Promise.resolve([])
      const intervals = [1, 2, 4, 7, 15, 30]
      const created: DailyTask[] = []
      const today = new Date()
      for (const days of intervals) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)
        const key = dateKey(d)
        const text = '复习：' + ch.title
        const dup = data.dailyTasks.some(function (t) { return t.date === key && t.text === text })
        if (dup) continue
        const task: DailyTask = {
          id: 'task-' + Math.random().toString(36).slice(2, 10),
          date: key,
          text,
          completed: false,
          createdAt: new Date().toISOString(),
          taskType: 'review',
          sourceChapterId: chapterId,
        }
        data.dailyTasks.push(task)
        created.push(task)
      }
      persist()
      return Promise.resolve(created)
    },
    aiChat: () => Promise.resolve('浏览器演示模式不支持 AI 调用，请在 Electron 应用中配置'),
    getGoals: () => Promise.resolve(data.goals.slice()),
    saveGoal: (goal) => {
      const gidx = data.goals.findIndex(function (g) { return g.id === goal.id })
      if (gidx === -1) data.goals.push(goal)
      else data.goals[gidx] = goal
      persist()
      return Promise.resolve(goal)
    },
    deleteGoal: (id) => {
      data.goals = data.goals.filter(function (g) { return g.id !== id })
      persist()
      return Promise.resolve()
    },
    getTaskTemplates: () => Promise.resolve(data.dailyTasks.filter(function (t) {
      return t.repeat === 'daily' || t.repeat === 'weekly'
    })),
    deleteTaskTemplate: (id) => {
      data.dailyTasks = data.dailyTasks.filter(function (t) {
        return t.id !== id && t.templateId !== id
      })
      persist()
      return Promise.resolve()
    },
    importChapterMarkdown: () => Promise.resolve(null),
    readResourceFile: () => Promise.resolve(null),
    checkUpdate: () => Promise.resolve('浏览器演示模式不支持自动更新'),
    syncPomodoro: () => Promise.resolve(),
    toggleWidget: () => Promise.resolve('unsupported'),
    closeWidget: () => Promise.resolve(false),
    backupNow: () => Promise.resolve(''),
    getMistakes: () => Promise.resolve(data.mistakes),
    saveMistake: (mistake) => {
      const midx = data.mistakes.findIndex(function (m) { return m.id === mistake.id })
      if (midx === -1) data.mistakes.push(mistake)
      else data.mistakes[midx] = mistake
      persist()
      return Promise.resolve(mistake)
    },
    deleteMistake: (id) => {
      data.mistakes = data.mistakes.filter(function (m) { return m.id !== id })
      persist()
      return Promise.resolve()
    },
    getVideoNotes: () => Promise.resolve(data.videoNotes),
    saveVideoNote: (video) => {
      const idx = data.videoNotes.findIndex(function (v) { return v.id === video.id })
      if (idx === -1) data.videoNotes.push(video)
      else data.videoNotes[idx] = video
      persist()
      return Promise.resolve(video)
    },
    deleteVideoNote: (id) => {
      data.videoNotes = data.videoNotes.filter(function (v) { return v.id !== id })
      persist()
      return Promise.resolve()
    },
    exportCardsCsv: () => Promise.resolve(''),
    exportMarkdownFolder: () => Promise.resolve(''),
    importChaptersFolder: () => Promise.resolve(0),
    pickFolder: () => Promise.resolve(''),
    syncNow: () => Promise.resolve(''),
    openBilibiliSearch: () => Promise.resolve(false),
    openBilibiliFavorites: () => Promise.resolve(false),
    getAISessions: () => Promise.resolve([]),
    saveAISession: (session) => {
      const sidx = data.aiSessions.findIndex(function (s) { return s.id === session.id })
      if (sidx === -1) data.aiSessions.push(session)
      else data.aiSessions[sidx] = session
      persist()
      return Promise.resolve(session)
    },
    deleteAISession: (id) => {
      data.aiSessions = data.aiSessions.filter(function (s) { return s.id !== id })
      persist()
      return Promise.resolve()
    },
    getQuizzes: () => Promise.resolve([]),
    saveQuiz: (quiz) => {
      const qidx = data.quizzes.findIndex(function (q) { return q.id === quiz.id })
      if (qidx === -1) data.quizzes.push(quiz)
      else data.quizzes[qidx] = quiz
      persist()
      return Promise.resolve(quiz)
    },
    deleteQuiz: (id) => {
      data.quizzes = data.quizzes.filter(function (q) { return q.id !== id })
      persist()
      return Promise.resolve()
    },
    exportTextFile: () => Promise.resolve(''),
    obsidianExport: () => Promise.resolve(''),
    obsidianImport: () => Promise.resolve(0),
    notesWidgetToggle: () => Promise.resolve('unsupported'),
    loadNotesWidget: () => Promise.resolve(''),
    saveNotesWidget: () => Promise.resolve(false),
  }
}


























