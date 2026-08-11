import { useEffect, useRef, useState } from 'react'
import { Layers, ListChecks, Repeat, Target } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import type { KeyboardEvent } from 'react'
import { useTasks } from '../../stores/TaskContext'
import { usePomodoro } from '../../stores/PomodoroContext'
import { useApp } from '../../stores/AppContext'
import { createDb } from '../../lib/db'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Checkbox } from '../ui/Checkbox'
import { todayKey, uid } from '../../lib/utils'
import type { DailyTask, Subject } from '../../types'

export default function DailyTasksPage() {
  const { tasks, loading, addTask, toggleTask, updateTaskText, setTaskEstimate, deleteTask } = useTasks()
  const { startForTask } = usePomodoro()
  const { setActivePage, dataVersion } = useApp()
  const [text, setText] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [estId, setEstId] = useState<string | null>(null)
  const [estText, setEstText] = useState('')
  const [templates, setTemplates] = useState<DailyTask[]>([])
  const [tplText, setTplText] = useState('')
  const [tplRepeat, setTplRepeat] = useState<'daily' | 'weekly'>('daily')
  const [tplRemind, setTplRemind] = useState('')
  const [leftovers, setLeftovers] = useState<DailyTask[]>([])
  const taskInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(function () {
    if (!window.electronAPI) return
    const off = window.electronAPI.onQuickTask(function () {
      if (taskInputRef.current) {
        taskInputRef.current.focus()
      }
    })
    return off
  }, [])

  useEffect(function () {
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
    createDb().getTaskTemplates().then(function (list) { setTemplates(list) }).catch(function () {})
  }, [])

  useEffect(function () {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const pad = function (n: number) { return n < 10 ? '0' + String(n) : String(n) }
    const yesterday = String(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    createDb().getDailyTasks(yesterday).then(function (list) {
      setLeftovers(list.filter(function (t) { return !t.completed }))
    }).catch(function () {})
  }, [dataVersion])

  const finishLeftover = async function (t: DailyTask) {
    await createDb().toggleDailyTask(t.id, true)
    setLeftovers(function (prev) { return prev.filter(function (x) { return x.id !== t.id }) })
  }
  const deleteLeftover = async function (t: DailyTask) {
    const ok = window.confirm('删除这条昨日遗留任务？')
    if (ok) {
      await createDb().deleteDailyTask(t.id)
      setLeftovers(function (prev) { return prev.filter(function (x) { return x.id !== t.id }) })
    }
  }

  const addTemplate = async function () {
    const text = tplText.trim()
    if (!text) return
    await createDb().saveDailyTask({
      id: uid('tpl'),
      date: '',
      text,
      completed: false,
      createdAt: new Date().toISOString(),
      subjectId: subjectId || undefined,
      repeat: tplRepeat,
      remindAt: tplRemind || undefined,
    })
    setTplText('')
    createDb().getTaskTemplates().then(function (list) { setTemplates(list) }).catch(function () {})
  }

  const deleteTemplate = async function (id: string) {
    const ok = window.confirm('删除该重复任务模板及未来生成的任务吗？')
    if (ok) {
      await createDb().deleteTaskTemplate(id)
      createDb().getTaskTemplates().then(function (list) { setTemplates(list) }).catch(function () {})
    }
  }

  const subjectOf = function (id?: string): Subject | undefined {
    return subjects.find(function (s) { return s.id === id })
  }

  const handleAdd = async function () {
    await addTask(text, subjectId || undefined)
    setText('')
  }

  const handleKeyDown = function (e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleAdd()
    }
  }

  const startEdit = function (id: string, current: string) {
    setEditingId(id)
    setEditText(current)
  }

  const saveEdit = async function (id: string) {
    await updateTaskText(id, editText)
    setEditingId(null)
  }

  const startEstimate = function (id: string, current?: number) {
    setEditingId(null)
    setEstId(id)
    setEstText(current ? String(current) : '')
  }
  const saveEstimate = async function (id: string) {
    const trimmed = estText.trim()
    if (trimmed !== '') {
      const mins = parseInt(trimmed, 10)
      await setTaskEstimate(id, isNaN(mins) || mins < 0 ? 0 : mins)
    } else {
      await setTaskEstimate(id, 0)
    }
    setEstId(null)
  }

  const focusTask = function (id: string, taskText: string, taskSubjectId?: string) {
    startForTask({ id, text: taskText, subjectId: taskSubjectId })
    setActivePage('pomodoro')
  }

  const doneCount = tasks.filter(function (t) { return t.completed }).length
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0
  const sortedTasks = tasks.slice().sort(function (a, b) {
    return (a.completed ? 1 : 0) - (b.completed ? 1 : 0)
  })
  const allDone = tasks.length > 0 && doneCount === tasks.length

  return (
    <div className='tasks-page'>
      <div className='page-header'>
        <h2><ListChecks size={18} /> 每日必做</h2>
        <span className='tasks-date'>{todayKey()}</span>
      </div>
      <div className='task-input-row'>
        <Input value={text} onChange={setText} placeholder='添加今天的必做事项，回车或点击添加...' className='task-input' autoFocus inputRef={taskInputRef} />
        <select className='select-input task-subject-select' value={subjectId} onChange={function (e) { setSubjectId(e.target.value) }}>
          <option value=''>无科目</option>
          {subjects.map(function (s) {
            return <option key={s.id} value={s.id}>{s.name}</option>
          })}
        </select>
        <Button variant='primary' onClick={handleAdd}>添加</Button>
      </div>
      <div className='task-progress'>
        <div className='task-progress-bar'>
          <div className='task-progress-fill' style={{ width: progress + '%' }} />
        </div>
        <span className='task-progress-text'>已完成 {doneCount}/{tasks.length} · {progress}%</span>
      </div>
      <section className='repeat-section'>
        <h3><Repeat size={15} /> 重复任务模板</h3>
        <div className='task-input-row'>
          <Input value={tplText} onChange={setTplText} placeholder='重复任务内容，如：背单词 50 个' className='task-input' />
          <select className='select-input task-subject-select' value={tplRepeat} onChange={function (e) { setTplRepeat(e.target.value as 'daily' | 'weekly') }}>
            <option value='daily'>每天</option>
            <option value='weekly'>每周</option>
          </select>
          <input type='time' className='time-input' value={tplRemind} onChange={function (e) { setTplRemind(e.target.value) }} title='提醒时间' />
          <Button variant='primary' onClick={addTemplate}>添加模板</Button>
        </div>
        {templates.length === 0 ? (
          <EmptyState compact showMascot={false} title='还没有重复任务模板' hint='每天/每周自动生成，可设提醒时间' color='var(--c-tasks)' />
        ) : (
          <ul className='task-list'>
            {templates.map(function (t) {
              return (
                <li key={t.id} className='task-item'>
                  <span className='task-text'><Repeat size={12} /> {t.text}</span>
                  <span className='subject-chip' style={{ background: '#eef2ff', color: '#4f46e5' }}>{t.repeat === 'daily' ? '每天' : '每周'}</span>
                  {t.remindAt ? <span className='task-remind'>⏰ {t.remindAt}</span> : null}
                  <span className='task-actions'>
                    <Button variant='danger' onClick={function () { deleteTemplate(t.id) }}>删除</Button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {leftovers.length > 0 ? (
        <section className='leftover-section'>
          <h3><ListChecks size={15} /> 昨日遗留（{leftovers.length}）</h3>
          <p className='leftover-desc'>昨天没完成的，别让它们悄悄溜走——今天补上或明确删掉。</p>
          <ul className='task-list'>
            {leftovers.map(function (t) {
              const sub = subjectOf(t.subjectId)
              return (
                <li key={t.id} className='task-item leftover'>
                  <Checkbox checked={false} onChange={function () { finishLeftover(t) }} />
                  <span className='task-text'>{t.text}</span>
                  {sub ? (
                    <span className='subject-chip' style={{ background: sub.color + '22', color: sub.color }}>{sub.name}</span>
                  ) : null}
                  <span className='task-actions'>
                    <Button variant='ghost' onClick={function () { focusTask(t.id, t.text, t.subjectId) }} title='开始番茄钟专注此任务'>▶ 专注</Button>
                    <Button variant='danger' onClick={function () { deleteLeftover(t) }}>删除</Button>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className='today-section'>
        <h3><ListChecks size={15} /> 今日任务{allDone ? <span className='tasks-all-done'>· 全部完成 🎉</span> : null}</h3>
      {loading ? (
        <div className='page-empty'>加载中...</div>
      ) : tasks.length === 0 ? (
        <EmptyState title='今天还没有必做事项' hint='先定一件今天最重要的事，小咕帮你盯着' color='var(--c-tasks)' />
      ) : (
        <ul className='task-list'>
          {sortedTasks.map(function (t) {
            const sub = subjectOf(t.subjectId)
            return (
              <li key={t.id} className={t.completed ? 'task-item done' : 'task-item'}>
                <Checkbox checked={t.completed} onChange={function (checked) { toggleTask(t.id, checked) }} />
                {editingId === t.id ? (
                  <div className='task-edit-row'>
                    <Input value={editText} onChange={setEditText} className='task-edit-input' autoFocus />
                    <Button variant='primary' onClick={function () { saveEdit(t.id) }}>保存</Button>
                    <Button variant='ghost' onClick={function () { setEditingId(null) }}>取消</Button>
                  </div>
                ) : estId === t.id ? (
                  <div className='task-edit-row'>
                    <Input value={estText} onChange={setEstText} className='task-edit-input task-est-input' placeholder='预计需要多少分钟' autoFocus inputMode='numeric' />
                    <Button variant='primary' onClick={function () { saveEstimate(t.id) }}>保存</Button>
                    <Button variant='ghost' onClick={function () { setEstId(null) }}>取消</Button>
                  </div>
                ) : (
                  <>
                    <span className='task-text'>
                      {t.taskType === 'review' ? <span className='task-review-badge' title='艾宾浩斯复习任务'><Repeat size={11} /></span> : null}
                      {t.taskType === 'card-review' ? <span className='task-review-badge' title='复习卡片任务'><Layers size={11} /></span> : null}
                      {t.goalId ? <span className='task-review-badge goal' title='目标拆解任务'><Target size={11} /> 目标</span> : null}
                      {t.text}
                    </span>
                    {t.focusedMinutes ? <span className='task-focus-min' title='累计专注'>🍅 {t.focusedMinutes} 分</span> : null}
                    {t.estimateMinutes ? <span className='task-est-min' title='预计时长'>预计 {t.estimateMinutes} 分</span> : null}
                    {sub ? (
                      <span className='subject-chip' style={{ background: sub.color + '22', color: sub.color }}>{sub.name}</span>
                    ) : null}
                    <span className='task-actions'>
                      <Button variant='ghost' onClick={function () { focusTask(t.id, t.text, t.subjectId) }} title='开始番茄钟专注此任务'>▶ 专注</Button>
                      <Button variant='ghost' onClick={function () { startEstimate(t.id, t.estimateMinutes) }} title='设置预计时长'>⏱ 预计</Button>
                      <Button variant='ghost' onClick={function () { startEdit(t.id, t.text) }}>编辑</Button>
                      <Button variant='danger' onClick={function () { deleteTask(t.id) }}>删除</Button>
                    </span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      </section>
    </div>
  )
}




