import { useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, BookOpen, Calendar, CalendarDays, FileQuestion, FileText, Flame, Folder, Layers, PieChart as PieChartIcon, Sparkles, Target, Timer, TrendingUp } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { useApp } from '../../stores/AppContext'
import { useReflections } from '../../stores/ReflectionContext'
import { createDb } from '../../lib/db'
import { buildInsight, buildWeeklyReport, buildWeeklyReportHtml } from '../../lib/report'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import type { Chapter, DailyStat, DailyTask, HeatmapDay, Mistake, PomodoroRecord, QuizRecord, ReviewCard, StudyStats } from '../../types'
import { classNames, formatDuration } from '../../lib/utils'

const RANGES = [
  { value: 7, label: '近 7 天' },
  { value: 30, label: '近 30 天' },
  { value: 0, label: '全部' },
]

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const HEAT_COLORS = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)']

function Heatmap({ data }: { data: HeatmapDay[] }) {
  const cell = 11
  const gap = 3
  const cols = Math.max(1, Math.ceil(data.length / 7))
  const width = cols * (cell + gap)
  const height = 7 * (cell + gap)
  const cells = data.map(function (d, i) {
    const date = new Date(d.date + 'T00:00:00')
    return { date: d.date, minutes: d.minutes, col: Math.floor(i / 7), row: i % 7, dateObj: date }
  })
  const level = function (minutes: number): number {
    if (minutes <= 0) return 0
    if (minutes < 30) return 1
    if (minutes < 60) return 2
    if (minutes < 120) return 3
    return 4
  }
  const labels: { x: number; text: string }[] = []
  let lastMonth = -1
  for (const c of cells) {
    if (c.dateObj.getDate() === 1 || lastMonth === -1) {
      const m = c.dateObj.getMonth()
      if (m !== lastMonth) {
        labels.push({ x: c.col * (cell + gap), text: MONTHS[m] })
        lastMonth = m
      }
    }
  }
  return (
    <div className='heatmap-wrap'>
      <svg width={width} height={height + 16}>
        {labels.map(function (l, i) {
          return (
            <text key={String(i)} x={l.x} y={10} className='heatmap-month'>
              {l.text}
            </text>
          )
        })}
        {cells.map(function (c) {
          return (
            <rect
              key={c.date}
              x={c.col * (cell + gap)}
              y={16 + c.row * (cell + gap)}
              width={cell}
              height={cell}
              rx={2}
              fill={HEAT_COLORS[level(c.minutes)]}
            >
              <title>{c.date} · {c.minutes} 分钟</title>
            </rect>
          )
        })}
      </svg>
      <div className='heatmap-legend'>
        <span>少</span>
        {HEAT_COLORS.map(function (c, i) {
          return <span key={String(i)} className='heatmap-legend-cell' style={{ background: c }} />
        })}
        <span>多</span>
      </div>
    </div>
  )
}

export default function StatsDashboard() {
  const { dataVersion, setActivePage } = useApp()
  const { saveReflection } = useReflections()
  const [stats, setStats] = useState<StudyStats | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [pomodoros, setPomodoros] = useState<PomodoroRecord[]>([])
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([])
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [profileText, setProfileText] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [heatMode, setHeatMode] = useState<'year' | 'weeks12'>('year')
  const [range, setRange] = useState<number>(7)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [reportCtx, setReportCtx] = useState<{ stats: StudyStats; extras: { tasksDone: number; tasksTotal: number; mistakesOpen: number; mistakesMastered: number; cardsDue: number; cardsReviewed: number; cardsDuePeriod: number }; days: number } | null>(null)
  const [reportView, setReportView] = useState<'preview' | 'source'>('preview')

  useEffect(function () {
    let alive = true
    createDb().getStats(range === 0 ? undefined : range).then(function (s) {
      if (alive) setStats(s)
    }).catch(function () {})
    createDb().getChapters().then(function (list) {
      if (alive) setChapters(list)
    }).catch(function () {})
    createDb().getMistakes().then(function (list) {
      if (alive) setMistakes(list)
    }).catch(function () {})
    createDb().getPomodoroHistory().then(function (list) {
      if (alive) setPomodoros(list)
    }).catch(function () {})
    createDb().getQuizzes().then(function (list) {
      if (alive) setQuizzes(list)
    }).catch(function () {})
    createDb().getCards().then(function (list) {
      if (alive) setReviewCards(list)
    }).catch(function () {})
    createDb().getAllDailyTasks().then(function (list) {
      if (alive) setDailyTasks(list)
    }).catch(function () {})
    return function () { alive = false }
  }, [range, dataVersion])

  if (!stats) {
    return <div className='page-empty'>加载统计数据...</div>
  }

  const pieData = [
    { name: '已完成', value: stats.completedChapters },
    { name: '未完成', value: Math.max(0, stats.totalChapters - stats.completedChapters) },
  ]

  const cards = [
    { label: '总学习时长', value: formatDuration(stats.totalStudyMinutes), icon: Timer },
    { label: '总番茄数', value: String(stats.pomodoroCount), icon: Timer },
    {
      label: '番茄完成率',
      value: stats.pomodoroTotal > 0 ? Math.round((stats.pomodoroCompleted / stats.pomodoroTotal) * 100) + '%' : '—',
      icon: Target,
    },
    { label: '连续打卡天数', value: String(stats.streakDays) + ' 天', icon: Flame },
    { label: '完成章节数', value: String(stats.completedChapters) + '/' + String(stats.totalChapters), icon: BookOpen },
  ]

  const subjectDailyRows = stats.subjectDaily.length > 0
    ? stats.subjectDaily[0].days.map(function (d) {
        const row: Record<string, string | number> = { date: d.date }
        for (const s of stats.subjectDaily) {
          const day = s.days.find(function (x) { return x.date === d.date })
          row[s.subjectId] = day ? day.minutes : 0
        }
        return row
      })
    : []

  const maxMinutes = stats.subjectStats.reduce(function (m, s) { return Math.max(m, s.minutes) }, 0)

  const buildReport = async function () {
    setReportBusy(true)
    const days = range === 0 ? 30 : range
    const results = await Promise.all([
      createDb().getAllDailyTasks(),
      createDb().getMistakes(),
      createDb().getDueCards(100),
      createDb().getStats(days),
    ])
    const tasks = results[0]
    const mistakes = results[1]
    const dueCards = results[2]
    const reportStats = results[3]
    const cutoff = new Date(Date.now() - days * 86400000)
    const recent = tasks.filter(function (t) {
      return new Date(t.date + 'T00:00:00').getTime() >= cutoff.getTime()
    })
    const cardReviewTasks = recent.filter(function (t) { return t.taskType === 'card-review' })
    const text = buildWeeklyReport(reportStats, {
      tasksDone: recent.filter(function (t) { return t.completed }).length,
      tasksTotal: recent.length,
      mistakesOpen: mistakes.filter(function (m) { return m.status !== 'mastered' }).length,
      mistakesMastered: mistakes.filter(function (m) { return m.status === 'mastered' }).length,
      cardsDue: dueCards.length,
      cardsReviewed: cardReviewTasks.filter(function (t) { return t.completed }).length,
      cardsDuePeriod: cardReviewTasks.length,
    }, days)
    setReportText(text)
    setReportCtx({
      stats: reportStats,
      extras: {
        tasksDone: recent.filter(function (t) { return t.completed }).length,
        tasksTotal: recent.length,
        mistakesOpen: mistakes.filter(function (m) { return m.status !== 'mastered' }).length,
        mistakesMastered: mistakes.filter(function (m) { return m.status === 'mastered' }).length,
        cardsDue: dueCards.length,
      cardsReviewed: cardReviewTasks.filter(function (t) { return t.completed }).length,
      cardsDuePeriod: cardReviewTasks.length,
      },
      days,
    })
    setReportBusy(false)
    setReportOpen(true)
  }

  const polishReport = async function () {
    setReportBusy(true)
    const polished = await createDb().aiChat([
      { role: 'system', content: '我是小咕，深夜书房里的猫头鹰，你的专属学习伙伴；回答用中文，温暖简洁，避免官腔。 下面是一份学习周报草稿，请润色成通顺、积极、结构清晰的中文周报，保留 Markdown 格式与所有数据，开头增加一段总结。' },
      { role: 'user', content: reportText },
    ])
    setReportText(polished.indexOf('失败') === -1 && polished.indexOf('AI') === -1 ? polished : reportText)
    setReportBusy(false)
  }

  const weakSubjects = stats.subjectStats
    .filter(function (s) { return s.totalChapters > 0 })
    .sort(function (a, b) {
      const ra = a.completedChapters / a.totalChapters
      const rb = b.completedChapters / b.totalChapters
      return ra - rb
    })
    .slice(0, 3)

  const weakChapters = chapters
    .filter(function (c) { return !c.completed })
    .sort(function (a, b) { return a.studyMinutes - b.studyMinutes })
    .slice(0, 3)

  const hourData = Array.from({ length: 24 }, function (_, h) {
    const minutes = pomodoros
      .filter(function (r) { return r.completed })
      .filter(function (r) { return new Date(r.startTime).getHours() === h })
      .reduce(function (s, r) { return s + (r.durationMinutes || 0) }, 0)
    return { hour: h + ' 时', minutes }
  })

  const quizTrend = quizzes.slice(0, 20).reverse().map(function (q) {
    return { date: q.createdAt.slice(5, 10), score: q.total > 0 ? Math.round((q.score / q.total) * 100) : 0 }
  })

  const maxSubjectMinutes = Math.max.apply(null, stats.subjectStats.map(function (x) { return x.minutes }).concat([1]))
  const radarData = stats.subjectStats.map(function (s) {
    return {
      subject: s.name,
      专注: Math.round((s.minutes / maxSubjectMinutes) * 100),
      章节: s.totalChapters > 0 ? Math.round((s.completedChapters / s.totalChapters) * 100) : 0,
      任务: s.tasksTotal > 0 ? Math.round((s.tasksDone / s.tasksTotal) * 100) : 0,
    }
  })

  const padDay = function (n: number) { return n < 10 ? '0' + String(n) : String(n) }
  const todayKey = (function () {
    const d = new Date()
    return String(d.getFullYear()) + '-' + padDay(d.getMonth() + 1) + '-' + padDay(d.getDate())
  })()
  const dueTodayCount = reviewCards.filter(function (c) { return c.status === 'new' || c.due.slice(0, 10) <= todayKey }).length
  const overdueCount = reviewCards.filter(function (c) {
    return c.status === 'new' || c.due.slice(0, 10) < todayKey
  }).length
  const healthyCards = reviewCards.filter(function (c) { return c.reps > 0 })
  const keepRate = healthyCards.length > 0 ? Math.round((healthyCards.filter(function (c) { return c.lapses === 0 }).length / healthyCards.length) * 100) : 0
  const forgotCount = reviewCards.filter(function (c) { return c.lapses > 0 }).length
  const totalLapses = reviewCards.reduce(function (sum, c) { return sum + (c.lapses || 0) }, 0)
  const avgInterval = healthyCards.length > 0 ? Math.round(healthyCards.reduce(function (sum, c) { return sum + (c.intervalDays || 0) }, 0) / healthyCards.length) : 0
  // 周期内卡片复习完成率（以「今日必做」里的卡片复习任务为准）
  const periodDays = range === 0 ? 30 : range
  const periodCutoff = new Date(Date.now() - periodDays * 86400000).getTime()
  const cardTasks = dailyTasks.filter(function (t) {
    return t.taskType === 'card-review' && new Date(t.date + 'T00:00:00').getTime() >= periodCutoff
  })
  const cardsDuePeriod = cardTasks.length
  const cardsReviewed = cardTasks.filter(function (t) { return t.completed }).length
  const reviewRate = cardsDuePeriod > 0 ? Math.round((cardsReviewed / cardsDuePeriod) * 100) : 0
  // 本周洞察：本地规则生成的自然语言建议
  const periodTasks = dailyTasks.filter(function (t) {
    return new Date(t.date + 'T00:00:00').getTime() >= periodCutoff
  })
  const tasksDonePeriod = periodTasks.filter(function (t) { return t.completed }).length
  const tasksTotalPeriod = periodTasks.length
  const mistakesOpen = mistakes.filter(function (m) { return m.status !== 'mastered' }).length
  const mistakesMastered = mistakes.filter(function (m) { return m.status === 'mastered' }).length
  const insightLines = buildInsight(stats, {
    tasksDone: tasksDonePeriod,
    tasksTotal: tasksTotalPeriod,
    mistakesOpen,
    mistakesMastered,
    cardsDue: dueTodayCount,
    cardsReviewed,
    cardsDuePeriod,
  }, periodDays).split('\n')
  const forecastData = Array.from({ length: 14 }, function (_, i) {
    const d = new Date(Date.now() + i * 86400000)
    const key = String(d.getFullYear()) + '-' + padDay(d.getMonth() + 1) + '-' + padDay(d.getDate())
    const count = reviewCards.filter(function (c) {
      return c.status === 'new' || c.due.slice(0, 10) === key
    }).length
    return { date: (d.getMonth() + 1) + '/' + d.getDate(), count, today: i === 0 }
  })

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

  const runProfile = async function () {
    setProfileBusy(true)
    const summary = stats.subjectStats.map(function (s) {
      return s.name + '：专注' + s.minutes + '分钟，章节完成' + s.completedChapters + '/' + s.totalChapters
    }).join('；')
    const result = await createDb().aiChat([
      { role: 'system', content: '我是小咕，深夜书房里的猫头鹰，你的专属学习伙伴；回答用中文，温暖简洁，避免官腔。 请基于以下科目学习数据，生成一份简短的学习画像（优势科目、薄弱环节、学习风格特点、一句话建议），200 字以内，分点输出。' },
      { role: 'user', content: '总时长' + stats.totalStudyMinutes + '分钟，连续打卡' + stats.streakDays + '天。' + summary },
    ])
    setProfileText(result.indexOf('失败') === -1 && result.indexOf('AI ') === -1 ? result : 'AI 未返回有效内容，请稍后重试')
    setProfileBusy(false)
  }

  return (
    <div className='stats-page'>
      <div className='page-header'>
        <h2><BarChart3 size={18} /> 学习统计</h2>
        <div className='page-header-actions'>
          <Button variant='primary' onClick={buildReport} disabled={reportBusy}>{reportBusy ? '生成中...' : '📄 生成周报'}</Button>
          <div className='range-switch'>
          {RANGES.map(function (r) {
            return (
              <button
                key={String(r.value)}
                className={classNames('range-btn', range === r.value ? 'active' : undefined)}
                onClick={function () { setRange(r.value) }}
              >
                {r.label}
              </button>
            )
          })}
          </div>
        </div>
      </div>

      <div className='stats-insight'>
        <h4><Sparkles size={14} /> {range === 0 ? '近 30 天' : '近 ' + range + ' 天'}洞察</h4>
        <div className='stats-insight-lines'>
          {insightLines.map(function (line, i) {
            return <p key={String(i)} className='stats-insight-line'>{line}</p>
          })}
        </div>
      </div>

      {reportOpen ? (
        <Modal onClose={function () { setReportOpen(false) }} className='report-modal'>
          <h3><FileText size={15} /> 学习周报</h3>
          <div className='report-view-toggle'>
            <button className={reportView === 'preview' ? 'active' : ''} onClick={function () { setReportView('preview') }}>预览</button>
            <button className={reportView === 'source' ? 'active' : ''} onClick={function () { setReportView('source') }}>Markdown 源码</button>
          </div>
          {reportView === 'preview' ? (
            <div className='report-preview md-body'>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{reportText}</ReactMarkdown>
            </div>
          ) : (
            <textarea className='report-textarea' value={reportText} onChange={function (e) { setReportText(e.target.value) }} />
          )}
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () {
              navigator.clipboard.writeText(reportText).then(function () {
                window.alert('已复制到剪贴板')
              })
            }}>复制</Button>
            <Button variant='default' onClick={async function () {
              const p = await createDb().exportTextFile('学习周报', reportText)
              if (p && p !== 'cancelled') window.alert('已导出：' + p)
            }}>导出 .md</Button>
            <Button variant='default' onClick={async function () {
              if (!reportCtx) return
              const html = buildWeeklyReportHtml(reportCtx.stats, reportCtx.extras, reportCtx.days)
              const p = await createDb().exportTextFile('学习周报', html, 'html')
              if (p && p !== 'cancelled') window.alert('已导出：' + p)
            }}>导出 HTML</Button>
            <Button variant='primary' onClick={async function () {
              await saveReflection({ title: '学习周报 ' + new Date().toISOString().slice(0, 10), content: reportText })
              window.alert('已保存到学习心得')
            }}>保存为心得</Button>
            <Button variant='ghost' disabled={reportBusy} onClick={polishReport}><Sparkles size={13} /> AI 润色</Button>
            <span className='modal-spacer' />
            <Button variant='default' onClick={function () { setReportOpen(false) }}>关闭</Button>
          </div>
        </Modal>
      ) : null}

      {stats && stats.totalStudyMinutes === 0 && stats.pomodoroTotal === 0 && stats.completedChapters === 0 ? (
        <div className='stats-empty-banner'>
          <EmptyState compact title='还没有学习数据' hint='去点亮第一盏台灯，专注 25 分钟——你的专注、复习、错题会在这里慢慢长成一条成长曲线' color='var(--c-stats)' action={<Button variant='primary' onClick={function () { setActivePage('pomodoro') }}>开始第一个番茄</Button>} />
        </div>
      ) : null}

      <div className='stats-cards'>
        {cards.map(function (c) {
          return (
            <div key={c.label} className='stat-card'>
              <div className='stat-card-icon'><c.icon size={18} /></div>
              <div className='stat-card-value'>{c.value}</div>
              <div className='stat-card-label'>{c.label}</div>
            </div>
          )
        })}
      </div>
      <p className='stats-note'>口径说明：总学习时长 = 番茄专注 + 阅读计时；章节内的学习计时见知识图谱「章节累计」。</p>

      <section className='chart-card heatmap-card'>
        <div className='heatmap-head'>
          <h4><Flame size={14} /> 打卡热力图</h4>
          <div className='option-pills'>
            <button className={heatMode === 'year' ? 'pill active' : 'pill'} onClick={function () { setHeatMode('year') }}>年度</button>
            <button className={heatMode === 'weeks12' ? 'pill active' : 'pill'} onClick={function () { setHeatMode('weeks12') }}>近 12 周</button>
          </div>
        </div>
        <Heatmap data={heatMode === 'year' ? stats.heatmap : stats.heatmap.slice(-84)} />
      </section>

      {stats.subjectStats.length > 0 ? (
        <section className='chart-card subject-section'>
          <h4><Folder size={14} /> 按科目统计</h4>
          <div className='subject-stats-list'>
            {stats.subjectStats.map(function (s) {
              const maxW = maxMinutes > 0 ? Math.max(6, Math.round((s.minutes / maxMinutes) * 100)) : 0
              const chapterPct = s.totalChapters > 0 ? Math.round((s.completedChapters / s.totalChapters) * 100) : 0
              return (
                <div key={s.subjectId} className='subject-stat-row'>
                  <span className='subject-dot' style={{ background: s.color }} />
                  <span className='subject-stat-name'>{s.name}</span>
                  <div className='subject-stat-body'>
                    <div className='subject-stat-line'>
                      <span className='subject-stat-label'>专注 {formatDuration(s.minutes)}</span>
                      <div className='subject-stat-bar'>
                        <div className='subject-stat-fill' style={{ width: maxW + '%', background: s.color }} />
                      </div>
                    </div>
                    <div className='subject-stat-line'>
                      <span className='subject-stat-label'>章节 {s.completedChapters}/{s.totalChapters}（{chapterPct}%）</span>
                      <div className='subject-stat-bar'>
                        <div className='subject-stat-fill' style={{ width: chapterPct + '%', background: s.color + '99' }} />
                      </div>
                    </div>
                    <div className='subject-stat-line'>
                      <span className='subject-stat-label'>今日任务 {s.tasksDone}/{s.tasksTotal}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {stats.subjectDaily.length > 0 ? (
        <section className='chart-card subject-stacked-card'>
          <h4><BookOpen size={14} /> 科目 × 时间 · 学习时长分布</h4>
          <ResponsiveContainer width='100%' height={260}>
            <BarChart data={subjectDailyRows}>
              <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' />
              <XAxis dataKey='date' tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} itemStyle={{ color: 'var(--text-2)' }} labelStyle={{ color: 'var(--text)' }} />
              <Legend />
              {stats.subjectDaily.map(function (s) {
                return <Bar key={s.subjectId} dataKey={s.subjectId} stackId='a' fill={s.color} name={s.name} />
              })}
            </BarChart>
          </ResponsiveContainer>
        </section>
      ) : null}

      {mistakes.length > 0 ? (
        <section className='chart-card mistake-stats-section'>
          <h4><FileQuestion size={14} /> 错题分析</h4>
          <div className='mistake-stats-grid'>
            <div className='mistake-stat-block'>
              <div className='mistake-stat-value'>{mistakes.filter(function (m) { return m.status === 'open' || m.status === 'reviewing' }).length}</div>
              <div className='mistake-stat-label'>待订正 / 复习中</div>
            </div>
            <div className='mistake-stat-block'>
              <div className='mistake-stat-value'>{mistakes.filter(function (m) { return m.status === 'mastered' }).length}</div>
              <div className='mistake-stat-label'>已掌握</div>
            </div>
            <div className='mistake-stat-block'>
              <div className='mistake-stat-value'>{mistakes.length}</div>
              <div className='mistake-stat-label'>错题总数</div>
            </div>
          </div>
          <div className='mistake-subject-list'>
            {stats.subjectStats.map(function (s) {
              const list = mistakes.filter(function (m) { return m.subjectId === s.subjectId })
              if (list.length === 0) return null
              const mastered = list.filter(function (m) { return m.status === 'mastered' }).length
              return (
                <div key={s.subjectId} className='mistake-subject-row'>
                  <span className='subject-dot' style={{ background: s.color }} />
                  <span className='mistake-subject-name'>{s.name}</span>
                  <div className='mistake-subject-bar'>
                    <div className='mistake-subject-fill' style={{ width: (mastered / list.length) * 100 + '%', background: s.color }} />
                  </div>
                  <span className='mistake-subject-text'>掌握 {mastered}/{list.length}</span>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {(weakSubjects.length > 0 || weakChapters.length > 0) ? (
        <section className='chart-card weak-section'>
          <h4><AlertTriangle size={14} /> 薄弱点分析</h4>
          <div className='weak-list'>
            {weakSubjects.map(function (s) {
              const pct = Math.round((s.completedChapters / s.totalChapters) * 100)
              return (
                <div key={s.subjectId} className='weak-item'>
                  <span className='subject-dot' style={{ background: s.color }} />
                  <span className='weak-name'>科目「{s.name}」完成率仅 {pct}%</span>
                </div>
              )
            })}
            {weakChapters.map(function (c) {
              return (
                <div key={c.id} className='weak-item'>
                  <span className='weak-icon'><BookOpen size={16} /></span>
                  <span className='weak-name'>「{c.title}」尚未完成，学习时长 {formatDuration(c.studyMinutes)}</span>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <div className='charts-grid'>
        <div className='chart-card'>
          <h4>每日学习时长（分钟）</h4>
          <ResponsiveContainer width='100%' height={240}>
            <LineChart data={stats.dailyStats}>
              <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' />
              <XAxis dataKey='date' tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} itemStyle={{ color: 'var(--text-2)' }} labelStyle={{ color: 'var(--text)' }} />
              <Line type='monotone' dataKey='minutes' name='学习分钟' stroke='#D9922E' strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className='chart-card'>
          <h4>每日完成章节数</h4>
          <ResponsiveContainer width='100%' height={240}>
            <BarChart data={stats.dailyStats}>
              <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' />
              <XAxis dataKey='date' tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} itemStyle={{ color: 'var(--text-2)' }} labelStyle={{ color: 'var(--text)' }} />
              <Bar dataKey='chapters' name='完成章节' fill='#D9922E' radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className='chart-card'>
          <h4>章节完成率</h4>
          <ResponsiveContainer width='100%' height={240}>
            <PieChart>
              <Pie data={pieData} dataKey='value' nameKey='name' cx='50%' cy='50%' outerRadius={80} label>
                <Cell key='done' fill='#22C55E' />
                <Cell key='todo' fill='var(--border)' />
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} itemStyle={{ color: 'var(--text-2)' }} labelStyle={{ color: 'var(--text)' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className='charts-grid'>
        <div className='chart-card'>
          <h4><Timer size={14} /> 每日专注时段分布</h4>
          <ResponsiveContainer width='100%' height={220}>
            <LineChart data={hourData}>
              <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' />
              <XAxis dataKey='hour' tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} itemStyle={{ color: 'var(--text-2)' }} labelStyle={{ color: 'var(--text)' }} />
              <Line type='monotone' dataKey='minutes' name='专注分钟' stroke='#8B5CF6' strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className='chart-card'>
          <h4><TrendingUp size={14} /> 自测成绩趋势</h4>
          {quizTrend.length === 0 ? (
            <EmptyState title='还没有自测记录' hint='去「AI 助手」做一次自测，检验学习效果' color='var(--c-stats)' />
          ) : (
            <ResponsiveContainer width='100%' height={220}>
              <LineChart data={quizTrend}>
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' />
                <XAxis dataKey='date' tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} itemStyle={{ color: 'var(--text-2)' }} labelStyle={{ color: 'var(--text)' }} />
                <Line type='monotone' dataKey='score' name='得分 %' stroke='#10B981' strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className='charts-grid'>
        <div className='chart-card'>
          <h4><PieChartIcon size={14} /> 学习画像（按科目）</h4>
          {radarData.length === 0 ? (
            <EmptyState title='暂无科目数据' hint='在设置中添加科目，开始按科目统计学习' color='var(--c-stats)' />
          ) : (
            <ResponsiveContainer width='100%' height={240}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey='subject' tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name='专注' dataKey='专注' stroke='#D9922E' fill='#D9922E' fillOpacity={0.5} />
                <Radar name='章节' dataKey='章节' stroke='#10B981' fill='#10B981' fillOpacity={0.35} />
                <Radar name='任务' dataKey='任务' stroke='#F59E0B' fill='#F59E0B' fillOpacity={0.35} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          )}
          <div className='profile-actions'>
            <Button variant='ghost' disabled={profileBusy} onClick={runProfile}>
              {profileBusy ? '生成中...' : <><Sparkles size={13} /> AI 画像解读</>}
            </Button>
          </div>
          {profileText ? <pre className='ai-result'>{profileText}</pre> : null}
        </div>
        <div className='chart-card'>
          <h4><CalendarDays size={14} /> 未来 14 天复习负荷</h4>
          <div className='due-curve-meta'>
            <span className='due-curve-today'>今日到期 <b>{forecastData.length > 0 ? forecastData[0].count : 0}</b> 张</span>
            {overdueCount > 0 ? <span className='due-curve-overdue'>已逾期 <b>{overdueCount}</b> 张</span> : null}
            <span className='due-curve-tip'>复习压力来自 FSRS 排期，峰值日建议预留时间</span>
          </div>
          <ResponsiveContainer width='100%' height={210}>
            <BarChart data={forecastData}>
              <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' />
              <XAxis dataKey='date' tick={{ fontSize: 9 }} interval={1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--accent) 8%, transparent)' }} />
              <Bar dataKey='count' name='到期卡片' radius={[4, 4, 0, 0]}>
                {forecastData.map(function (d, i) {
                  return <Cell key={String(i)} fill={d.today ? '#E8A33D' : '#9B6FD8'} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className='chart-card'>
          <h4><Layers size={14} /> 复习健康</h4>
          <div className='review-health-grid'>
            <div className='review-health-block'><b>{keepRate}%</b><span>记忆保持率（无遗忘）</span></div>
            <div className='review-health-block'><b>{dueTodayCount}</b><span>今日到期</span></div>
            <div className='review-health-block'><b>{forgotCount}</b><span>曾遗忘卡片</span></div>
            <div className='review-health-block'><b>{avgInterval}</b><span>平均间隔（天）</span></div>
            <div className='review-health-block'><b>{reviewRate}%</b><span>近 {periodDays} 天复习完成率</span></div>
          </div>
          <p className='review-health-tip'>保持率 = 复习过且从未遗忘的卡片占比；完成率 = 周期内「卡片复习」任务的完成情况；按 FSRS 坚持复习，间隔会越拉越长、记得越牢。</p>
        </div>
      </div>

      <section className='chart-card'>
        <h4><Calendar size={14} /> 本周 vs 上周</h4>
        <div className='week-compare-row'>
          <div className='week-compare-block'>
            <div className='week-compare-label'>本周专注</div>
            <div className='week-compare-value'>{sumMin(thisWeek)} 分钟</div>
            <div className='week-compare-sub'><Timer size={12} /> {thisWeek.length} 个</div>
          </div>
          <div className='week-compare-block'>
            <div className='week-compare-label'>上周专注</div>
            <div className='week-compare-value'>{sumMin(lastWeek)} 分钟</div>
            <div className='week-compare-sub'><Timer size={12} /> {lastWeek.length} 个</div>
          </div>
          <div className='week-compare-block'>
            <div className='week-compare-label'>变化</div>
            <div className='week-compare-value'>{weekDelta >= 0 ? '+' : ''}{weekDelta} 分钟</div>
            <div className='week-compare-sub'>{weekDelta >= 0 ? '保持势头 💪' : '这周要加油 💪'}</div>
          </div>
        </div>
      </section>
    </div>
  )
}













