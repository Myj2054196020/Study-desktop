import { useEffect, useRef, useState } from 'react'
import { Archive, BarChart3, Brain, ClipboardList, FileText, Layers, MessageCircle, Sparkles } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createDb } from '../../lib/db'
import { useApp } from '../../stores/AppContext'
import { useChapters } from '../../stores/ChapterContext'
import { useReflections } from '../../stores/ReflectionContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { buildWeeklyReport } from '../../lib/report'
import { formatDate, uid } from '../../lib/utils'
import type { AISession, AppSettings, QuizRecord } from '../../types'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

interface QuizItem {
  q: string
  options: string[]
  answer: number
}

function parseQuiz(raw: string): QuizItem[] {
  const m = raw.match(/\[[\s\S]*\]/)
  if (!m) return []
  try {
    const arr = JSON.parse(m[0])
    if (!Array.isArray(arr)) return []
    return arr
      .filter(function (x) {
        return x && typeof x.q === 'string' && Array.isArray(x.options) && x.options.length >= 2 && typeof x.answer === 'number'
      })
      .map(function (x) {
        return { q: String(x.q), options: x.options.map(function (o: unknown) { return String(o) }), answer: Number(x.answer) }
      })
  } catch (e) {
    return []
  }
}

export default function AIPage() {
  const { dataVersion, setActivePage } = useApp()
  const { chapters, textbooks } = useChapters()
  const { saveReflection } = useReflections()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [chapterId, setChapterId] = useState('')
  const [toolResult, setToolResult] = useState('')
  const [toolBusy, setToolBusy] = useState(false)
  const [quiz, setQuiz] = useState<QuizItem[] | null>(null)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizGraded, setQuizGraded] = useState(false)
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [essayText, setEssayText] = useState('')
  const [essayBusy, setEssayBusy] = useState(false)
  const [weeklyBusy, setWeeklyBusy] = useState(false)
  const [lastTool, setLastTool] = useState('')
  const [autoSaveWrong, setAutoSaveWrong] = useState(true)
  const [sessions, setSessions] = useState<AISession[]>([])
  const [activeId, setActiveId] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(function () {
    createDb().getSettings().then(function (s) { setSettings(s) }).catch(function () {})
    createDb().getQuizzes().then(function (list) { setQuizzes(list) }).catch(function () {})
    createDb().getAISessions().then(function (list) {
      setSessions(list)
      if (list.length === 0) {
        const now = new Date().toISOString()
        const first: AISession = { id: uid('chat'), title: '新对话', createdAt: now, updatedAt: now, messages: [] }
        createDb().saveAISession(first).then(function () {
          setSessions([first])
          setActiveId(first.id)
        })
      } else {
        setActiveId(list[0].id)
        setMessages(list[0].messages || [])
      }
    }).catch(function () {})
  }, [dataVersion])

  useEffect(function () {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const configured = !!settings && !!settings.aiApiKey

  const persistSession = function (msgs: { role: 'user' | 'assistant'; content: string }[]) {
    const now = new Date().toISOString()
    const firstUser = msgs.find(function (m) { return m.role === 'user' })
    const title = firstUser ? firstUser.content.slice(0, 16) : '新对话'
    const session: AISession = {
      id: activeId || uid('chat'),
      title,
      createdAt: now,
      updatedAt: now,
      messages: msgs,
    }
    createDb().saveAISession(session).then(function () {
      setSessions(function (prev) {
        const idx = prev.findIndex(function (s) { return s.id === session.id })
        if (idx === -1) return [session].concat(prev)
        const next = prev.slice()
        next[idx] = session
        return next.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt) })
      })
      setActiveId(session.id)
    })
  }

  const newSession = function () {
    const now = new Date().toISOString()
    const session: AISession = { id: uid('chat'), title: '新对话', createdAt: now, updatedAt: now, messages: [] }
    createDb().saveAISession(session)
    setSessions(function (prev) { return [session].concat(prev) })
    setActiveId(session.id)
    setMessages([])
  }

  const selectSession = function (id: string) {
    const found = sessions.find(function (s) { return s.id === id })
    if (found) {
      setActiveId(id)
      setMessages(found.messages || [])
    }
  }

  const removeSession = function (id: string) {
    createDb().deleteAISession(id)
    const next = sessions.filter(function (s) { return s.id !== id })
    setSessions(next)
    if (activeId === id) {
      if (next.length > 0) {
        setActiveId(next[0].id)
        setMessages(next[0].messages || [])
      } else {
        newSession()
      }
    }
  }

  const send = async function () {
    const text = input.trim()
    if (!text || busy) return
    const history = messages.concat([{ role: 'user' as const, content: text }])
    setMessages(history)
    setInput('')
    setBusy(true)
    const reply = await createDb().aiChat([
      { role: 'system', content: '你是一名耐心的学习助手，请用中文简洁清晰地回答。' },
    ].concat(history))
    const all = history.concat([{ role: 'assistant' as const, content: reply }])
    setMessages(all)
    persistSession(all)
    setBusy(false)
  }

  const currentChapter = chapters.find(function (c) { return c.id === chapterId })

  const runSummary = async function () {
    if (!currentChapter) return
    setToolBusy(true)
    setLastTool('summary')
    setToolResult('AI 总结中...')
    const result = await createDb().aiChat([
      { role: 'system', content: '你是一名学习助手。请用简洁的中文总结章节的核心知识点、重点公式与易错点，控制在 300 字以内。' },
      { role: 'user', content: currentChapter.title + '\n\n' + currentChapter.content.slice(0, 4000) },
    ])
    setToolResult(result)
    setToolBusy(false)
  }

  const saveResultAsReflection = async function () {
    const labels: Record<string, string> = {
      summary: 'AI 总结',
      essay: 'AI 作文批改',
      weekly: 'AI 周报',
      diagnosis: 'AI 学习诊断',
    }
    const tb = currentChapter ? textbooks.find(function (t) { return t.id === currentChapter.textbookId }) : undefined
    await saveReflection({
      title: (labels[lastTool] || 'AI 内容') + (currentChapter ? '：' + currentChapter.title : ''),
      content: toolResult,
      chapterId: currentChapter ? currentChapter.id : undefined,
      subjectId: tb ? tb.subjectId : undefined,
    })
    setToolResult('已保存到「学习心得」✓')
  }

  const runDiagnosis = async function () {
    setToolBusy(true)
    setLastTool('diagnosis')
    setToolResult('AI 分析中...')
    const results = await Promise.all([
      createDb().getStats(30),
      createDb().getMistakes(),
      createDb().getCards(),
      createDb().getAllDailyTasks(),
    ])
    const s = results[0]
    const mistakes = results[1]
    const cards = results[2]
    const tasks = results[3]
    const summary = [
      '近 30 天学习时长：' + s.totalStudyMinutes + ' 分钟',
      '完成章节：' + s.completedChapters + '/' + s.totalChapters,
      '番茄完成率：' + (s.pomodoroTotal > 0 ? Math.round((s.pomodoroCompleted / s.pomodoroTotal) * 100) : 0) + '%',
      '错题：待订正 ' + mistakes.filter(function (m) { return m.status !== 'mastered' }).length + '，已掌握 ' + mistakes.filter(function (m) { return m.status === 'mastered' }).length,
      '卡片：共 ' + cards.length + ' 张，待复习 ' + cards.filter(function (c) { return c.status === 'new' || new Date(c.due).getTime() <= Date.now() }).length,
      '科目统计：' + s.subjectStats.map(function (x) { return x.name + ' ' + x.minutes + ' 分钟' }).join('，'),
      '待办任务：' + tasks.filter(function (t) { return !t.completed }).length,
    ].join('\n')
    const result = await createDb().aiChat([
      { role: 'system', content: '你是学习规划顾问。请基于以下学习数据，给出 3-5 条个性化学习建议与薄弱点诊断，并指出下个阶段最该提升的 1-2 件事。用中文、分点输出。' },
      { role: 'user', content: summary },
    ])
    setToolResult(result)
    setToolBusy(false)
  }

  const runQuiz = async function () {
    if (!currentChapter) return
    setToolBusy(true)
    setToolResult('AI 出题中...')
    const raw = await createDb().aiChat([
      { role: 'system', content: '你是学习出题助手。请根据章节内容出 5 道单项选择题，只输出 JSON 数组，格式：[{  q: 题目, options: [A..., B..., C..., D...], answer: 0 }]，answer 为正确选项下标。不要输出其它内容。' },
      { role: 'user', content: currentChapter.title + '\n\n' + currentChapter.content.slice(0, 4000) },
    ])
    const items = parseQuiz(raw)
    if (items.length === 0) {
      setToolResult('AI 未生成有效题目：' + raw.slice(0, 160))
      setToolBusy(false)
      return
    }
    setQuiz(items)
    setQuizAnswers(new Array(items.length).fill(-1))
    setQuizGraded(false)
    setToolResult('已生成 ' + items.length + ' 道题，请作答后点击「提交批改」')
    setToolBusy(false)
  }

  const gradeQuiz = async function () {
    setQuizGraded(true)
    if (!quiz) return
    const wrongIdx: number[] = []
    quiz.forEach(function (item, i) {
      if (quizAnswers[i] !== item.answer) {
        wrongIdx.push(i)
      }
    })
    const score = quiz.length - wrongIdx.length
    if (autoSaveWrong && wrongIdx.length > 0 && currentChapter) {
      const tb = textbooks.find(function (t) { return t.id === currentChapter.textbookId })
      const now = new Date().toISOString()
      for (const i of wrongIdx) {
        await createDb().saveMistake({
          id: uid('mist'),
          question: quiz[i].q,
          myAnswer: quiz[i].options[quizAnswers[i]] || '未作答',
          correctAnswer: quiz[i].options[quiz[i].answer],
          chapterId: currentChapter.id,
          subjectId: tb ? tb.subjectId : undefined,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        })
      }
      setToolResult('得分：' + score + ' / ' + quiz.length + '（已自动加入错题本 ' + wrongIdx.length + ' 道）')
    } else {
      setToolResult('得分：' + score + ' / ' + quiz.length)
    }
  }

  const saveQuizToBank = async function () {
    if (!quiz) return
    const now = new Date().toISOString()
    const record: QuizRecord = {
      id: uid('quiz'),
      title: '自测：' + (currentChapter ? currentChapter.title : '未关联章节'),
      chapterId: currentChapter ? currentChapter.id : undefined,
      subjectId: currentChapter ? (textbooks.find(function (t) { return t.id === currentChapter.textbookId }) || {}).subjectId : undefined,
      items: quiz.map(function (x) { return { q: x.q, options: x.options, answer: x.answer } }),
      userAnswers: quizAnswers.slice(),
      score: quiz.filter(function (item, i) { return quizAnswers[i] === item.answer }).length,
      total: quiz.length,
      createdAt: now,
    }
    await createDb().saveQuiz(record)
    setQuizzes(function (prev) { return [record].concat(prev) })
    setToolResult('已保存到题库 ✓')
  }

  const rerunWrong = function (q: QuizRecord) {
    const wrong = q.items.filter(function (item, i) { return q.userAnswers[i] !== item.answer })
    if (wrong.length === 0) {
      setToolResult('这次全部答对了，无需重练 🎉')
      return
    }
    setQuiz(wrong)
    setQuizAnswers(new Array(wrong.length).fill(-1))
    setQuizGraded(false)
    setToolResult('错题重练：共 ' + wrong.length + ' 道')
  }

  const deleteQuiz = async function (id: string) {
    await createDb().deleteQuiz(id)
    setQuizzes(function (prev) { return prev.filter(function (q) { return q.id !== id }) })
  }

  const gradeEssay = async function () {
    if (!essayText.trim()) return
    setEssayBusy(true)
    setLastTool('essay')
    setToolResult('AI 批改中...')
    const result = await createDb().aiChat([
      { role: 'system', content: '你是作文批改老师。请从内容、结构、语言、亮点与改进建议五个维度评价，并给出综合评分（百分制）。用中文输出。' },
      { role: 'user', content: essayText },
    ])
    setToolResult(result)
    setEssayBusy(false)
  }

  const runWeeklyReport = async function () {
    setWeeklyBusy(true)
    setLastTool('weekly')
    setToolResult('AI 生成周报中...')
    const stats = await createDb().getStats(7)
    const [tasks, mistakes, dueCards] = await Promise.all([
      createDb().getAllDailyTasks(),
      createDb().getMistakes(),
      createDb().getDueCards(100),
    ])
    const today = new Date().toDateString()
    const recentTasks = tasks.filter(function (t) { return new Date(t.date).toDateString() === today })
    const done = recentTasks.filter(function (t) { return t.completed }).length
    const cardTasks = recentTasks.filter(function (t) { return t.taskType === 'card-review' })
    const base = buildWeeklyReport(stats, {
      tasksDone: done,
      tasksTotal: recentTasks.length,
      mistakesOpen: mistakes.filter(function (m) { return m.status !== 'mastered' }).length,
      mistakesMastered: mistakes.filter(function (m) { return m.status === 'mastered' }).length,
      cardsDue: dueCards.length,
      cardsReviewed: cardTasks.filter(function (t) { return t.completed }).length,
      cardsDuePeriod: cardTasks.length,
    }, 7)
    const polished = await createDb().aiChat([
      { role: 'system', content: '下面是一份学习周报草稿，请润色成一篇通顺、积极、结构清晰的中文周报，保留 Markdown 格式和所有数据，可在开头增加一段总结。' },
      { role: 'user', content: base },
    ])
    setToolResult(polished.indexOf('失败') === -1 && polished.indexOf('AI') === -1 ? polished : base)
    setWeeklyBusy(false)
  }

  const saveWrongToMistakes = async function () {
    if (!quiz || !currentChapter) return
    const tb = textbooks.find(function (t) { return t.id === currentChapter.textbookId })
    let count = 0
    for (let i = 0; i < quiz.length; i += 1) {
      if (quizAnswers[i] === quiz[i].answer) continue
      const item = quiz[i]
      const now = new Date().toISOString()
      await createDb().saveMistake({
        id: uid('mist'),
        question: item.q,
        myAnswer: item.options[quizAnswers[i]] || '未作答',
        correctAnswer: item.options[item.answer],
        chapterId: currentChapter.id,
        subjectId: tb ? tb.subjectId : undefined,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      })
      count += 1
    }
    setToolResult('已把 ' + count + ' 道错题加入错题本 ✓')
    setQuizGraded(false)
    setQuiz(null)
  }

  const runCards = async function () {
    if (!currentChapter) return
    setToolBusy(true)
    setToolResult('AI 生成卡片中...')
    const tb = textbooks.find(function (t) { return t.id === currentChapter.textbookId })
    const raw = await createDb().aiChat([
      { role: 'system', content: '请根据章节内容提炼 5 张间隔重复复习卡片，只输出 JSON 数组：[{ front: 问题, back: 答案 }]。' },
      { role: 'user', content: currentChapter.title + '\n\n' + currentChapter.content.slice(0, 3000) },
    ])
    const m = raw.match(/\[[\s\S]*\]/)
    let count = 0
    if (m) {
      try {
        const arr = JSON.parse(m[0])
        if (Array.isArray(arr)) {
          const now = new Date().toISOString()
          for (const x of arr) {
            if (!x || typeof x.front !== 'string' || typeof x.back !== 'string') continue
            await createDb().saveCard({
              id: uid('card'),
              front: String(x.front),
              back: String(x.back),
              chapterId: currentChapter.id,
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
            count += 1
          }
        }
      } catch (e) { /* ignore */ }
    }
    setToolResult(count > 0 ? '已生成 ' + count + ' 张卡片 ✓（可到「复习卡片」页查看）' : 'AI 未返回有效卡片：' + raw.slice(0, 160))
    setToolBusy(false)
  }

  const runBatch = async function () {
    if (!currentChapter) return
    setToolBusy(true)
    setLastTool('summary')
    setToolResult('🚀 一键生成中（复习卡片 + 自测题）...')
    const tb = textbooks.find(function (t) { return t.id === currentChapter.textbookId })
    const subjectId = tb ? tb.subjectId : undefined
    const now = new Date().toISOString()
    let cardCount = 0
    const rawCards = await createDb().aiChat([
      { role: 'system', content: '请根据章节内容提炼 5 张间隔重复复习卡片，只输出 JSON 数组：[{  front: 问题, back: 答案 }]。' },
      { role: 'user', content: currentChapter.title + '\n\n' + currentChapter.content.slice(0, 3000) },
    ])
    const cm = rawCards.match(/\[[\s\S]*\]/)
    if (cm) {
      try {
        const arr = JSON.parse(cm[0])
        if (Array.isArray(arr)) {
          for (const x of arr) {
            if (!x || typeof x.front !== 'string' || typeof x.back !== 'string') continue
            await createDb().saveCard({
              id: uid('card'),
              front: String(x.front),
              back: String(x.back),
              chapterId: currentChapter.id,
              subjectId,
              status: 'new',
              due: now,
              intervalDays: 0,
              ease: 2.5,
              reps: 0,
              lapses: 0,
              createdAt: now,
              updatedAt: now,
            })
            cardCount += 1
          }
        }
      } catch (e) { /* ignore */ }
    }
    const rawQuiz = await createDb().aiChat([
      { role: 'system', content: '请根据章节内容出 5 道单项选择题，只输出 JSON 数组：[{ q: 题目, options: [A..., B..., C..., D...], answer: 0 }]。' },
      { role: 'user', content: currentChapter.title + '\n\n' + currentChapter.content.slice(0, 4000) },
    ])
    const items = parseQuiz(rawQuiz)
    setToolBusy(false)
    setToolResult('🚀 已生成 ' + cardCount + ' 张卡片、' + items.length + ' 道自测题。自测题可直接作答，卡片可在「复习卡片」页复习。')
    if (items.length > 0) {
      setQuiz(items)
      setQuizAnswers(new Array(items.length).fill(-1))
      setQuizGraded(false)
    }
  }

  if (!configured) {
    return (
      <div className='ai-page'>
        <div className='page-header'>
          <h2><Sparkles size={18} /> AI 助手</h2>
        </div>
        <div className='ai-unconfigured'>
          <p>🔑 AI 功能需要先配置接口（已预置 DeepSeek，填入 API Key 即可）。</p>
          <Button variant='primary' onClick={function () { setActivePage('settings') }}>前往设置</Button>
        </div>
      </div>
    )
  }

  return (
    <div className='ai-page'>
      <div className='page-header'>
        <h2><Sparkles size={18} /> AI 助手</h2>
        <span className='graph-hint'>对话问答 · 章节总结 · 智能出题自测 · 生成复习卡片</span>
      </div>

      <section className='ai-tools'>
        <div className='ai-chapter-row'>
          <select className='select-input ai-chapter-select' value={chapterId} onChange={function (e) { setChapterId(e.target.value) }}>
            <option value=''>选择章节...</option>
            {chapters.map(function (c) {
              return <option key={c.id} value={c.id}>{c.title}</option>
            })}
          </select>
          <Button variant='default' disabled={!currentChapter || toolBusy} onClick={runSummary}><FileText size={13} /> 章节总结</Button>
          <Button variant='primary' disabled={!currentChapter || toolBusy} onClick={runQuiz}><ClipboardList size={13} /> AI 自测</Button>
          <Button variant='default' disabled={!currentChapter || toolBusy} onClick={runCards}><Layers size={13} /> 生成卡片</Button>
          <Button variant='default' disabled={toolBusy} onClick={runDiagnosis}>{toolBusy ? '分析中...' : <><Brain size={13} /> 学习诊断</>}</Button>
          <Button variant='primary' disabled={!currentChapter || toolBusy} onClick={runBatch}>{toolBusy ? '生成中...' : <><Sparkles size={13} /> 一键生成</>}</Button>
          <Button variant='default' disabled={toolBusy || essayBusy} onClick={function () { setToolResult(''); window.scrollTo({ top: 99999, behavior: 'smooth' }) }}><FileText size={13} /> 作文批改</Button>
          <Button variant='default' disabled={weeklyBusy} onClick={runWeeklyReport}>{weeklyBusy ? '生成中...' : <><BarChart3 size={13} /> AI 周报</>}</Button>
        </div>
        {toolResult ? (
          <div className='ai-result'>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{toolResult}</ReactMarkdown>
          </div>
        ) : null}
        {lastTool && toolResult && toolResult.indexOf('已保存') === -1 && toolResult.indexOf('AI ') === -1 ? (
          <div className='ai-message-actions'>
            <Button variant='primary' onClick={saveResultAsReflection}>保存为心得</Button>
          </div>
        ) : null}
      </section>

      <section className='chat-section'>
        <h3><FileText size={15} /> 作文 / 简答题批改</h3>
        <textarea className='reflection-content-input' value={essayText} onChange={function (e) { setEssayText(e.target.value) }} placeholder='粘贴你的作文或简答题答案，AI 将按内容 / 结构 / 语言等维度批改打分...' />
        <div className='quiz-actions'>
          <Button variant='primary' disabled={essayBusy || !essayText.trim()} onClick={gradeEssay}>
            {essayBusy ? '批改中...' : '开始批改'}
          </Button>
        </div>
      </section>

      {quizzes.length > 0 ? (
        <section className='quiz-section'>
          <h3><Archive size={15} /> 自测历史（{quizzes.length}）</h3>
          <ul className='quiz-history-list'>
            {quizzes.map(function (q) {
              return (
                <li key={q.id} className='quiz-history-item'>
                  <div className='quiz-history-main'>
                    <div className='quiz-history-title'>{q.title}</div>
                    <div className='quiz-history-meta'>{q.score}/{q.total} 分 · {formatDate(q.createdAt)}</div>
                  </div>
                  <Button variant='ghost' onClick={function () { rerunWrong(q) }}>错题重练</Button>
                  <Button variant='danger' onClick={function () { deleteQuiz(q.id) }}>删除</Button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {quiz ? (
        <section className='quiz-section'>
          <h3><ClipboardList size={15} /> 自测</h3>
          {quiz.map(function (item, i) {
            return (
              <div key={String(i)} className={'quiz-item' + (quizGraded ? (quizAnswers[i] === item.answer ? ' correct' : ' wrong') : '')}>
                <div className='quiz-q'>{i + 1}. {item.q}</div>
                <div className='quiz-options'>
                  {item.options.map(function (opt, oi) {
                    return (
                      <label key={String(oi)} className='quiz-option'>
                        <input
                          type='radio'
                          name={'quiz-' + String(i)}
                          checked={quizAnswers[i] === oi}
                          disabled={quizGraded}
                          onChange={function () {
                            const next = quizAnswers.slice()
                            next[i] = oi
                            setQuizAnswers(next)
                          }}
                        />
                        <span>{opt}</span>
                        {quizGraded && oi === item.answer ? <span className='quiz-mark'>✓</span> : null}
                        {quizGraded && quizAnswers[i] === oi && oi !== item.answer ? <span className='quiz-mark wrong-mark'>✗</span> : null}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <div className='quiz-actions'>
            {!quizGraded ? (
              <>
                <Button variant='primary' onClick={gradeQuiz}>提交批改</Button>
                <label className='checkbox quiz-auto-check'>
                  <input type='checkbox' checked={autoSaveWrong} onChange={function (e) { setAutoSaveWrong(e.target.checked) }} />
                  <span className='checkbox-box'>{autoSaveWrong ? '✓' : ''}</span>
                  <span className='checkbox-label'>错题自动加入错题本</span>
                </label>
              </>
            ) : (
              <>
                <Button variant='default' onClick={function () { setQuizGraded(false) }}>重新作答</Button>
                <Button variant='primary' onClick={saveWrongToMistakes}>错题加入错题本</Button>
                <Button variant='default' onClick={saveQuizToBank}>保存到题库</Button>
              </>
            )}
          </div>
        </section>
      ) : null}

      <section className='chat-section'>
        <div className='chat-sessions'>
          <div className='chat-sessions-head'>
            <span><MessageCircle size={14} /> 对话</span>
            <Button variant='ghost' onClick={newSession}>+ 新建</Button>
          </div>
          <div className='chat-session-list'>
            {sessions.map(function (s) {
              return (
                <div key={s.id} className={activeId === s.id ? 'chat-session active' : 'chat-session'}>
                  <button className='chat-session-title' onClick={function () { selectSession(s.id) }} title={s.title}>{s.title}</button>
                  <button className='chat-session-del' onClick={function () { removeSession(s.id) }} title='删除对话'>✕</button>
                </div>
              )
            })}
          </div>
        </div>
        <div className='chat-messages'>
          {messages.length === 0 ? (
            <EmptyState title='向 AI 提问吧' hint='例如：「用通俗的话解释一下极限的定义」' color='var(--c-ai)' />
          ) : (
            messages.map(function (msg, i) {
              return (
                <div key={String(i)} className={'chat-msg ' + msg.role}>
                  <div className='chat-msg-content'>{msg.content}</div>
                </div>
              )
            })
          )}
          {busy ? <div className='chat-msg assistant'><div className='chat-msg-content'>思考中...</div></div> : null}
          <div ref={messagesEndRef} />
        </div>
        <div className='chat-input-row'>
          <Input value={input} onChange={setInput} placeholder='输入你的问题，回车发送' className='chat-input' />
          <Button variant='primary' onClick={send} disabled={busy || !input.trim()}>发送</Button>
        </div>
      </section>
    </div>
  )
}














