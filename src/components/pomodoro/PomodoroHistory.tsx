import { useEffect, useState } from 'react'
import { EmptyState } from '../ui/EmptyState'
import { createDb } from '../../lib/db'
import { useApp } from '../../stores/AppContext'
import type { PomodoroRecord } from '../../types'
import { formatDate } from '../../lib/utils'

export default function PomodoroHistory() {
  const { dataVersion } = useApp()
  const [records, setRecords] = useState<PomodoroRecord[]>([])

  useEffect(function () {
    let alive = true
    createDb().getPomodoroHistory().then(function (list) {
      if (!alive) return
      setRecords(list.slice(0, 10))
    }).catch(function () {})
    return function () { alive = false }
  }, [dataVersion])

  return (
    <div className='pomodoro-card'>
      <h3>📜 专注历史（最近 10 条）</h3>
      {records.length === 0 ? (
        <EmptyState title='还没有专注记录' hint='点亮第一盏台灯，专注 25 分钟' color='var(--c-pomodoro)' />
      ) : (
        <ul className='history-list'>
          {records.map(function (r) {
            return (
              <li key={r.id} className={r.completed ? 'history-item' : 'history-item missed'}>
                <span className='history-date'>{formatDate(r.startTime)}</span>
                <span className='history-duration'>{r.durationMinutes} 分钟</span>
                <span className='history-status'>{r.completed ? '完成' : '跳过'}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
