export interface HighlightPart {
  text: string
  hit: boolean
}

export function highlightParts(text: string, query: string): HighlightPart[] {
  const q = (query || '').trim().toLowerCase()
  const parts: HighlightPart[] = []
  if (!q) {
    return [{ text, hit: false }]
  }
  const lower = text.toLowerCase()
  const marks: { start: number; end: number }[] = []
  const tokens = q.split(/\s+/).filter(function (t) {
    return t.length > 0
  })
  for (const token of tokens) {
    let idx = lower.indexOf(token)
    while (idx !== -1) {
      marks.push({ start: idx, end: idx + token.length })
      idx = lower.indexOf(token, idx + 1)
    }
  }
  if (marks.length === 0) {
    return [{ text, hit: false }]
  }
  marks.sort(function (a, b) {
    return a.start - b.start
  })
  const merged: { start: number; end: number }[] = []
  for (const m of marks) {
    const last = merged[merged.length - 1]
    if (last && m.start <= last.end) {
      last.end = Math.max(last.end, m.end)
    } else {
      merged.push({ start: m.start, end: m.end })
    }
  }
  let cursor = 0
  for (const m of merged) {
    if (m.start > cursor) {
      parts.push({ text: text.slice(cursor, m.start), hit: false })
    }
    parts.push({ text: text.slice(m.start, m.end), hit: true })
    cursor = m.end
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), hit: false })
  }
  return parts
}
