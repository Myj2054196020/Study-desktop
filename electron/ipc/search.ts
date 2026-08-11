import type { Chapter, DailyTask, Reflection, SearchResult, Textbook } from '../types'

const CJK_RE = /[\u4e00-\u9fa5]/g
const WORD_RE = /[a-z0-9]+/g

export function tokenize(text: string): string[] {
  const lower = (text || '').toLowerCase()
  const tokens: string[] = []
  const words = lower.match(WORD_RE)
  if (words) {
    tokens.push.apply(tokens, words)
  }
  const chars = lower.match(CJK_RE) || []
  for (const ch of chars) {
    tokens.push(ch)
  }
  for (let i = 0; i < chars.length - 1; i += 1) {
    tokens.push(chars[i] + chars[i + 1])
  }
  return tokens
}

export type SearchKind = 'chapter' | 'reflection' | 'task'

export interface IndexEntry {
  id: string
  kind: SearchKind
  title: string
  textbookName: string
  titleTokens: string[]
  contentTokens: string[]
  content: string
}

export interface SearchExtras {
  reflections?: Reflection[]
  tasks?: DailyTask[]
}

export function buildIndex(chapters: Chapter[], textbooks: Textbook[], extras?: SearchExtras): IndexEntry[] {
  const names = new Map<string, string>()
  for (const tb of textbooks) {
    names.set(tb.id, tb.name)
  }
  const entries: IndexEntry[] = chapters.map(function (ch) {
    return {
      id: ch.id,
      kind: 'chapter',
      title: ch.title,
      textbookName: names.get(ch.textbookId) || '',
      titleTokens: tokenize(ch.title),
      contentTokens: tokenize(ch.content),
      content: ch.content || '',
    }
  })
  for (const r of (extras && extras.reflections) || []) {
    entries.push({
      id: r.id,
      kind: 'reflection',
      title: r.title,
      textbookName: '',
      titleTokens: tokenize(r.title),
      contentTokens: tokenize(r.content),
      content: r.content || '',
    })
  }
  for (const t of (extras && extras.tasks) || []) {
    entries.push({
      id: t.id,
      kind: 'task',
      title: t.text,
      textbookName: '',
      titleTokens: tokenize(t.text),
      contentTokens: [],
      content: '',
    })
  }
  return entries
}

export function search(index: IndexEntry[], query: string, limit = 20): SearchResult[] {
  const q = (query || '').trim()
  if (!q) {
    return []
  }
  const qTokens = tokenize(q)
  const results: SearchResult[] = []
  for (const entry of index) {
    let score = 0
    for (const t of qTokens) {
      if (entry.titleTokens.indexOf(t) !== -1) {
        score += 3
      }
      if (entry.contentTokens.indexOf(t) !== -1) {
        score += 1
      }
    }
    if (score > 0) {
      results.push({
        chapterId: entry.id,
        kind: entry.kind,
        title: entry.title,
        snippet: makeSnippet(entry.content, qTokens),
        textbookName: entry.textbookName,
        score,
      })
    }
  }
  results.sort(function (a, b) {
    return b.score - a.score
  })
  return results.slice(0, limit)
}

function makeSnippet(content: string, qTokens: string[]): string {
  const lower = content.toLowerCase()
  let best = -1
  for (const t of qTokens) {
    const idx = lower.indexOf(t)
    if (idx !== -1 && (best === -1 || idx < best)) {
      best = idx
    }
  }
  if (best === -1) {
    return content.slice(0, 50)
  }
  const start = Math.max(0, best - 25)
  const end = Math.min(content.length, best + 50)
  let snippet = content.slice(start, end).replace(/\s+/g, ' ')
  if (start > 0) {
    snippet = '...' + snippet
  }
  if (end < content.length) {
    snippet = snippet + '...'
  }
  return snippet
}
