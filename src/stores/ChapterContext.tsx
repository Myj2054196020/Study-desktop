import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Chapter, Textbook } from '../types'
import { createDb } from '../lib/db'
import { uid } from '../lib/utils'
import { useApp } from './AppContext'

interface ChapterState {
  textbooks: Textbook[]
  chapters: Chapter[]
  loading: boolean
  selectedId: string | null
  selectChapter: (id: string | null) => void
  toggleChapterComplete: (id: string) => Promise<boolean>
  addChapter: (data: Partial<Chapter>) => Promise<Chapter>
  updateChapterContent: (id: string, patch: Partial<Chapter>) => Promise<void>
  deleteChapter: (id: string) => Promise<void>
  getChapter: (id: string) => Chapter | undefined
}

const ChapterContext = createContext<ChapterState | null>(null)

export function ChapterProvider(props: { children: ReactNode }) {
  const { bumpDataVersion, settings, dataVersion } = useApp()
  const [textbooks, setTextbooks] = useState<Textbook[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(function () {
    let alive = true
    const db = createDb()
    Promise.all([db.getTextbooks(), db.getChapters()]).then(function (results) {
      if (!alive) return
      setTextbooks(results[0])
      setChapters(results[1])
      setLoading(false)
    }).catch(function () {
      if (alive) setLoading(false)
    })
    return function () { alive = false }
  }, [dataVersion])

  const selectChapter = function (id: string | null) {
    setSelectedId(id)
  }

  const toggleChapterComplete = async function (id: string) {
    const found = chapters.find(function (c) { return c.id === id })
    if (!found) return false
    const completed = !found.completed
    const completedAt = completed ? new Date().toISOString() : undefined
    await createDb().updateChapter(id, { completed, completedAt })
    setChapters(function (prev) {
      return prev.map(function (c) {
        if (c.id !== id) return c
        return Object.assign({}, c, { completed, completedAt })
      })
    })
    bumpDataVersion()
    if (completed && settings && settings.autoReviewOnComplete) {
      try {
        const created = await createDb().scheduleEbbinghaus(id)
        const now = new Date().toISOString()
        const tb = textbooks.find(function (t) { return t.id === found.textbookId })
        await createDb().saveCard({
          id: uid('card'),
          front: found.title,
          back: found.content.slice(0, 300),
          chapterId: id,
          subjectId: tb ? tb.subjectId : undefined,
          status: 'new',
          due: now,
          intervalDays: 0,
          ease: 2.5,
          reps: 0,
          lapses: 0,
          createdAt: now,
          updatedAt: now,
        })
        bumpDataVersion()
        return true
      } catch (err) {
        console.log('auto review setup failed: ' + String(err))
        return false
      }
    }
    return false
  }

  const addChapter = async function (data: Partial<Chapter>): Promise<Chapter> {
    const chapter = await createDb().addChapter(data)
    setChapters(function (prev) { return prev.concat([chapter]) })
    bumpDataVersion()
    return chapter
  }

  const updateChapterContent = async function (id: string, patch: Partial<Chapter>) {
    await createDb().updateChapter(id, patch)
    setChapters(function (prev) {
      return prev.map(function (c) {
        if (c.id !== id) return c
        return Object.assign({}, c, patch)
      })
    })
    bumpDataVersion()
  }

  const deleteChapter = async function (id: string) {
    await createDb().deleteChapter(id)
    setChapters(function (prev) { return prev.filter(function (c) { return c.id !== id }) })
    if (selectedId === id) {
      setSelectedId(null)
    }
    bumpDataVersion()
  }

  const getChapter = function (id: string): Chapter | undefined {
    return chapters.find(function (c) { return c.id === id })
  }

  const value: ChapterState = {
    textbooks,
    chapters,
    loading,
    selectedId,
    selectChapter,
    toggleChapterComplete,
    addChapter,
    updateChapterContent,
    deleteChapter,
    getChapter,
  }

  return <ChapterContext.Provider value={value}>{props.children}</ChapterContext.Provider>
}

export function useChapters(): ChapterState {
  const ctx = useContext(ChapterContext)
  if (!ctx) {
    throw new Error('useChapters must be used within ChapterProvider')
  }
  return ctx
}

