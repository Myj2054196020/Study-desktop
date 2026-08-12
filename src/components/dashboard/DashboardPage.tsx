import { useEffect, useState } from 'react'
import { CalendarDays, Flame, Layers, Lightbulb, ListChecks, Moon, Sparkles, Target, Timer } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { useApp } from '../../stores/AppContext'
import { createDb } from '../../lib/db'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Checkbox } from '../ui/Checkbox'
import { Modal } from '../ui/Modal'
import { formatDate, todayKey, uid } from '../../lib/utils'
import type { DailyTask, Goal, Lesson, PomodoroRecord, Reflection, ReviewCard, StudyStats, Subject } from '../../types'

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function clock(m: number): string {
  const pad = function (n: number) { return n < 10 ? '0' + String(n) : String(n) }
  return pad(Math.floor(m / 60)) + ':' + pad(m % 60)
}

export default function DashboardPage() {
  const { dataVersion, setActivePage, bumpDataVersion } = useApp()
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [stats, setStats] = useState<StudyStats | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [reflections, setReflections] = useState<Reflection[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [pomodoros, setPomodoros] = useState<PomodoroRecord[]>([])
  const [goalTitle, setGoalTitle] = useState('')
  const [goalSubject, setGoalSubject] = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [allGoalTasks, setAllGoalTasks] = useState<DailyTask[]>([])
  const [splitGoal, setSplitGoal] = useState<Goal | null>(null)
  const [splitDays, setSplitDays] = useState('')
  const [splitText, setSplitText] = useState('')
  const [msg, setMsg] = useState('')
  const [ritualDismissed, setRitualDismissed] = useState(false)

  const load = function () {
    createDb().getDailyTasks().then(function (list) { setTasks(list) }).catch(function () {})
    createDb().getAllDailyTasks().then(function (list) { setAllGoalTasks(list) }).catch(function () {})
    createDb().getLessons().then(function (list) { setLessons(list) }).catch(function () {})
    createDb().getDueCards(1).then(function (list) { setDueCount(list.length) }).catch(function () {})
    createDb().getStats(7).then(function (s) { setStats(s) }).catch(function () {})
    createDb().getGoals().then(function (list) { setGoals(list) }).catch(function () {})
    createDb().getReflections().then(function (list) { setReflections(list.slice(0, 3)) }).catch(function () {})
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
    createDb().getPomodoroHistory().then(function (list) { setPomodoros(list) }).catch(function () {})
  }

  useEffect(function () {
    load()
  }, [dataVersion])

  useEffect(function () {
    // 每日仪式卡：当天看过一次就不再打扰
    try {
      if (localStorage.getItem('ritual-seen-' + todayKey())) {
        setRitualDismissed(true)
      }
    } catch (err) {
      // ignore
    }
  }, [])

  const showMsg = function (text: string) {
    setMsg(text)
    setTimeout(function () { setMsg('') }, 2200)
  }

  const dismissRitual = function () {
    setRitualDismissed(true)
    try { localStorage.setItem('ritual-seen-' + todayKey(), '1') } catch (err) { /* ignore */ }
  }

  const today = new Date()
  const todayDay = today.getDay() === 0 ? 7 : today.getDay()
  const greetHour = today.getHours()
  const greet = greetHour < 6 ? '夜深了' : greetHour < 12 ? '早上好' : greetHour < 18 ? '下午好' : '晚上好'
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const dateStr = (today.getMonth() + 1) + '月' + today.getDate() + '日 ' + weekdayNames[today.getDay()]
  const todayLessons = lessons
    .filter(function (l) { return l.dayOfWeek === todayDay && l.enabled })
    .sort(function (a, b) { return a.startMinute - b.startMinute })
  const openTasks = tasks.filter(function (t) { return !t.completed })
  const doneCount = tasks.length - openTasks.length
  const nowMinute = today.getHours() * 60 + today.getMinutes()
  const nextLesson = todayLessons.find(function (l) { return l.startMinute > nowMinute })
  const suggest = (function () {
    if (nextLesson) {
      const mins = Math.max(1, Math.round((nextLesson.startMinute - nowMinute) / 60))
      return '距「' + nextLesson.name + '」还有约 ' + mins + ' 分钟，适合来一组复习卡片'
    }
    if (dueCount > 0) return '今天有 ' + dueCount + ' 张卡片到期，趁现在复习一下吧'
    if (openTasks.length > 0) return '还有 ' + openTasks.length + ' 件待办，先从最重要的一件开始'
    if (stats && stats.streakDays >= 30) return '灯已连亮 30 晚，深夜书房的常客了，小咕敬佩'
    if (stats && stats.streakDays >= 7) return '灯已连亮 7 晚，习惯正在养成，继续'
    if (stats && stats.streakDays > 0) return '灯已亮 ' + stats.streakDays + ' 晚，今天也别灭'
    return '自由安排的时间，小咕建议先来一个 25 分钟专注'
  })()
  const todayMinutes = stats ? (stats.heatmap.find(function (d) { return d.date === todayKey() }) || { minutes: 0 }).minutes : 0
  const [summaryText, setSummaryText] = useState('')
  const [summaryBusy, setSummaryBusy] = useState(false)
  const [summaryDone, setSummaryDone] = useState(false)
  const saveDailySummary = async function () {
    setSummaryBusy(true)
    const now = new Date()
    const auto = '今日专注 ' + todayMinutes + ' 分钟 · 必做完成 ' + doneCount + '/' + tasks.length + ' · 到期卡片 ' + dueCount + ' 张\n'
    const note = summaryText.trim()
    await createDb().saveReflection({
      id: uid('rf'),
      title: '每日小结 · ' + (now.getMonth() + 1) + '/' + now.getDate(),
      content: (auto + (note ? note : '')).trim(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    setSummaryBusy(false)
    setSummaryText('')
    setSummaryDone(true)
    setTimeout(function () { setSummaryDone(false) }, 2500)
  }

  const subjectName = function (id?: string): string {
    const s = subjects.find(function (x) { return x.id === id })
    return s ? s.name : ''
  }

  const addGoal = async function () {
    const title = goalTitle.trim()
    if (!title) return
    const now = new Date().toISOString()
    const goal: Goal = {
      id: uid('goal'),
      title,
      subjectId: goalSubject || undefined,
      deadline: goalDeadline || undefined,
      done: false,
      createdAt: now,
      updatedAt: now,
    }
    await createDb().saveGoal(goal)
    setGoalTitle('')
    setGoalDeadline('')
    load()
    showMsg('已添加目标 ✓')
  }

  const toggleGoal = async function (g: Goal) {
    await createDb().saveGoal(Object.assign({}, g, { done: !g.done, updatedAt: new Date().toISOString() }))
    load()
    showMsg(g.done ? '已标记为未完成' : '目标已完成 🎉')
  }

  const addGoalTask = async function (g: Goal) {
    await createDb().saveDailyTask({
      id: uid('task'),
      date: todayKey(),
      text: '推进目标：' + g.title,
      completed: false,
      createdAt: new Date().toISOString(),
      subjectId: g.subjectId,
      goalId: g.id,
    })
    load()
    showMsg('已加入今日必做 ✓')
  }

  const dateKeyOf = function (d: Date): string {
    const pad = function (n: number) { return n < 10 ? '0' + String(n) : String(n) }
    return String(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  const openSplit = function (g: Goal) {
    const left = daysLeft(g.deadline)
    setSplitGoal(g)
    setSplitDays(String(Math.min(left && left > 0 ? left : 7, 30)))
    setSplitText('推进目标：' + g.title)
  }

  const splitGoalSubmit = async function () {
    if (!splitGoal) return
    const days = Math.min(30, Math.max(1, Math.round(parseInt(splitDays, 10) || 1)))
    const text = splitText.trim() || ('推进目标：' + splitGoal.title)
    const base = new Date()
    for (let i = 0; i < days; i += 1) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
      await createDb().saveDailyTask({
        id: uid('task'),
        date: dateKeyOf(d),
        text: i === 0 ? text : text + '（第 ' + (i + 1) + ' 天）',
        completed: false,
        createdAt: new Date().toISOString(),
        subjectId: splitGoal.subjectId,
        goalId: splitGoal.id,
      })
    }
    setSplitGoal(null)
    load()
    showMsg('已生成 ' + days + ' 天的推进计划 ✓ 每天会自动出现在「每日必做」')
  }

  const goalProgress = function (gid: string) {
    const mine = allGoalTasks.filter(function (t) { return t.goalId === gid })
    const done = mine.filter(function (t) { return t.completed }).length
    return { done, total: mine.length }
  }

  const deleteGoal = async function (id: string) {
    const ok = window.confirm('确定删除该目标吗？')
    if (ok) {
      await createDb().deleteGoal(id)
      load()
      showMsg('目标已删除')
    }
  }

  const toggleTask = async function (id: string, completed: boolean) {
    await createDb().toggleDailyTask(id, completed)
    load()
    // 通知全局数据版本变化，任务页（TaskContext）同步刷新
    bumpDataVersion()
  }

  const daysLeft = function (deadline?: string): number | null {
    if (!deadline) return null
    const end = new Date(deadline + 'T23:59:59')
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000))
  }

  const activeGoals = goals.filter(function (g) { return !g.done })

  const weekMs = 7 * 86400000
  const nowTs = Date.now()
  const thisWeek = pomodoros.filter(function (r) {
    return r.completed && nowTs - new Date(r.startTime).getTime() < weekMs
  })
  const lastWeek = pomodoros.filter(function (r) {
    return r.completed && nowTs - new Date(r.startTime).getTime() >= weekMs && nowTs - new Date(r.startTime).getTime() < 2 * weekMs
  })
  const sumMin = function (list: PomodoroRecord[]) {
    return list.reduce(function (s, r) { return s + (r.durationMinutes || 0) }, 0)
  }
  const weekDelta = sumMin(thisWeek) - sumMin(lastWeek)
  const miniHeat = (stats ? stats.heatmap.slice(-84) : []).map(function (d) {
    const lvl = d.minutes <= 0 ? 0 : d.minutes < 30 ? 1 : d.minutes < 60 ? 2 : d.minutes < 120 ? 3 : 4
    return { date: d.date, lvl }
  })
  const HEAT_COLORS = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)']

  const nowHour = new Date().getHours()
  const isEvening = nowHour >= 22 || nowHour < 6

  return (
    <div className='dashboard-page'>
      <div className='dashboard-hero'>
        <div className='dash-hero-main'>
          <h2>{greet}，小咕陪你学习</h2>
          <p className='dashboard-date'>今天 {dateStr}</p>
          <div className='dash-hero-actions'>
            <Button variant='primary' onClick={function () { setActivePage('pomodoro') }}><Timer size={13} /> 开始专注</Button>
            <Button variant='default' onClick={function () { setActivePage('tasks') }}><ListChecks size={13} /> 记任务</Button>
          </div>
          <div className='dash-hero-suggest'><Sparkles size={13} /> {suggest}</div>
        </div>
        <div className='dashboard-hero-stats'>
          <div className='hero-stat'><span className='hero-stat-value'>{openTasks.length}</span><span>待办任务</span></div>
          <div className='hero-stat'><span className='hero-stat-value'>{todayLessons.length}</span><span>今日课程</span></div>
          <div className='hero-stat'><span className='hero-stat-value'>{dueCount}</span><span>到期卡片</span></div>
          <div className='hero-stat'><span className='hero-stat-value'>{stats ? stats.streakDays : 0}</span><span>连续打卡</span></div>
        </div>
      </div>

      {!ritualDismissed && (openTasks.length > 0 || dueCount > 0) ? (
        <div className='dash-ritual'>
          <div className='dash-ritual-head'>
            <span className='dash-ritual-title'><Sparkles size={13} /> 今日三件事</span>
            <button className='dash-ritual-close' title='今天不再提醒' onClick={dismissRitual}>×</button>
          </div>
          <div className='dash-ritual-items'>
            {openTasks.length > 0 ? (
              <div className='dash-ritual-item'>
                <span className='dash-ritual-num'>1</span>
                <span className='dash-ritual-text'>还有 <b>{openTasks.length}</b> 件必做没完成</span>
                <Button variant='ghost' onClick={function () { setActivePage('tasks') }}>去完成</Button>
              </div>
            ) : null}
            {dueCount > 0 ? (
              <div className='dash-ritual-item'>
                <span className='dash-ritual-num'>2</span>
                <span className='dash-ritual-text'><b>{dueCount}</b> 张卡片等着复习</span>
                <Button variant='ghost' onClick={function () { setActivePage('cards') }}>去复习</Button>
              </div>
            ) : null}
            <div className='dash-ritual-item'>
              <span className='dash-ritual-num'>{openTasks.length > 0 && dueCount > 0 ? 3 : 2}</span>
              <span className='dash-ritual-text'>来一组 25 分钟专注，把状态拉满</span>
              <Button variant='ghost' onClick={function () { setActivePage('pomodoro') }}>开始专注</Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className='dashboard-grid'>
        <section className='dash-card wide'>
          <div className='dash-card-head'>
            <h3><ListChecks size={15} /> 今日必做</h3>
            <Button variant='ghost' onClick={function () { setActivePage('tasks') }}>全部 →</Button>
          </div>
          {tasks.length === 0 ? (
            <EmptyState compact showMascot={false} title='今天还没有必做事项' hint='定一件今天最重要的事，小咕帮你盯着' color='var(--c-tasks)' />
          ) : (
            <ul className='dash-task-list'>
              {openTasks.slice(0, 8).map(function (t) {
                return (
                  <li key={t.id} className='dash-task'>
                    <Checkbox checked={t.completed} onChange={function (c) { toggleTask(t.id, c) }} />
                    <span className='dash-task-text'>{t.text}</span>
                    <span className='dash-task-count'>已完成 {doneCount}/{tasks.length}</span>
                  </li>
                )
              })}
              {openTasks.length > 8 ? <li className='dash-task-more'>还有 {openTasks.length - 8} 项，点「全部」查看</li> : null}
            </ul>
          )}
        </section>

        <section className='dash-card'>
          <div className='dash-card-head'>
            <h3><CalendarDays size={15} /> 今日课表</h3>
            <Button variant='ghost' onClick={function () { setActivePage('timetable') }}>管理 →</Button>
          </div>
          {todayLessons.length === 0 ? (
            <EmptyState compact showMascot={false} title='今天没有课' hint='自由安排，也可以先来一组复习卡片' color='var(--c-timetable)' />
          ) : (
            <ul className='dash-lesson-list'>
              {todayLessons.map(function (l) {
                return (
                  <li key={l.id} className='dash-lesson'>
                    <span className='dash-lesson-time'>{clock(l.startMinute)}</span>
                    <span className='dash-lesson-name' style={{ borderColor: l.color }}>{l.name}</span>
                    {l.location ? <span className='dash-lesson-loc'>{l.location}</span> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className='dash-card'>
          <div className='dash-card-head'>
            <h3><Layers size={15} /> 复习卡片</h3>
            <Button variant='ghost' onClick={function () { setActivePage('cards') }}>去复习 →</Button>
          </div>
          {dueCount === 0 ? (
            <EmptyState compact showMascot={false} title='暂无到期卡片' hint='到期卡片都复习完啦，今晚可以早点休息' color='var(--c-cards)' />
          ) : (
            <div className='dash-due'>今天有 <strong>{dueCount}</strong> 张卡片等待复习，去巩固一下吧！</div>
          )}
        </section>

        <section className='dash-card'>
          <div className='dash-card-head'>
            <h3><Target size={15} /> 目标</h3>
            {msg ? <span className='save-hint'>{msg}</span> : null}
          </div>
          <div className='goal-add-row'>
            <Input value={goalTitle} onChange={setGoalTitle} placeholder='目标，如：期末数学 90 分' className='goal-title-input' />
            <select className='select-input goal-subject-select' value={goalSubject} onChange={function (e) { setGoalSubject(e.target.value) }}>
              <option value=''>科目</option>
              {subjects.map(function (s) { return <option key={s.id} value={s.id}>{s.name}</option> })}
            </select>
            <Input value={goalDeadline} onChange={setGoalDeadline} type='date' className='goal-date-input' />
            <Button variant='primary' onClick={addGoal} disabled={!goalTitle.trim()}>添加</Button>
          </div>
          {activeGoals.length === 0 ? (
            <EmptyState compact showMascot={false} title='还没有目标' hint='立一个小目标，台灯会为你长明' color='var(--c-dashboard)' />
          ) : (
            <ul className='goal-list'>
              {activeGoals.map(function (g) {
                const left = daysLeft(g.deadline)
                const prog = goalProgress(g.id)
                return (
                  <li key={g.id} className='goal-item'>
                    <Checkbox checked={g.done} onChange={function () { toggleGoal(g) }} />
                    <span className='goal-title'>{g.title}</span>
                    {subjectName(g.subjectId) ? <span className='subject-chip' style={{ background: '#eef2ff', color: '#4f46e5' }}>{subjectName(g.subjectId)}</span> : null}
                    {left !== null ? <span className='goal-deadline'>剩 {left} 天</span> : null}
                    {prog.total > 0 ? (
                      <span className='goal-progress' title={'已推进 ' + prog.done + ' / ' + prog.total + ' 天'}>
                        <span className='goal-progress-bar'><span className='goal-progress-fill' style={{ width: Math.round((prog.done / prog.total) * 100) + '%' }} /></span>
                        <em>{prog.done}/{prog.total} 天</em>
                      </span>
                    ) : null}
                    <span className='goal-actions'>
                      <Button variant='ghost' onClick={function () { addGoalTask(g) }}>今日必做</Button>
                      <Button variant='default' onClick={function () { openSplit(g) }} title='把目标拆成未来 N 天的每日任务'>拆解</Button>
                      <Button variant='danger' onClick={function () { deleteGoal(g.id) }}>删除</Button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className='dash-card dash-overview-card wide'>
          <div className='dash-card-head'>
            <h3><Flame size={15} /> 打卡与周对比</h3>
            <Button variant='ghost' onClick={function () { setActivePage('stats') }}>详细 →</Button>
          </div>
          <div className='dash-heatmap'>
            {miniHeat.map(function (d) {
              return <span key={d.date} className='dash-heat-cell' style={{ background: HEAT_COLORS[d.lvl] }} title={d.date + ' · 专注 ' + (stats ? stats.heatmap.find(function (x) { return x.date === d.date })?.minutes || 0 : 0) + ' 分钟'} />
            })}
          </div>
          <div className='week-compare-row dash-week'>
            <div className='week-compare-block'>
              <div className='week-compare-label'>本周专注</div>
              <div className='week-compare-value'>{sumMin(thisWeek)} 分钟</div>
              <div className='week-compare-sub'><Timer size={12} /> {thisWeek.length} 个</div>
            </div>
            <div className='week-compare-block'>
              <div className='week-compare-label'>上周专注</div>
              <div className='week-compare-value'>{sumMin(lastWeek)} 分钟</div>
              <div className='week-compare-sub'>{weekDelta >= 0 ? '+' : ''}{weekDelta} 分钟</div>
            </div>
          </div>
        </section>

        <section className='dash-card'>
          <div className='dash-card-head'>
            <h3><Lightbulb size={15} /> 最近心得</h3>
            <Button variant='ghost' onClick={function () { setActivePage('reflections') }}>全部 →</Button>
          </div>
          {reflections.length === 0 ? (
            <EmptyState compact showMascot={false} title='还没有学习心得' hint='记下今天想明白的事，它们会连成你的知识脉络' color='var(--c-reflections)' />
          ) : (
            <ul className='dash-reflection-list'>
              {reflections.map(function (r) {
                return (
                  <li key={r.id} className='dash-reflection'>
                    <div className='dash-reflection-title'>{r.title}</div>
                    <div className='dash-reflection-date'>{formatDate(r.updatedAt)}</div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className={'dash-card wide dash-summary-card' + (isEvening ? ' evening' : '')}>
          <div className='dash-card-head'>
            <h3><Moon size={15} /> 今日小结</h3>
            {summaryDone ? <span className='save-hint'>已存入学习心得 ✓</span> : null}
          </div>
          <p className='dash-summary-stats'>
            今日专注 <b>{todayMinutes}</b> 分钟 · 必做完成 <b>{doneCount}/{tasks.length}</b> · 到期卡片 <b>{dueCount}</b> 张
          </p>
          {isEvening ? (
            <p className='dash-summary-evening'>🌙 夜深了，今天学到这，写一句收尾再休息？</p>
          ) : null}
          <textarea value={summaryText} onChange={function (e) { setSummaryText(e.target.value) }} placeholder='写一句今天的收获、卡住的地方、明天要改进的…（可留空，自动带上今日数据）' className='dash-summary-input' />
          <div className='dash-summary-actions'>
            <Button variant='primary' onClick={saveDailySummary} disabled={summaryBusy}>{summaryBusy ? '保存中...' : '收尾 · 存入学习心得'}</Button>
          </div>
        </section>
      </div>

      {splitGoal ? (
        <Modal onClose={function () { setSplitGoal(null) }} className='goal-split-modal'>
          <h3>拆解目标</h3>
          <p className='goal-split-desc'>把「{splitGoal.title}」拆成未来 N 天每天一条必做，每天自动出现在「每日必做」，完成即可推进目标。</p>
          <label>拆几天（1 - 30）</label>
          <Input value={splitDays} onChange={setSplitDays} type='number' className='goal-split-days' />
          <label>每天任务文案</label>
          <Input value={splitText} onChange={setSplitText} className='goal-split-text' placeholder='推进目标：…' />
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () { setSplitGoal(null) }}>取消</Button>
            <Button variant='primary' onClick={splitGoalSubmit} disabled={!splitDays.trim()}>生成计划</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}


