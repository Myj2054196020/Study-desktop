import type {
  VideoNote,
  AISession, AppSettings, Chapter, DailyTask, Goal, Lesson, Mistake, PomodoroRecord, QuizRecord, ReadingRecord, Reflection, Resource,
  ReviewCard, SearchResult, StudyStats, Subject, Textbook,
} from './types'

export interface ElectronAPI {
  search(query: string): Promise<SearchResult[]>
  getChapters(): Promise<Chapter[]>
  getTextbooks(): Promise<Textbook[]>
  getChapter(id: string): Promise<Chapter | null>
  updateChapter(id: string, data: Partial<Chapter>): Promise<boolean>
  addChapter(data: Partial<Chapter>): Promise<Chapter>
  deleteChapter(id: string): Promise<boolean>
  getPomodoroHistory(): Promise<PomodoroRecord[]>
  savePomodoroRecord(record: PomodoroRecord): Promise<boolean>
  getReadingRecords(): Promise<ReadingRecord[]>
  saveReadingRecord(record: ReadingRecord): Promise<boolean>
  getStats(days?: number): Promise<StudyStats>
  exportData(): Promise<string>
  importData(json: string): Promise<boolean>
  importDataFromFile(): Promise<string>
  exportChapterToMarkdown(chapterId: string): Promise<string>
  getDailyTasks(date?: string): Promise<DailyTask[]>
  getAllDailyTasks(): Promise<DailyTask[]>
  saveDailyTask(task: DailyTask): Promise<DailyTask>
  toggleDailyTask(id: string, completed: boolean): Promise<boolean>
  deleteDailyTask(id: string): Promise<boolean>
  addTaskFocusedMinutes(id: string, minutes: number): Promise<boolean>
  setTaskEstimate(id: string, minutes: number): Promise<boolean>
  getReflections(): Promise<Reflection[]>
  saveReflection(reflection: Reflection): Promise<Reflection>
  deleteReflection(id: string): Promise<boolean>
  getSubjects(): Promise<Subject[]>
  saveSubject(subject: Subject): Promise<Subject>
  deleteSubject(id: string): Promise<boolean>
  updateTextbook(id: string, patch: Partial<Textbook>): Promise<boolean>
  addTextbook(data: Partial<Textbook>): Promise<Textbook>
  getCards(): Promise<ReviewCard[]>
  getDueCards(limit?: number): Promise<ReviewCard[]>
  saveCard(card: ReviewCard): Promise<ReviewCard>
  deleteCard(id: string): Promise<boolean>
  gradeCard(id: string, grade: number): Promise<ReviewCard | null>
  getLessons(): Promise<Lesson[]>
  saveLesson(lesson: Lesson): Promise<Lesson>
  deleteLesson(id: string): Promise<boolean>
  getResources(): Promise<Resource[]>
  saveResource(resource: Resource): Promise<Resource>
  deleteResource(id: string): Promise<boolean>
  updateResourceProgress(id: string, patch: Partial<Resource>): Promise<boolean>
  pickResourceFile(): Promise<string | null>
  openResourceFile(filePath: string): Promise<string>
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<boolean>
  scheduleEbbinghaus(chapterId: string): Promise<DailyTask[]>
  aiChat(messages: { role: string; content: string }[]): Promise<string>
  showWindow(): Promise<boolean>
  getGoals(): Promise<Goal[]>
  saveGoal(goal: Goal): Promise<Goal>
  deleteGoal(id: string): Promise<boolean>
  getTaskTemplates(): Promise<DailyTask[]>
  deleteTaskTemplate(id: string): Promise<boolean>
  importChapterMarkdown(): Promise<{ filePath: string; title?: string; content: string } | null>
  readResourceFile(filePath: string): Promise<Uint8Array | null>
  checkUpdate(): Promise<string>
  setWindowTitle(title: string): Promise<boolean>
  notify(title: string, body: string): Promise<boolean>
  windowControls: {
    minimize(): Promise<boolean>
    toggleMaximize(): Promise<boolean>
    close(): Promise<boolean>
  }
  onOpenSearch(callback: () => void): () => void
  onStartPomodoro(callback: () => void): () => void
  onTogglePomodoro(callback: () => void): () => void
  onQuickTask(callback: () => void): () => void
  onSystemNotification(callback: (n: { title: string; body: string }) => void): () => void
  onPomodoroState(callback: (state: { isRunning: boolean; timeLeft: number; totalSession: number }) => void): () => void
  syncPomodoro(state: { isRunning: boolean; timeLeft: number; totalSession: number }): Promise<boolean>
  toggleWidget(): Promise<string>
  closeWidget(): Promise<boolean>
  backupNow(): Promise<string>
  getMistakes(): Promise<Mistake[]>
  saveMistake(mistake: Mistake): Promise<Mistake>
  deleteMistake(id: string): Promise<boolean>
  getVideoNotes(): Promise<VideoNote[]>
  saveVideoNote(video: VideoNote): Promise<VideoNote>
  deleteVideoNote(id: string): Promise<boolean>
  openExternal(url: string): Promise<boolean>
  exportCardsCsv(): Promise<string>
  exportMarkdownFolder(): Promise<string>
  importChaptersFolder(): Promise<number>
  pickFolder(): Promise<string>
  syncNow(): Promise<string>
  openBilibiliSearch(keyword: string): Promise<boolean>
  openBilibiliFavorites(uid: string): Promise<boolean>
  getAISessions(): Promise<AISession[]>
  saveAISession(session: AISession): Promise<AISession>
  deleteAISession(id: string): Promise<boolean>
  getQuizzes(): Promise<QuizRecord[]>
  saveQuiz(quiz: QuizRecord): Promise<QuizRecord>
  deleteQuiz(id: string): Promise<boolean>
  exportTextFile(title: string, content: string, ext?: string): Promise<string>
  obsidianExport(): Promise<string>
  obsidianImport(): Promise<number>
  notesWidgetToggle(): Promise<string>
  loadNotesWidget(): Promise<string>
  saveNotesWidget(content: string): Promise<boolean>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}









