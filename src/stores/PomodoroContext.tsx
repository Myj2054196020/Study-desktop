import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createDb } from '../lib/db'
import { todayKey, uid } from '../lib/utils'
import { useApp } from './AppContext'

export interface PomodoroTask {
  id: string
  text: string
  subjectId?: string
}

export interface PomodoroFinish {
  at: string
  taskId?: string
  taskText?: string
  subjectId?: string
}

interface PomodoroState {
  isRunning: boolean
  timeLeft: number
  totalSession: number
  sessionCount: number
  currentTask: PomodoroTask | null
  dailyGoal: number
  phase: 'work' | 'break'
  start: () => void
  startForTask: (task: PomodoroTask) => void
  clearTask: () => void
  pause: () => void
  reset: () => void
  skip: () => void
  setDuration: (minutes: number) => void
  lastFinish: PomodoroFinish | null
  clearLastFinish: () => void
}

const PomodoroContext = createContext<PomodoroState | null>(null)

const APP_TITLE = 'Study desktop'

export function PomodoroProvider(props: { children: ReactNode }) {
  const { bumpDataVersion, settings } = useApp()
  const dailyGoal = (settings && settings.dailyPomodoroGoal) || 4
  const [duration, setDurationState] = useState(25)
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [currentTask, setCurrentTask] = useState<PomodoroTask | null>(null)
  const [phase, setPhase] = useState<'work' | 'break'>('work')
  const [lastFinish, setLastFinish] = useState<PomodoroFinish | null>(null)
  const phaseRef = useRef<'work' | 'break'>('work')
  const durationRef = useRef(duration)
  const currentTaskRef = useRef<PomodoroTask | null>(null)
  const startRef = useRef<() => void>(function () {})
  const pauseRef = useRef<() => void>(function () {})
  const isRunningRef = useRef(false)

  useEffect(function () {
    durationRef.current = duration
  }, [duration])

  useEffect(function () {
    currentTaskRef.current = currentTask
  }, [currentTask])

  useEffect(function () {
    phaseRef.current = phase
  }, [phase])

  useEffect(function () {
    startRef.current = start
    pauseRef.current = pause
    isRunningRef.current = isRunning
  })

  useEffect(function () {
    if (!window.electronAPI) return
    window.electronAPI.syncPomodoro({ isRunning, timeLeft, totalSession: durationRef.current * 60 })
  }, [isRunning, timeLeft])
  useEffect(function () {
    if (!window.electronAPI) return
    const offStart = window.electronAPI.onStartPomodoro(function () { startRef.current() })
    const offToggle = window.electronAPI.onTogglePomodoro(function () {
      const current = isRunningRef.current
      if (current) {
        pauseRef.current()
      } else {
        startRef.current()
      }
    })
    return function () { offStart(); offToggle() }
  }, [])

  useEffect(function () {
    let alive = true
    createDb().getPomodoroHistory().then(function (records) {
      if (!alive) return
      const key = todayKey()
      const count = records.filter(function (r) {
        return r.completed && r.startTime.slice(0, 10) === key
      }).length
      setSessionCount(count)
    }).catch(function () {})
    return function () { alive = false }
  }, [])

  const finishSession = function (completed: boolean) {
    const mins = durationRef.current
    const isWorkPhase = phaseRef.current === 'work'
    const now = new Date()
    const start = new Date(now.getTime() - mins * 60 * 1000)
    createDb().savePomodoroRecord({
      id: uid('pm'),
      startTime: start.toISOString(),
      endTime: now.toISOString(),
      durationMinutes: mins,
      completed: completed && isWorkPhase,
      taskId: currentTaskRef.current ? currentTaskRef.current.id : undefined,
      subjectId: currentTaskRef.current ? currentTaskRef.current.subjectId : undefined,
    }).then(function () {
      if (completed && isWorkPhase) {
        setSessionCount(function (n) { return n + 1 })
        const task = currentTaskRef.current
        setLastFinish({
          at: new Date().toISOString(),
          taskId: task ? task.id : undefined,
          taskText: task ? task.text : undefined,
          subjectId: task ? task.subjectId : undefined,
        })
        createDb().notify('🍅 番茄钟完成', '完成了一个 ' + mins + ' 分钟的专注时段')
        // 把本轮专注时长回填到关联任务（任务卡片显示「投入 X 分钟」）
        const taskId = task ? task.id : undefined
        const done = function () { bumpDataVersion() }
        if (taskId) {
          createDb().addTaskFocusedMinutes(taskId, mins).then(done).catch(done)
        } else {
          done()
        }
      }
    }).catch(function () {})
    if (settings && settings.autoCycle && completed) {
      const nextPhase = isWorkPhase ? 'break' : 'work'
      const nextMins = nextPhase === 'break' ? 5 : 25
      setPhase(nextPhase)
      setDurationState(nextMins)
      setTimeLeft(nextMins * 60)
      setIsRunning(true)
      document.title = APP_TITLE
      if (window.electronAPI) {
        window.electronAPI.setWindowTitle(APP_TITLE)
      }
      return
    }
    setIsRunning(false)
    setTimeLeft(mins * 60)
    document.title = APP_TITLE
    if (window.electronAPI) {
      window.electronAPI.setWindowTitle(APP_TITLE)
    }
  }

  useEffect(function () {
    if (!isRunning) return
    const timer = setInterval(function () {
      setTimeLeft(function (prev) {
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return function () { clearInterval(timer) }
  }, [isRunning])

  useEffect(function () {
    if (isRunning || timeLeft !== 0) return
    finishSession(true)
  }, [isRunning, timeLeft])

  useEffect(function () {
    if (isRunning) return
    document.title = APP_TITLE
    if (window.electronAPI) {
      window.electronAPI.setWindowTitle(APP_TITLE)
    }
  }, [isRunning])

  useEffect(function () {
    if (!isRunning) return
    const fmt = function (s: number) {
      const m = Math.floor(s / 60)
      const sec = s % 60
      const pad = function (n: number) { return n < 10 ? '0' + String(n) : String(n) }
      return pad(m) + ':' + pad(sec)
    }
    document.title = '🍅 ' + fmt(timeLeft) + ' - ' + APP_TITLE
    if (window.electronAPI) {
      window.electronAPI.setWindowTitle('🍅 ' + fmt(timeLeft) + ' - ' + APP_TITLE)
    }
  }, [isRunning, timeLeft])

  const clearTask = function () {
    setCurrentTask(null)
    currentTaskRef.current = null
  }

  const clearLastFinish = function () {
    setLastFinish(null)
  }

  const start = function () {
    setLastFinish(null)
    if (timeLeft <= 0) {
      setTimeLeft(durationRef.current * 60)
    }
    setIsRunning(true)
  }
  const startForTask = function (task: PomodoroTask) {
    setLastFinish(null)
    setCurrentTask(task)
    setDuration(25)
    setTimeLeft(25 * 60)
    setIsRunning(true)
  }
  const pause = function () {
    setIsRunning(false)
  }
  const reset = function () {
    setIsRunning(false)
    setTimeLeft(durationRef.current * 60)
  }
  const skip = function () {
    if (isRunning) {
      finishSession(false)
    }
  }
  const setDuration = function (minutes: number) {
    setIsRunning(false)
    setDurationState(minutes)
    setTimeLeft(minutes * 60)
  }

  const value: PomodoroState = {
    isRunning,
    timeLeft,
    totalSession: duration * 60,
    sessionCount,
    currentTask,
    dailyGoal,
    phase,
    start,
    startForTask,
    clearTask,
    pause,
    reset,
    skip,
    setDuration,
    lastFinish,
    clearLastFinish,
  }

  return <PomodoroContext.Provider value={value}>{props.children}</PomodoroContext.Provider>
}

export function usePomodoro(): PomodoroState {
  const ctx = useContext(PomodoroContext)
  if (!ctx) {
    throw new Error('usePomodoro must be used within PomodoroProvider')
  }
  return ctx
}









