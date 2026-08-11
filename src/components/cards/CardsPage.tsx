import { useEffect, useState } from 'react'
import { Archive, BookOpen, CalendarDays, FileQuestion, Layers, Sparkles, StickyNote } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { createDb } from '../../lib/db'
import { useApp } from '../../stores/AppContext'
import { useChapters } from '../../stores/ChapterContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { formatDate, todayKey, uid } from '../../lib/utils'
import type { Mistake, ReviewCard, Subject } from '../../types'

interface ParsedCard {
  front: string
  back: string
}

function parseCards(raw: string): ParsedCard[] {
  const m = raw.match(/\[[\s\S]*\]/)
  if (!m) {
    return []
  }
  try {
    const arr = JSON.parse(m[0])
    if (!Array.isArray(arr)) {
      return []
    }
    return arr
      .filter(function (x) { return x && typeof x.front === 'string' && typeof x.back === 'string' })
      .map(function (x) { return { front: String(x.front), back: String(x.back) } })
  } catch (e) {
    return []
  }
}

const GRADE_BUTTONS = [
  { grade: 0, label: '重来', cls: 'danger' },
  { grade: 1, label: '困难', cls: 'default' },
  { grade: 2, label: '良好', cls: 'primary' },
  { grade: 3, label: '简单', cls: 'primary' },
]

export default function CardsPage() {
  const { dataVersion, setActivePage } = useApp()
  const { chapters, textbooks } = useChapters()
  const [due, setDue] = useState<ReviewCard[]>([])
  const [cards, setCards] = useState<ReviewCard[]>([])
  const [index, setIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const [open, setOpen] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectFilter, setSubjectFilter] = useState('')
  const [chapterFilter, setChapterFilter] = useState('')
  const [editCard, setEditCard] = useState<ReviewCard | null>(null)
  const [editNote, setEditNote] = useState('')
  const [mistakeMsg, setMistakeMsg] = useState('')
  const [failStreak, setFailStreak] = useState(0)
  const [lastFailed, setLastFailed] = useState<ReviewCard | null>(null)
  const [stuckMsg, setStuckMsg] = useState('')
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizItems, setQuizItems] = useState<{ q: string; options: string[]; answer: number; cardId: string }[]>([])
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizGraded, setQuizGraded] = useState(false)
  const [quizMsg, setQuizMsg] = useState('')

  const load = function () {
    createDb().getDueCards(50).then(function (list) {
      setDue(list)
      setIndex(0)
      setShowBack(false)
    }).catch(function () {})
    createDb().getCards().then(function (list) { setCards(list) }).catch(function () {})
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
  }

  const subjectName = function (id?: string): string {
    const s = subjects.find(function (x) { return x.id === id })
    return s ? s.name : ''
  }
  const chapterTitle = function (id?: string): string {
    if (!id) return ''
    const ch = chapters.find(function (x) { return x.id === id })
    return ch ? ch.title : ''
  }

  useEffect(function () {
    load()
  }, [dataVersion])

  useEffect(function () {
    const onFocus = function (e: Event) {
      const id = (e as CustomEvent<string>).detail
      if (id) {
        setChapterFilter(id)
        setChapterId(id)
      }
    }
    window.addEventListener('study:cards-filter', onFocus)
    return function () { window.removeEventListener('study:cards-filter', onFocus) }
  }, [])

  // 复习快捷键：空格翻面，1-4 评级（重来/困难/良好/简单）
  useEffect(function () {
    const onKey = function (e: KeyboardEvent) {
      if (due.length === 0) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // 捕获阶段优先处理，避免与全局「1-9 切换导航」快捷键冲突
      e.stopImmediatePropagation()
      if (e.code === 'Space') {
        e.preventDefault()
        setShowBack(function (v) { return !v })
        return
      }
      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        const g = GRADE_BUTTONS[parseInt(e.key, 10) - 1]
        if (g) grade(g.grade)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return function () { window.removeEventListener('keydown', onKey, true) }
  }, [due, index])

  const grade = async function (g: number) {
    const card = due[index]
    if (!card) return
    await createDb().gradeCard(card.id, g)
    if (g === 0) {
      setFailStreak(function (n) {
        const next = n + 1
        if (next >= 2) {
          setLastFailed(card)
          setStuckMsg('这张卡连续两次没记住，复习效果有限')
        } else {
          setLastFailed(card)
          setStuckMsg('')
        }
        return next
      })
    } else {
      setFailStreak(0)
      setStuckMsg('')
    }
    setDue(function (prev) {
      const next = prev.slice()
      next.splice(index, 1)
      return next
    })
    setShowBack(false)
    setCards(function (prev) {
      return prev.filter(function (c) { return c.id !== card.id })
    })
  }

  const addCurrentToMistakes = async function () {
    if (!current) return
    const now = new Date().toISOString()
    const mistake: Mistake = {
      id: uid('mist'),
      question: current.front,
      correctAnswer: current.back,
      chapterId: current.chapterId,
      subjectId: current.subjectId,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    }
    await createDb().saveMistake(mistake)
    setMistakeMsg('已加入错题本 ✓（可在错题本复习）')
    setTimeout(function () { setMistakeMsg('') }, 2600)
  }

  const addStuckToMistakes = async function () {
    if (!lastFailed) return
    const now = new Date().toISOString()
    const mistake: Mistake = {
      id: uid('mist'),
      question: lastFailed.front,
      correctAnswer: lastFailed.back,
      chapterId: lastFailed.chapterId,
      subjectId: lastFailed.subjectId,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    }
    await createDb().saveMistake(mistake)
    setStuckMsg('已加入错题本 ✓ 建议重写背面，让它更好记')
    setLastFailed(null)
  }

  const buildQuiz = function () {
    const pool = due.length > 0 ? due : cards
    const source = pool.slice(0, 10)
    if (source.length < 2) {
      setQuizMsg('至少需要 2 张卡片才能自测')
      setTimeout(function () { setQuizMsg('') }, 2400)
      return
    }
    const items = source.map(function (c) {
      const distractors = cards
        .filter(function (x) { return x.id !== c.id && x.back !== c.back })
        .map(function (x) { return x.back })
        .filter(function (b, i, arr) { return arr.indexOf(b) === i })
        .slice(0, 3)
      const options = [c.back].concat(distractors).sort(function () { return Math.random() - 0.5 })
      return { q: c.front, options: options.length >= 2 ? options : [c.back, '（答案见卡片）'], answer: options.length >= 2 ? options.indexOf(c.back) : 0, cardId: c.id }
    })
    setQuizItems(items)
    setQuizAnswers(new Array(items.length).fill(-1))
    setQuizGraded(false)
    setQuizMsg('')
    setQuizOpen(true)
  }

  const gradeQuiz = function () {
    const score = quizItems.filter(function (it, i) { return quizAnswers[i] === it.answer }).length
    setQuizGraded(true)
    setQuizMsg('得分 ' + score + ' / ' + quizItems.length + (score === quizItems.length ? '，全对！小咕给你记一功 🎉' : ''))
  }

  const addQuizWrongToMistakes = async function () {
    let added = 0
    for (let i = 0; i < quizItems.length; i++) {
      if (quizAnswers[i] !== quizItems[i].answer) {
        const card = cards.find(function (x) { return x.id === quizItems[i].cardId })
        const now = new Date().toISOString()
        await createDb().saveMistake({
          id: uid('mist'),
          question: quizItems[i].q,
          correctAnswer: quizItems[i].options[quizItems[i].answer],
          chapterId: card ? card.chapterId : undefined,
          subjectId: card ? card.subjectId : undefined,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        })
        added += 1
      }
    }
    setQuizMsg('已将 ' + added + ' 道错题加入错题本 ✓')
  }

  const createCard = async function () {
    if (!front.trim()) {
      return
    }
    const now = new Date().toISOString()
    const card: ReviewCard = {
      id: uid('card'),
      front: front.trim(),
      back: back.trim(),
      status: 'new',
      due: now,
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      createdAt: now,
      updatedAt: now,
    }
    await createDb().saveCard(card)
    setOpen(false)
    setFront('')
    setBack('')
    load()
  }

  const subjectForChapter = function (chId: string): string | undefined {
    const ch = chapters.find(function (c) { return c.id === chId })
    if (!ch) return undefined
    const tb = textbooks.find(function (t) { return t.id === ch.textbookId })
    return tb ? tb.subjectId : undefined
  }

  const generateFromChapter = async function (useAi: boolean) {
    const ch = chapters.find(function (c) { return c.id === chapterId })
    if (!ch) return
    const now = new Date().toISOString()
    const subjectId = subjectForChapter(ch.id)
    if (!useAi) {
      const card: ReviewCard = {
        id: uid('card'),
        front: ch.title,
        back: ch.content.slice(0, 300),
        chapterId: ch.id,
        subjectId,
        status: 'new',
        due: now,
        intervalDays: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        createdAt: now,
        updatedAt: now,
      }
      await createDb().saveCard(card)
      setAiMessage('已创建 1 张章节卡片 ✓')
      load()
      return
    }
    setAiBusy(true)
    setAiMessage('AI 生成中，请稍候...')
    const prompt = '请根据以下章节内容，提炼 5 个适合间隔重复复习的知识卡片。只输出 JSON 数组，格式：[{  front: 问题, back: 答案 }]，不要输出其它内容。\n\n章节标题：' + ch.title + '\n\n内容：\n' + ch.content.slice(0, 3000)
    const raw = await createDb().aiChat([{ role: 'user', content: prompt }])
    const parsed = parseCards(raw)
    if (parsed.length === 0) {
      setAiMessage('AI 未返回有效卡片：' + raw.slice(0, 160))
      setAiBusy(false)
      return
    }
    for (const item of parsed) {
      const card: ReviewCard = {
        id: uid('card'),
        front: item.front,
        back: item.back,
        chapterId: ch.id,
        subjectId,
        status: 'new',
        due: now,
        intervalDays: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        createdAt: now,
        updatedAt: now,
      }
      await createDb().saveCard(card)
    }
    setAiMessage('AI 已生成 ' + parsed.length + ' 张卡片 ✓')
    setAiBusy(false)
    load()
  }

  const todayReviewed = cards.filter(function (c) { return c.lastReviewedAt && c.lastReviewedAt.slice(0, 10) === todayKey() }).length
  const todayDueTotal = todayReviewed + due.length
  const reviewPct = todayDueTotal > 0 ? Math.min(100, Math.round((todayReviewed / todayDueTotal) * 100)) : 100
  const current = due[index]

  const visibleCards = cards.filter(function (c) {
    if (subjectFilter && c.subjectId !== subjectFilter) return false
    if (chapterFilter && c.chapterId !== chapterFilter) return false
    return true
  })

  return (
    <div className='cards-page'>
      <div className='page-header'>
        <h2><Layers size={18} /> 复习卡片</h2>
        <div className='cards-header-actions'>
          <Button variant='primary' onClick={function () { setOpen(true) }}>+ 新建卡片</Button>
          <Button variant='ghost' onClick={async function () {
            const p = await createDb().exportCardsCsv()
            if (p && p !== 'cancelled') window.alert('卡片已导出：' + p)
          }}>导出 CSV</Button>
          <Button variant='ghost' onClick={buildQuiz} title='根据卡片生成选择题自测'><FileQuestion size={13} /> 自测</Button>
          <Button variant='ghost' onClick={load}>刷新</Button>
        </div>
      </div>

      <section className='review-section'>
        <div className='review-head'>
          <h3><CalendarDays size={15} /> 今日待复习（{due.length}）</h3>
          <div className='review-ring-wrap'>
            <svg viewBox='0 0 36 36' className='review-ring'>
              <circle cx='18' cy='18' r='15.9' className='review-ring-bg' />
              <circle cx='18' cy='18' r='15.9' className='review-ring-fg' style={{ strokeDasharray: reviewPct + ' 100' }} />
            </svg>
            <span className='review-ring-text'>{reviewPct}%</span>
            <span className='review-ring-label'>今日已复习 {todayReviewed} 张</span>
          </div>
        </div>
        {current ? (
          <div className='review-card-box'>
            <div className='review-front'>{current.front}</div>
            {!showBack ? (
              <Button variant='primary' onClick={function () { setShowBack(true) }}>显示答案</Button>
            ) : (
              <>
                <div className='review-back'>{current.back}</div>
                <div className='review-to-mistake'>
                  <button onClick={addCurrentToMistakes}>这题没记住？加入错题本</button>
                  {mistakeMsg ? <span className='mistake-msg'>{mistakeMsg}</span> : null}
                </div>
                <div className='review-grades'>
                  {GRADE_BUTTONS.map(function (g, i) {
                    return (
                      <Button key={String(g.grade)} variant={g.cls as 'default'} onClick={function () { grade(g.grade) }}>
                        {g.label} <kbd className='grade-key'>{i + 1}</kbd>
                      </Button>
                    )
                  })}
                </div>
              </>
            )}
            <div className='review-meta'>
              第 {index + 1} / {due.length} 张 · 已复习 {current.reps} 次 · 下次间隔 {current.intervalDays > 0 ? current.intervalDays + ' 天' : '今天'}
              <span className='review-meta-keys'>空格翻面 · 1-4 评级</span>
            </div>
          </div>
        ) : (
          <EmptyState title='今天没有到期卡片' hint='到期卡片都清空啦，小咕给你记一功' color='var(--c-cards)' />
        )}
      </section>

      {stuckMsg ? (
        <div className='stuck-banner'>
          <span>{stuckMsg}</span>
          {lastFailed ? (
            <div className='stuck-actions'>
              <Button variant='default' onClick={addStuckToMistakes}>① 加入错题本</Button>
              <Button variant='ghost' onClick={function () { setStuckMsg('') }}>忽略</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className='generate-section'>
        <h3><Sparkles size={15} /> 从章节生成卡片</h3>
        <div className='generate-row'>
          <select className='select-input' value={chapterId} onChange={function (e) { setChapterId(e.target.value) }}>
            <option value=''>选择章节...</option>
            {chapters.map(function (c) {
              return <option key={c.id} value={c.id}>{c.title}</option>
            })}
          </select>
          <Button variant='default' disabled={!chapterId || aiBusy} onClick={function () { generateFromChapter(false) }}>手动生成</Button>
          <Button variant='primary' disabled={!chapterId || aiBusy} onClick={function () { generateFromChapter(true) }}>{aiBusy ? '生成中...' : '🤖 AI 生成'}</Button>
        </div>
        {aiMessage ? <p className='ai-message'>{aiMessage}</p> : null}
      </section>

      {quizOpen ? (
        <Modal onClose={function () { setQuizOpen(false) }} className='quiz-modal'>
          <h3><FileQuestion size={15} /> 卡片自测</h3>
          <p className='quiz-modal-desc'>根据你的卡片生成的选择题：看题目回忆答案，选对即掌握。</p>
          {quizItems.map(function (it, i) {
            return (
              <div key={String(i)} className={'quiz-item' + (quizGraded ? (quizAnswers[i] === it.answer ? ' correct' : ' wrong') : '')}>
                <div className='quiz-q'>{i + 1}. {it.q}</div>
                <div className='quiz-options'>
                  {it.options.map(function (opt, oi) {
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
                        {quizGraded && oi === it.answer ? <span className='quiz-mark'>✓</span> : null}
                        {quizGraded && quizAnswers[i] === oi && oi !== it.answer ? <span className='quiz-mark wrong-mark'>✗</span> : null}
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
                <Button variant='primary' onClick={gradeQuiz} disabled={quizAnswers.some(function (a) { return a === -1 })}>提交批改</Button>
                <Button variant='ghost' onClick={function () { setQuizOpen(false) }}>取消</Button>
              </>
            ) : (
              <>
                <span className='save-hint'>{quizMsg}</span>
                <Button variant='default' onClick={function () { setQuizGraded(false) }}>重新作答</Button>
                <Button variant='primary' onClick={addQuizWrongToMistakes}>错题加入错题本</Button>
                <Button variant='ghost' onClick={function () { setQuizOpen(false) }}>关闭</Button>
              </>
            )}
          </div>
        </Modal>
      ) : null}

      <section className='card-list-section'>
        <div className='card-list-head'>
          <h3><Archive size={15} /> 全部卡片（{cards.length}）</h3>
          <div className='card-filters'>
            <select className='select-input card-subject-filter' value={subjectFilter} onChange={function (e) { setSubjectFilter(e.target.value) }}>
              <option value=''>全部科目</option>
              {subjects.map(function (s) {
                return <option key={s.id} value={s.id}>{s.name}</option>
              })}
            </select>
            <select className='select-input card-chapter-filter' value={chapterFilter} onChange={function (e) { setChapterFilter(e.target.value) }}>
              <option value=''>全部章节</option>
              {chapters.map(function (ch) {
                return <option key={ch.id} value={ch.id}>{ch.title}</option>
              })}
            </select>
          </div>
        </div>
        {visibleCards.length === 0 ? (
          <EmptyState title='还没有复习卡片' hint='从章节一键生成，小咕帮你安排复习节奏' color='var(--c-cards)' />
        ) : (
          <ul className='card-list'>
            {visibleCards.map(function (c) {
              return (
                <li key={c.id} className='card-item'>
                  <div className='card-item-main'>
                    <div className='card-item-front'>{c.front}</div>
                    <div className='card-item-back'>{c.back}</div>
                    {c.note ? <div className='card-item-note'>📝 {c.note}</div> : null}
                    <div className='card-item-chips'>
                      {chapterTitle(c.chapterId) ? <span className='card-chapter-chip'><BookOpen size={11} /> {chapterTitle(c.chapterId)}</span> : null}
                      {subjectName(c.subjectId) ? <span className='subject-chip' style={{ background: '#eef2ff', color: '#4f46e5' }}>{subjectName(c.subjectId)}</span> : null}
                      {c.mistakeId ? (
                        <button className='card-mistake-chip' onClick={function () { setActivePage('mistakes') }}><FileQuestion size={12} /> 来自错题</button>
                      ) : null}
                    </div>
                  </div>
                  <div className='card-item-meta'>
                    <span className={'card-status ' + c.status}>{c.status === 'new' ? '新' : c.status === 'learning' ? '学习中' : '复习'}</span>
                    <span>间隔 {c.intervalDays}d · 难度 {(c.difficulty || 5).toFixed(1)}/10</span>
                    <span>下次 {formatDate(c.due)}</span>
                  </div>
                  <Button variant='ghost' onClick={function () {
                    setEditCard(c)
                    setEditNote(c.note || '')
                  }}>批注</Button>
                  <Button variant='danger' onClick={async function () {
                    await createDb().deleteCard(c.id)
                    load()
                  }}>删除</Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {editCard ? (
        <Modal onClose={function () { setEditCard(null) }} className='card-modal'>
          <h3><StickyNote size={15} /> 卡片批注</h3>
          <div className='card-modal-front'>{editCard.front}</div>
          <textarea className='reflection-content-input' value={editNote} onChange={function (e) { setEditNote(e.target.value) }} placeholder='写下你的批注、联想、易错提醒...' />
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () { setEditCard(null) }}>取消</Button>
            <Button variant='primary' onClick={async function () {
              await createDb().saveCard(Object.assign({}, editCard, { note: editNote.trim() || undefined }))
              setEditCard(null)
              load()
            }}>保存批注</Button>
          </div>
        </Modal>
      ) : null}

      {open ? (
        <Modal onClose={function () { setOpen(false) }} className='card-modal'>
          <h3>新建复习卡片</h3>
          <Input value={front} onChange={setFront} placeholder='正面（问题/术语）' autoFocus />
          <textarea
            className='reflection-content-input'
            value={back}
            onChange={function (e) { setBack(e.target.value) }}
            placeholder='背面（答案/解释）'
          />
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () { setOpen(false) }}>取消</Button>
            <Button variant='primary' onClick={createCard}>保存</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}




