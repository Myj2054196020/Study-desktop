export interface Subject {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface Textbook {
  id: string
  name: string
  subject: string
  subjectId?: string
  totalChapters: number
  createdAt: string
}

export interface Chapter {
  id: string
  textbookId: string
  title: string
  order: number
  content: string
  completed: boolean
  completedAt?: string
  studyMinutes: number
  tags: string[]
  parentId?: string
  createdAt: string
}

export interface PomodoroRecord {
  id: string
  startTime: string
  endTime: string
  durationMinutes: number
  chapterId?: string
  taskId?: string
  subjectId?: string
  completed: boolean
}

export interface ReadingRecord {
  id: string
  resourceId: string
  resourceTitle: string
  startTime: string
  endTime: string
  durationMinutes: number
  createdAt: string
}

export interface DailyTask {
  id: string
  date: string
  text: string
  completed: boolean
  completedAt?: string
  createdAt: string
  subjectId?: string
  taskType?: 'normal' | 'review' | 'card-review'
  sourceChapterId?: string
  sourceCardId?: string
  repeat?: 'daily' | 'weekly'
  remindAt?: string
  templateId?: string
  goalId?: string
  focusedMinutes?: number
  estimateMinutes?: number
}

export interface Reflection {
  id: string
  title: string
  content: string
  chapterId?: string
  subjectId?: string
  images?: string[]
  createdAt: string
  updatedAt: string
}

export interface AISession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

export interface ReviewCard {
  id: string
  front: string
  back: string
  chapterId?: string
  subjectId?: string
  status: 'new' | 'learning' | 'review'
  due: string
  intervalDays: number
  ease: number
  reps: number
  lapses: number
  createdAt: string
  updatedAt: string
  lastReviewedAt?: string
  stability?: number
  difficulty?: number
  fsrsState?: number
  note?: string
  mistakeId?: string
}

export interface VideoNoteItem {
  id: string
  time: string
  text: string
  createdAt: string
}

export interface VideoNote {
  id: string
  url: string
  title: string
  subjectId?: string
  notes: VideoNoteItem[]
  createdAt: string
  updatedAt: string
}

export interface Lesson {
  id: string
  name: string
  teacher?: string
  location?: string
  color: string
  dayOfWeek: number
  startMinute: number
  endMinute: number
  subjectId?: string
  enabled: boolean
}

export interface ResourceNote {
  id: string
  page?: number
  text: string
  createdAt: string
}

export interface ResourceBookmark {
  page: number
  label?: string
  createdAt: string
}

export interface Resource {
  id: string
  title: string
  type: 'pdf' | 'ebook' | 'image' | 'other'
  filePath?: string
  totalPages?: number
  currentPage?: number
  readingMinutes: number
  favorite: boolean
  tags: string[]
  notes: ResourceNote[]
  bookmarks?: ResourceBookmark[]
  addedAt: string
  updatedAt: string
}

export interface ChapterTemplateField {
  label: string
  emoji?: string
  placeholder?: string
}

export interface ChapterTemplate {
  id: string
  name: string
  desc: string
  category?: string
  fields?: ChapterTemplateField[]
  content: string
}

export interface GraphPreset {
  id: string
  name: string
  groupBy: string
  layout: string
  sizeMode: string
  subjectFilter: string
  statusFilter: string
  search: string
}

export interface PeriodTemplate {
  id: string
  name: string
  startMinute: number
  endMinute: number
}

export interface AppSettings {
  aiProvider?: string
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string
  autoStart: boolean
  startHidden: boolean
  periods: PeriodTemplate[]
  syncFolder?: string
  obsidianFolder?: string
  onboardingDone?: boolean
  accentColor?: string
  fontSize?: 'small' | 'normal' | 'large'
  density?: 'comfortable' | 'compact'
  dailyPomodoroGoal?: number
  autoReviewOnComplete?: boolean
  autoCardOnMistake?: boolean
  autoCycle?: boolean
  chapterTemplates?: ChapterTemplate[]
  graphPresets?: GraphPreset[]
  unfinishedRemindAt?: string
}

export interface QuizItem {
  q: string
  options: string[]
  answer: number
}

export interface QuizRecord {
  id: string
  title: string
  chapterId?: string
  subjectId?: string
  items: QuizItem[]
  userAnswers: number[]
  score: number
  total: number
  createdAt: string
}

export interface Mistake {
  id: string
  question: string
  myAnswer?: string
  correctAnswer?: string
  reason?: string
  chapterId?: string
  subjectId?: string
  images?: string[]
  status: 'open' | 'reviewing' | 'mastered'
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: string
  title: string
  subjectId?: string
  deadline?: string
  done: boolean
  createdAt: string
  updatedAt: string
}

export interface SearchResult {
  chapterId: string
  title: string
  snippet: string
  textbookName: string
  score: number
  kind: 'chapter' | 'reflection' | 'task'
}

export interface DailyStat {
  date: string
  minutes: number
  chapters: number
}

export interface HeatmapDay {
  date: string
  minutes: number
}

export interface SubjectDailyStat {
  subjectId: string
  name: string
  color: string
  days: { date: string; minutes: number }[]
}

export interface SubjectStat {
  subjectId: string
  name: string
  color: string
  minutes: number
  completedChapters: number
  totalChapters: number
  tasksDone: number
  tasksTotal: number
}

export interface StudyStats {
  totalStudyMinutes: number
  completedChapters: number
  totalChapters: number
  dailyStats: DailyStat[]
  pomodoroCount: number
  streakDays: number
  subjectStats: SubjectStat[]
  subjectDaily: SubjectDailyStat[]
  heatmap: HeatmapDay[]
  pomodoroTotal: number
  pomodoroCompleted: number
}

export type AppPage = 'dashboard' | 'tasks' | 'chapters' | 'reflections' | 'mistakes' | 'cards' | 'timetable' | 'pomodoro' | 'bookshelf' | 'stats' | 'graph' | 'ai' | 'bilibili' | 'settings'










