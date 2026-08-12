import { contextBridge, ipcRenderer } from 'electron'

const api = {
  search: (query: string) => ipcRenderer.invoke('search', query),
  getChapters: () => ipcRenderer.invoke('chapters:getAll'),
  getTextbooks: () => ipcRenderer.invoke('chapters:getTextbooks'),
  getChapter: (id: string) => ipcRenderer.invoke('chapters:get', id),
  updateChapter: (id: string, data: unknown) => ipcRenderer.invoke('chapters:update', id, data),
  addChapter: (data: unknown) => ipcRenderer.invoke('chapters:add', data),
  deleteChapter: (id: string) => ipcRenderer.invoke('chapters:delete', id),
  getPomodoroHistory: () => ipcRenderer.invoke('pomodoro:history'),
  getReadingRecords: () => ipcRenderer.invoke('reading:history'),
  saveReadingRecord: (record: unknown) => ipcRenderer.invoke('reading:save', record),
  savePomodoroRecord: (record: unknown) => ipcRenderer.invoke('pomodoro:save', record),
  getStats: (days?: number) => ipcRenderer.invoke('stats:get', days),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: (json: string) => ipcRenderer.invoke('data:import', json),
  importDataFromFile: () => ipcRenderer.invoke('data:importFromFile'),
  exportChapterToMarkdown: (chapterId: string) => ipcRenderer.invoke('data:exportChapter', chapterId),
  getDailyTasks: (date?: string) => ipcRenderer.invoke('tasks:get', date),
  getAllDailyTasks: () => ipcRenderer.invoke('tasks:getAll'),
  saveDailyTask: (task: unknown) => ipcRenderer.invoke('tasks:save', task),
  toggleDailyTask: (id: string, completed: boolean) => ipcRenderer.invoke('tasks:toggle', id, completed),
  deleteDailyTask: (id: string) => ipcRenderer.invoke('tasks:delete', id),
  addTaskFocusedMinutes: (id: string, minutes: number) => ipcRenderer.invoke('tasks:addFocused', id, minutes),
  setTaskEstimate: (id: string, minutes: number) => ipcRenderer.invoke('tasks:setEstimate', id, minutes),
  getReflections: () => ipcRenderer.invoke('reflections:get'),
  saveReflection: (reflection: unknown) => ipcRenderer.invoke('reflections:save', reflection),
  deleteReflection: (id: string) => ipcRenderer.invoke('reflections:delete', id),
  getSubjects: () => ipcRenderer.invoke('subjects:get'),
  saveSubject: (subject: unknown) => ipcRenderer.invoke('subjects:save', subject),
  deleteSubject: (id: string) => ipcRenderer.invoke('subjects:delete', id),
  updateTextbook: (id: string, patch: unknown) => ipcRenderer.invoke('textbooks:update', id, patch),
  addTextbook: (data: unknown) => ipcRenderer.invoke('textbooks:add', data),
  getCards: () => ipcRenderer.invoke('cards:get'),
  getDueCards: (limit?: number) => ipcRenderer.invoke('cards:due', limit),
  saveCard: (card: unknown) => ipcRenderer.invoke('cards:save', card),
  deleteCard: (id: string) => ipcRenderer.invoke('cards:delete', id),
  gradeCard: (id: string, grade: number) => ipcRenderer.invoke('cards:grade', id, grade),
  getLessons: () => ipcRenderer.invoke('lessons:get'),
  saveLesson: (lesson: unknown) => ipcRenderer.invoke('lessons:save', lesson),
  deleteLesson: (id: string) => ipcRenderer.invoke('lessons:delete', id),
  getResources: () => ipcRenderer.invoke('resources:get'),
  saveResource: (resource: unknown) => ipcRenderer.invoke('resources:save', resource),
  deleteResource: (id: string) => ipcRenderer.invoke('resources:delete', id),
  updateResourceProgress: (id: string, patch: unknown) => ipcRenderer.invoke('resources:progress', id, patch),
  pickResourceFile: () => ipcRenderer.invoke('resources:pickFile'),
  openResourceFile: (filePath: string) => ipcRenderer.invoke('resources:openFile', filePath),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
  scheduleEbbinghaus: (chapterId: string) => ipcRenderer.invoke('schedule:ebbinghaus', chapterId),
  aiChat: (messages: unknown) => ipcRenderer.invoke('ai:chat', messages),
  showWindow: () => ipcRenderer.invoke('app:show'),
  getGoals: () => ipcRenderer.invoke('goals:get'),
  saveGoal: (goal: unknown) => ipcRenderer.invoke('goals:save', goal),
  deleteGoal: (id: string) => ipcRenderer.invoke('goals:delete', id),
  getTaskTemplates: () => ipcRenderer.invoke('tasks:templates'),
  deleteTaskTemplate: (id: string) => ipcRenderer.invoke('tasks:deleteTemplate', id),
  importChapterMarkdown: () => ipcRenderer.invoke('chapters:importMarkdown'),
  readResourceFile: (filePath: string) => ipcRenderer.invoke('resources:readFile', filePath),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  setWindowTitle: (title: string) => ipcRenderer.invoke('window:setTitle', title),
  notify: (title: string, body: string) => ipcRenderer.invoke('app:notify', title, body),
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  onOpenSearch: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('app:open-search', listener)
    return () => { ipcRenderer.removeListener('app:open-search', listener) }
  },
  onStartPomodoro: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('app:start-pomodoro', listener)
    return () => { ipcRenderer.removeListener('app:start-pomodoro', listener) }
  },
  onTogglePomodoro: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('app:toggle-pomodoro', listener)
    return () => { ipcRenderer.removeListener('app:toggle-pomodoro', listener) }
  },
  onQuickTask: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('app:quick-task', listener)
    return () => { ipcRenderer.removeListener('app:quick-task', listener) }
  },
  onSystemNotification: (callback: (n: unknown) => void) => {
    const listener = (_event: unknown, n: unknown) => callback(n)
    ipcRenderer.on('app:notify', listener)
    return () => { ipcRenderer.removeListener('app:notify', listener) }
  },
  onPomodoroState: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state)
    ipcRenderer.on('widget:state', listener)
    return () => { ipcRenderer.removeListener('widget:state', listener) }
  },
  syncPomodoro: (state: unknown) => ipcRenderer.invoke('pomodoro:sync', state),
  toggleWidget: () => ipcRenderer.invoke('widget:toggle'),
  closeWidget: () => ipcRenderer.invoke('widget:close'),
  widgetControl: (action: string) => ipcRenderer.invoke('widget:control', action),
  backupNow: () => ipcRenderer.invoke('app:backupNow'),
  getMistakes: () => ipcRenderer.invoke('mistakes:get'),
  saveMistake: (mistake: unknown) => ipcRenderer.invoke('mistakes:save', mistake),
  deleteMistake: (id: string) => ipcRenderer.invoke('mistakes:delete', id),
  getVideoNotes: () => ipcRenderer.invoke('videoNotes:get'),
  saveVideoNote: (video: unknown) => ipcRenderer.invoke('videoNotes:save', video),
  deleteVideoNote: (id: string) => ipcRenderer.invoke('videoNotes:delete', id),
  openExternal: (url: string) => ipcRenderer.invoke('openExternal', url),
  exportCardsCsv: () => ipcRenderer.invoke('export:cardsCsv'),
  exportMarkdownFolder: () => ipcRenderer.invoke('export:markdownFolder'),
  importChaptersFolder: () => ipcRenderer.invoke('chapters:importFolder'),
  pickFolder: () => ipcRenderer.invoke('app:pickFolder'),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  openBilibiliSearch: (keyword: string) => ipcRenderer.invoke('bilibili:search', keyword),
  openBilibiliFavorites: (uid: string) => ipcRenderer.invoke('bilibili:favorites', uid),
  getAISessions: () => ipcRenderer.invoke('aiSessions:get'),
  saveAISession: (session: unknown) => ipcRenderer.invoke('aiSessions:save', session),
  deleteAISession: (id: string) => ipcRenderer.invoke('aiSessions:delete', id),
  getQuizzes: () => ipcRenderer.invoke('quizzes:get'),
  saveQuiz: (quiz: unknown) => ipcRenderer.invoke('quizzes:save', quiz),
  deleteQuiz: (id: string) => ipcRenderer.invoke('quizzes:delete', id),
  exportTextFile: (title: string, content: string, ext?: string) => ipcRenderer.invoke('export:saveText', title, content, ext),
  obsidianExport: () => ipcRenderer.invoke('obsidian:export'),
  obsidianImport: () => ipcRenderer.invoke('obsidian:import'),
  notesWidgetToggle: () => ipcRenderer.invoke('notesWidget:toggle'),
  loadNotesWidget: () => ipcRenderer.invoke('notesWidget:load'),
  saveNotesWidget: (content: string) => ipcRenderer.invoke('notesWidget:save', content),
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api









