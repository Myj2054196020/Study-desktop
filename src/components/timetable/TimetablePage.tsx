import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { createDb } from '../../lib/db'
import { useApp } from '../../stores/AppContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { uid } from '../../lib/utils'
import type { AppSettings, Lesson, PeriodTemplate, Subject } from '../../types'

const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const DAY_START = 7 * 60
const DAY_END = 23 * 60
const PX_PER_MIN = 0.9

const LESSON_COLORS = ['#2B3A67', '#8B5CF6', '#EC4899', '#E8A33D', '#3FA87C', '#06B6D4', '#E2574C']

function minutesToClock(m: number): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  const pad = function (n: number) { return n < 10 ? '0' + String(n) : String(n) }
  return pad(h) + ':' + pad(mm)
}

function clockToMinutes(t: string): number {
  const parts = t.split(':')
  const h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)
}

interface EditState {
  lesson?: Lesson
  dayOfWeek: number
  startMinute: number
  endMinute: number
}

export default function TimetablePage() {
  const { dataVersion } = useApp()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<EditState>({ dayOfWeek: 1, startMinute: 8 * 60, endMinute: 9 * 60 })
  const [name, setName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [location, setLocation] = useState('')
  const [color, setColor] = useState(LESSON_COLORS[0])
  const [subjectId, setSubjectId] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [showPeriods, setShowPeriods] = useState(false)
  const [periodName, setPeriodName] = useState('')
  const [periodStart, setPeriodStart] = useState('08:00')
  const [periodEnd, setPeriodEnd] = useState('08:45')

  const load = function () {
    createDb().getLessons().then(function (list) { setLessons(list) }).catch(function () {})
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
    createDb().getSettings().then(function (s) { setSettings(s) }).catch(function () {})
  }

  const savePeriods = async function (periods: PeriodTemplate[]) {
    if (!settings) return
    const next = Object.assign({}, settings, { periods })
    setSettings(next)
    await createDb().saveSettings(next)
  }

  const addPeriod = async function () {
    if (!settings || !periodName.trim()) return
    const period: PeriodTemplate = {
      id: 'p-' + Date.now().toString(36),
      name: periodName.trim(),
      startMinute: clockToMinutes(periodStart),
      endMinute: clockToMinutes(periodEnd),
    }
    await savePeriods(settings.periods.concat([period]))
    setPeriodName('')
  }

  const deletePeriod = async function (id: string) {
    if (!settings) return
    await savePeriods(settings.periods.filter(function (p) { return p.id !== id }))
  }

  const applyPeriod = function (p: PeriodTemplate) {
    setEdit(Object.assign({}, edit, { startMinute: p.startMinute, endMinute: p.endMinute }))
  }

  useEffect(function () {
    load()
  }, [dataVersion])

  const today = new Date()
  const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1

  const openAdd = function (dayIndex: number, startMinute: number) {
    setEdit({ dayOfWeek: dayIndex + 1, startMinute, endMinute: Math.min(startMinute + 60, DAY_END) })
    setName('')
    setTeacher('')
    setLocation('')
    setColor(LESSON_COLORS[lessons.length % LESSON_COLORS.length])
    setSubjectId('')
    setEnabled(true)
    setOpen(true)
  }

  const openEdit = function (lesson: Lesson) {
    setEdit({ lesson, dayOfWeek: lesson.dayOfWeek, startMinute: lesson.startMinute, endMinute: lesson.endMinute })
    setName(lesson.name)
    setTeacher(lesson.teacher || '')
    setLocation(lesson.location || '')
    setColor(lesson.color)
    setSubjectId(lesson.subjectId || '')
    setEnabled(lesson.enabled)
    setOpen(true)
  }

  const handleSave = async function () {
    if (!name.trim() || edit.endMinute <= edit.startMinute) {
      window.alert('请填写课程名称，并确保结束时间晚于开始时间')
      return
    }
    const lesson: Lesson = {
      id: edit.lesson ? edit.lesson.id : uid('lesson'),
      name: name.trim(),
      teacher: teacher.trim() || undefined,
      location: location.trim() || undefined,
      color,
      dayOfWeek: edit.dayOfWeek,
      startMinute: edit.startMinute,
      endMinute: edit.endMinute,
      subjectId: subjectId || undefined,
      enabled,
    }
    await createDb().saveLesson(lesson)
    setOpen(false)
    load()
  }

  const handleDelete = async function (id: string) {
    const ok = window.confirm('确定删除这节课吗？')
    if (ok) {
      await createDb().deleteLesson(id)
      setOpen(false)
      load()
    }
  }

  const gridHeight = (DAY_END - DAY_START) * PX_PER_MIN

  return (
    <div className='timetable-page'>
      <div className='page-header'>
        <h2><CalendarDays size={18} /> 课表</h2>
        <div className='timetable-header-actions'>
          <span className='timetable-hint'>点击空格添加课程 · 到点自动提醒</span>
          <Button variant='ghost' onClick={function () { setShowPeriods(true) }}>⏰ 节次模板</Button>
        </div>
      </div>
      <div className='timetable-wrap'>
        <div className='timetable-head'>
          <div className='timetable-timehead' />
          {DAYS.map(function (d, i) {
            return (
              <div key={d} className={i === todayIndex ? 'timetable-dayhead today' : 'timetable-dayhead'}>
                {d}
              </div>
            )
          })}
        </div>
        <div className='timetable-scroll'>
          <div className='timetable-body' style={{ height: gridHeight }}>
            <div className='timetable-times'>
              {Array.from({ length: DAY_END - DAY_START }, function (_, i) {
                const minute = DAY_START + i
                if (minute % 60 === 0) {
                  return (
                    <div key={minute} className='timetable-time' style={{ top: i * PX_PER_MIN - 6 }}>
                      {minutesToClock(minute)}
                    </div>
                  )
                }
                return null
              })}
            </div>
            {DAYS.map(function (d, i) {
              const dayLessons = lessons
                .filter(function (l) { return l.dayOfWeek === i + 1 })
                .sort(function (a, b) { return a.startMinute - b.startMinute })
              return (
                <div
                  key={d}
                  className={i === todayIndex ? 'timetable-col today' : 'timetable-col'}
                  onClick={function (e) {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                    const y = e.clientY - rect.top
                    const minute = DAY_START + Math.round(y / PX_PER_MIN / 30) * 30
                    openAdd(i, Math.min(Math.max(minute, DAY_START), DAY_END - 30))
                  }}
                >
                  {dayLessons.map(function (l) {
                    return (
                      <div
                        key={l.id}
                        className={'timetable-lesson' + (l.enabled ? '' : ' disabled')}
                        style={{
                          top: (l.startMinute - DAY_START) * PX_PER_MIN,
                          height: (l.endMinute - l.startMinute) * PX_PER_MIN,
                          background: l.color,
                        }}
                        onClick={function (e) {
                          e.stopPropagation()
                          openEdit(l)
                        }}
                        title={l.name + (l.location ? ' @ ' + l.location : '')}
                      >
                        <div className='timetable-lesson-name'>{l.name}</div>
                        <div className='timetable-lesson-time'>{minutesToClock(l.startMinute)} - {minutesToClock(l.endMinute)}</div>
                        {l.location ? <div className='timetable-lesson-loc'>{l.location}</div> : null}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showPeriods ? (
        <Modal onClose={function () { setShowPeriods(false) }} className='period-modal'>
          <h3>⏰ 节次模板</h3>
          <p className='setting-desc'>定义常用节次（如第1节 08:00-08:45），添加课程时一键套用起止时间。</p>
          <div className='subject-manage-row'>
            <Input value={periodName} onChange={setPeriodName} placeholder='节次名，如：第1节' className='subject-name-input' />
            <input type='time' className='time-input' value={periodStart} onChange={function (e) { setPeriodStart(e.target.value) }} />
            <span className='period-sep'>至</span>
            <input type='time' className='time-input' value={periodEnd} onChange={function (e) { setPeriodEnd(e.target.value) }} />
            <Button variant='primary' onClick={addPeriod}>添加</Button>
          </div>
          <ul className='period-list'>
            {(settings ? settings.periods : []).map(function (p) {
              return (
                <li key={p.id} className='period-item'>
                  <span className='period-name'>{p.name}</span>
                  <span className='period-time'>{minutesToClock(p.startMinute)} - {minutesToClock(p.endMinute)}</span>
                  <Button variant='danger' onClick={function () { deletePeriod(p.id) }}>删除</Button>
                </li>
              )
            })}
          </ul>
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () { setShowPeriods(false) }}>完成</Button>
          </div>
        </Modal>
      ) : null}

      {open ? (
        <Modal onClose={function () { setOpen(false) }} className='lesson-modal'>
          <h3>{edit.lesson ? '编辑课程' : '添加课程'}</h3>
          <label>课程名称</label>
          <Input value={name} onChange={setName} placeholder='如：高等数学（上）' autoFocus />
          {settings && settings.periods.length > 0 ? (
            <div>
              <label>套用节次</label>
              <select className='select-input' defaultValue='' onChange={function (e) {
                const p = settings.periods.find(function (x) { return x.id === e.target.value })
                if (p) applyPeriod(p)
              }}>
                <option value=''>选择节次...</option>
                {settings.periods.map(function (p) {
                  return <option key={p.id} value={p.id}>{p.name}（{minutesToClock(p.startMinute)}-{minutesToClock(p.endMinute)}）</option>
                })}
              </select>
            </div>
          ) : null}
          <div className='lesson-form-grid'>
            <div>
              <label>星期</label>
              <select className='select-input' value={String(edit.dayOfWeek)} onChange={function (e) {
                setEdit(Object.assign({}, edit, { dayOfWeek: parseInt(e.target.value, 10) }))
              }}>
                {DAYS.map(function (d, i) {
                  return <option key={String(i + 1)} value={String(i + 1)}>{d}</option>
                })}
              </select>
            </div>
            <div>
              <label>开始时间</label>
              <input
                type='time'
                className='time-input'
                value={minutesToClock(edit.startMinute)}
                onChange={function (e) {
                  const m = clockToMinutes(e.target.value)
                  setEdit(Object.assign({}, edit, { startMinute: m, endMinute: Math.max(m + 30, edit.endMinute) }))
                }}
              />
            </div>
            <div>
              <label>结束时间</label>
              <input
                type='time'
                className='time-input'
                value={minutesToClock(edit.endMinute)}
                onChange={function (e) {
                  const m = clockToMinutes(e.target.value)
                  setEdit(Object.assign({}, edit, { endMinute: m }))
                }}
              />
            </div>
          </div>
          <label>教师</label>
          <Input value={teacher} onChange={setTeacher} placeholder='可选' />
          <label>地点</label>
          <Input value={location} onChange={setLocation} placeholder='可选，如：教学楼 301' />
          <div className='lesson-form-grid'>
            <div>
              <label>科目</label>
              <select className='select-input' value={subjectId} onChange={function (e) { setSubjectId(e.target.value) }}>
                <option value=''>未分类</option>
                {subjects.map(function (s) {
                  return <option key={s.id} value={s.id}>{s.name}</option>
                })}
              </select>
            </div>
            <div>
              <label>颜色</label>
              <input type='color' className='color-input' value={color} onChange={function (e) { setColor(e.target.value) }} />
            </div>
          </div>
          <label className='checkbox'>
            <input type='checkbox' checked={enabled} onChange={function (e) { setEnabled(e.target.checked) }} />
            <span className='checkbox-box'>{enabled ? '✓' : ''}</span>
            <span className='checkbox-label'>启用上课提醒</span>
          </label>
          <div className='reflection-modal-actions'>
            {edit.lesson ? <Button variant='danger' onClick={function () { handleDelete(edit.lesson!.id) }}>删除</Button> : null}
            <span className='modal-spacer' />
            <Button variant='default' onClick={function () { setOpen(false) }}>取消</Button>
            <Button variant='primary' onClick={handleSave}>保存</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}



