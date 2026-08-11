import { dialog, BrowserWindow } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DataStore } from './database'

export async function exportAllData(win: BrowserWindow, store: DataStore): Promise<string> {
  const result = await dialog.showSaveDialog(win, {
    title: '导出全部数据',
    defaultPath: 'learning-backup.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePath) {
    return 'cancelled'
  }
  fs.writeFileSync(result.filePath, store.exportAll(), 'utf8')
  return result.filePath
}

export async function importData(win: BrowserWindow, store: DataStore): Promise<string> {
  const result = await dialog.showOpenDialog(win, {
    title: '导入数据',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return 'cancelled'
  }
  const raw = fs.readFileSync(result.filePaths[0], 'utf8')
  store.importAll(raw)
  return 'ok'
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*<>|]/g, '_')
  return cleaned.replace(new RegExp(String.fromCharCode(34), 'g'), '_')
}

export async function exportCardsCsv(win: BrowserWindow, store: DataStore): Promise<string> {
  const result = await dialog.showSaveDialog(win, {
    title: '导出复习卡片 CSV（可导入 Anki）',
    defaultPath: 'cards.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })
  if (result.canceled || !result.filePath) {
    return 'cancelled'
  }
  const escape = function (s: string): string {
    return String.fromCharCode(34) + String(s).replace(new RegExp(String.fromCharCode(34), 'g'), String.fromCharCode(34) + String.fromCharCode(34)) + String.fromCharCode(34)
  }
  const lines = ['front,back,tags']
  for (const c of store.getCards()) {
    lines.push(escape(c.front) + ',' + escape(c.back) + ',' + escape(''))
  }
  fs.writeFileSync(result.filePath, lines.join('\n'), 'utf8')
  return result.filePath
}

export async function exportTextToFile(win: BrowserWindow, title: string, content: string, ext = 'md'): Promise<string> {
  const label = ext === 'html' ? 'HTML' : 'Markdown'
  const result = await dialog.showSaveDialog(win, {
    title: '导出为 ' + label,
    defaultPath: title + '.' + ext,
    filters: [{ name: label, extensions: [ext] }],
  })
  if (result.canceled || !result.filePath) {
    return 'cancelled'
  }
  fs.writeFileSync(result.filePath, content, 'utf8')
  return result.filePath
}

export async function exportMarkdownFolder(win: BrowserWindow, store: DataStore, folder?: string): Promise<string> {
  let base = folder
  if (!base) {
    const result = await dialog.showOpenDialog(win, {
      title: '选择导出文件夹（将创建 study-desktop-export 子目录）',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths || !result.filePaths[0]) {
      return 'cancelled'
    }
    base = result.filePaths[0]
  }
  const out = path.join(base, 'study-desktop-export')
  fs.mkdirSync(out, { recursive: true })
  for (const tb of store.getTextbooks()) {
    const tbDir = path.join(out, sanitizeFileName(tb.name))
    fs.mkdirSync(tbDir, { recursive: true })
    const chapters = store.getAllChapters().filter(function (c) { return c.textbookId === tb.id })
    for (const ch of chapters) {
      fs.writeFileSync(path.join(tbDir, sanitizeFileName(ch.title) + '.md'), '# ' + ch.title + '\n\n' + (ch.content || ''), 'utf8')
    }
  }
  const reflDir = path.join(out, '学习心得')
  fs.mkdirSync(reflDir, { recursive: true })
  for (const r of store.getReflections()) {
    fs.writeFileSync(path.join(reflDir, sanitizeFileName(r.title) + '.md'), '# ' + r.title + '\n\n' + (r.content || ''), 'utf8')
  }
  return out
}

export async function importChaptersFolder(win: BrowserWindow, store: DataStore, folder?: string): Promise<number> {
  let dir = folder
  if (!dir) {
    const result = await dialog.showOpenDialog(win, {
      title: '选择包含 .md 文件的文件夹（子文件夹 = 课本，批量导入为章节）',
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths || !result.filePaths[0]) {
      return 0
    }
    dir = result.filePaths[0]
  }
  const isMd = function (name: string): boolean {
    return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt')
  }
  let count = 0
  const readMd = function (filePath: string, textbookId: string) {
    const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
    const titleMatch = content.match(/^#\s+(.+)/m)
    const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath).replace(/\.(md|markdown|txt)$/i, '')
    store.insertChapter({ title, content, textbookId })
    count += 1
  }
  const walk = function (current: string, textbookId: string) {
    for (const e of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, e.name)
      if (e.isDirectory()) {
        walk(full, textbookId)
      } else if (e.isFile() && isMd(e.name)) {
        readMd(full, textbookId)
      }
    }
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort(function (a, b) {
    return a.name.localeCompare(b.name)
  })
  let defaultTbId = store.getTextbooks().length > 0 ? store.getTextbooks()[0].id : ''
  for (const e of entries) {
    if (e.isDirectory()) {
      let tb = store.getTextbooks().find(function (t) { return t.name === e.name })
      if (!tb) {
        tb = store.insertTextbook({ name: e.name })
      }
      walk(path.join(dir, e.name), tb.id)
    }
  }
  if (!defaultTbId) {
    defaultTbId = store.insertTextbook({ name: '导入的笔记' }).id
  }
  for (const e of entries) {
    if (e.isFile() && isMd(e.name)) {
      readMd(path.join(dir, e.name), defaultTbId)
    }
  }
  return count
}

export async function exportChapterToMarkdown(win: BrowserWindow, store: DataStore, chapterId: string): Promise<string> {
  const chapter = store.getChapter(chapterId)
  if (!chapter) {
    return 'not found'
  }
  const result = await dialog.showSaveDialog(win, {
    title: '导出章节为 Markdown',
    defaultPath: chapter.title + '.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (result.canceled || !result.filePath) {
    return 'cancelled'
  }
  const md = '# ' + chapter.title + '\n\n' + (chapter.content || '')
  fs.writeFileSync(result.filePath, md, 'utf8')
  return result.filePath
}





