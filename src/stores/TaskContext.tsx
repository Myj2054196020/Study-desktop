import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { DailyTask } from '../types'
import { createDb } from '../lib/db'
import { todayKey, uid } from '../lib/utils'
import { useApp } from './AppContext'

interface TaskState {
  tasks: DailyTask[]
  loading: boolean
  addTask: (text: string, subjectId?: string) => Promise<void>
  toggleTask: (id: string, completed: boolean) => Promise<void>
  updateTaskText: (id: string, text: string) => Promise<void>
  setTaskEstimate: (id: string, minutes: number) => Promise<void>
  deleteTask: (id: string) => Promise<void>
}

const TaskContext = createContext<TaskState | null>(null)

export function TaskProvider(props: { children: ReactNode }) {
  const { bumpDataVersion, dataVersion } = useApp()
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(function () {
    let alive = true
    createDb().getDailyTasks().then(function (list) {
      if (!alive) return
      setTasks(list)
      setLoading(false)
    }).catch(function () {
      if (alive) setLoading(false)
    })
    return function () { alive = false }
  }, [dataVersion])

  const addTask = async function (text: string, subjectId?: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const task: DailyTask = {
      id: uid('task'),
      date: todayKey(),
      text: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
      subjectId,
    }
    await createDb().saveDailyTask(task)
    setTasks(function (prev) { return prev.concat([task]) })
    bumpDataVersion()
  }

  const toggleTask = async function (id: string, completed: boolean) {
    await createDb().toggleDailyTask(id, completed)
    setTasks(function (prev) {
      return prev.map(function (t) {
        if (t.id !== id) return t
        return Object.assign({}, t, { completed, completedAt: completed ? new Date().toISOString() : undefined })
      })
    })
    bumpDataVersion()
  }

  const updateTaskText = async function (id: string, text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const found = tasks.find(function (t) { return t.id === id })
    if (!found) return
    const updated = Object.assign({}, found, { text: trimmed })
    await createDb().saveDailyTask(updated)
    setTasks(function (prev) {
      return prev.map(function (t) { return t.id === id ? updated : t })
    })
    bumpDataVersion()
  }

  const setTaskEstimate = async function (id: string, minutes: number) {
    const found = tasks.find(function (t) { return t.id === id })
    if (!found) return
    const updated = Object.assign({}, found, { estimateMinutes: minutes })
    await createDb().setTaskEstimate(id, minutes)
    setTasks(function (prev) {
      return prev.map(function (t) { return t.id === id ? updated : t })
    })
    bumpDataVersion()
  }

  const deleteTask = async function (id: string) {
    await createDb().deleteDailyTask(id)
    setTasks(function (prev) { return prev.filter(function (t) { return t.id !== id }) })
    bumpDataVersion()
  }

  const value: TaskState = { tasks, loading, addTask, toggleTask, updateTaskText, setTaskEstimate, deleteTask }
  return <TaskContext.Provider value={value}>{props.children}</TaskContext.Provider>
}

export function useTasks(): TaskState {
  const ctx = useContext(TaskContext)
  if (!ctx) {
    throw new Error('useTasks must be used within TaskProvider')
  }
  return ctx
}

