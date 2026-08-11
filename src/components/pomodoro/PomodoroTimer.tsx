import { useEffect, useState } from 'react'
import { Target, Timer } from 'lucide-react'
import { usePomodoro } from '../../stores/PomodoroContext'
import { createDb } from '../../lib/db'
import { Button } from '../ui/Button'
import { classNames, uid } from '../../lib/utils'

const PRESETS = [
  { minutes: 25, label: '25 分' },
  { minutes: 15, label: '15 分' },
  { minutes: 45, label: '45 分' },
]

export default function PomodoroTimer() {
  const { isRunning, timeLeft, totalSession, sessionCount, dailyGoal, phase, currentTask, start, pause, reset, skip, setDuration, clearTask, lastFinish, clearLastFinish } = usePomodoro()
  const [reflectText, setReflectText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(function () {
    document.body.classList.toggle('lamp-on', isRunning)
    return function () { document.body.classList.remove('lamp-on') }
  }, [isRunning])

  const fmt = function (s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    const pad = function (n: number) { return n < 10 ? '0' + String(n) : String(n) }
    return pad(m) + ':' + pad(sec)
  }

  const radius = 90
  const circ = 2 * Math.PI * radius
  const progress = totalSession > 0 ? (totalSession - timeLeft) / totalSession : 0
  const dashOffset = circ * (1 - progress)

  const saveReflect = async function () {
    if (!lastFinish) return
    const text = reflectText.trim()
    setSaving(true)
    if (text) {
      try {
        await createDb().saveReflection({
          id: uid('rf'),
          title: '番茄复盘 · ' + new Date(lastFinish.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          content: text,
          subjectId: lastFinish.subjectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      } catch (err) {
        console.log('save reflection failed: ' + String(err))
      }
    }
    setSaving(false)
    setReflectText('')
    clearLastFinish()
  }
  const finishTask = async function () {
    if (!lastFinish || !lastFinish.taskId) return
    try {
      await createDb().toggleDailyTask(lastFinish.taskId, true)
    } catch (err) {
      console.log('finish task failed: ' + String(err))
    }
    setReflectText('')
    clearLastFinish()
  }

  return (
    <>
      {lastFinish ? (
        <div className='pomodoro-reflect'>
          <div className='reflect-title'>🍅 这一轮专注结束了</div>
          {lastFinish.taskText ? <div className='reflect-task'><Target size={12} /> 专注任务：{lastFinish.taskText}</div> : null}
          <textarea value={reflectText} onChange={function (e) { setReflectText(e.target.value) }} placeholder='刚学到了什么？记一句，写进学习心得，慢慢攒成你的知识脉络…' className='reflect-input' />
          <div className='reflect-actions'>
            <Button variant='primary' onClick={saveReflect} disabled={saving}>{saving ? '保存中...' : '记入学习心得'}</Button>
            {lastFinish.taskId ? <Button variant='default' onClick={finishTask}>顺手完成任务</Button> : null}
            <Button variant='ghost' onClick={function () { setReflectText(''); clearLastFinish() }}>跳过</Button>
          </div>
        </div>
      ) : null}
      <div className='pomodoro-card'>
      <h3><Timer size={15} /> 番茄钟</h3>
      {currentTask ? (
        <div className='current-task-banner'>
          <span className='current-task-text'><Target size={13} /> 正在专注：{currentTask.text}</span>
          <button className='current-task-clear' onClick={clearTask} title='清除任务绑定'>✕</button>
        </div>
      ) : null}
      <div className='pomodoro-presets'>
        {PRESETS.map(function (p) {
          return (
            <button
              key={String(p.minutes)}
              className={classNames('preset-pill', totalSession === p.minutes * 60 ? 'active' : undefined)}
              onClick={function () { setDuration(p.minutes) }}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <div className='timer-circle-wrap'>
        <svg viewBox='0 0 200 200' className='timer-circle'>
          <circle cx='100' cy='100' r={radius} className='timer-circle-bg' />
          <circle
            cx='100'
            cy='100'
            r={radius}
            className='timer-circle-fg'
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className='timer-text'>
          <div className='timer-time'>{fmt(timeLeft)}</div>
          <div className='timer-state'>{isRunning ? (phase === 'break' ? '休息中 ☕' : (currentTask ? '正在专注任务' : '专注中...')) : '台灯待点亮'}</div>
        </div>
      </div>
      <div className='timer-actions'>
        {isRunning ? (
          <Button variant='primary' onClick={pause}>暂停</Button>
        ) : (
          <Button variant='primary' onClick={start}>点亮台灯</Button>
        )}
        <Button variant='default' onClick={reset}>重置</Button>
        <Button variant='ghost' onClick={skip} disabled={!isRunning}>跳过</Button>
        {window.electronAPI ? (
          <Button variant='ghost' onClick={function () { window.electronAPI!.toggleWidget() }} title='浮动迷你计时器'>📌 浮动</Button>
        ) : null}
      </div>
      <div className='timer-today'>
        <span>今日 <Timer size={13} /> ×{sessionCount} / {dailyGoal}</span>
        <div className='timer-goal-bar'>
          <div className='timer-goal-fill' style={{ width: Math.min(100, Math.round((sessionCount / dailyGoal) * 100)) + '%' }} />
        </div>
      </div>
    </div>
    </>
  )
}







