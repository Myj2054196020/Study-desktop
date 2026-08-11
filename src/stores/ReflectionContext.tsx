import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Reflection } from '../types'
import { createDb } from '../lib/db'
import { uid } from '../lib/utils'
import { useApp } from './AppContext'

interface ReflectionInput {
  id?: string
  title: string
  content: string
  chapterId?: string
  subjectId?: string
  images?: string[]
}

interface ReflectionState {
  reflections: Reflection[]
  loading: boolean
  saveReflection: (data: ReflectionInput) => Promise<void>
  deleteReflection: (id: string) => Promise<void>
}

const ReflectionContext = createContext<ReflectionState | null>(null)

export function ReflectionProvider(props: { children: ReactNode }) {
  const { bumpDataVersion } = useApp()
  const [reflections, setReflections] = useState<Reflection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(function () {
    let alive = true
    createDb().getReflections().then(function (list) {
      if (!alive) return
      setReflections(list)
      setLoading(false)
    }).catch(function () {
      if (alive) setLoading(false)
    })
    return function () { alive = false }
  }, [])

  const saveReflection = async function (data: ReflectionInput) {
    const now = new Date().toISOString()
    const existing = data.id ? reflections.find(function (r) { return r.id === data.id }) : undefined
    const reflection: Reflection = {
      id: data.id || uid('refl'),
      title: data.title.trim() || '未命名心得',
      content: data.content,
      chapterId: data.chapterId || (existing ? existing.chapterId : undefined),
      subjectId: data.subjectId !== undefined ? data.subjectId : (existing ? existing.subjectId : undefined),
      images: data.images || (existing ? existing.images : undefined),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    }
    await createDb().saveReflection(reflection)
    setReflections(function (prev) {
      const idx = prev.findIndex(function (r) { return r.id === reflection.id })
      let next: Reflection[]
      if (idx === -1) {
        next = [reflection].concat(prev)
      } else {
        next = prev.slice()
        next[idx] = reflection
      }
      return next.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt) })
    })
    bumpDataVersion()
  }

  const deleteReflection = async function (id: string) {
    await createDb().deleteReflection(id)
    setReflections(function (prev) { return prev.filter(function (r) { return r.id !== id }) })
    bumpDataVersion()
  }

  const value: ReflectionState = { reflections, loading, saveReflection, deleteReflection }
  return <ReflectionContext.Provider value={value}>{props.children}</ReflectionContext.Provider>
}

export function useReflections(): ReflectionState {
  const ctx = useContext(ReflectionContext)
  if (!ctx) {
    throw new Error('useReflections must be used within ReflectionProvider')
  }
  return ctx
}

