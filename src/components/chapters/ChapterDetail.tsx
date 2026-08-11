import { useEffect, useRef, useState } from 'react'
import { CalendarDays, FileQuestion, Highlighter, Layers, Lightbulb, Sparkles, Timer } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { useChapters } from '../../stores/ChapterContext'
import { useReflections } from '../../stores/ReflectionContext'
import { useApp } from '../../stores/AppContext'
import { usePomodoro } from '../../stores/PomodoroContext'
import { createDb } from '../../lib/db'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { formatDuration, uid } from '../../lib/utils'
import type { Subject } from '../../types'

function formatStudy(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const pad = function (n: number) { return n < 10 ? '0' + String(n) : String(n) }
  return pad(m) + ':' + pad(s)
}

export default function ChapterDetail() {
  const { chapters, textbooks, selectedId, selectChapter, getChapter, toggleChapterComplete, updateChapterContent, deleteChapter } = useChapters()
  const { saveReflection } = useReflections()
  const { dataVersion, setActivePage } = useApp()
  const { startForTask } = usePomodoro()
  const chapter = selectedId ? getChapter(selectedId) : undefined
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [aiBusy, setAiBusy] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [showAi, setShowAi] = useState(false)
  const [notice, setNotice] = useState('')
  const [relCards, setRelCards] = useState({ total: 0, due: 0 })
  const [relMistakes, setRelMistakes] = useState(0)
  const [relReflections, setRelReflections] = useState<{ id: string; title: string }[]>([])
  const contentRef = useRef<HTMLTextAreaElement | null>(null)

  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedText, setSavedText] = useState('')
  const [studySeconds, setStudySeconds] = useState(0)
  const [studying, setStudying] = useState(false)
  const studyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(0)
  const skipSave = useRef(false)

  useEffect(function () {
    if (chapter) {
      skipSave.current = true
      setTitle(chapter.title)
      setTags(chapter.tags.join(', '))
      setContent(chapter.content)
    }
  }, [selectedId])

  useEffect(function () {
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
  }, [])

  useEffect(function () {
    if (!chapter) return
    let alive = true
    createDb().getCards().then(function (list) {
      if (!alive || !chapter) return
      const mine = list.filter(function (c) { return c.chapterId === chapter.id })
      const today = new Date().toISOString().slice(0, 10)
      const dueCount = mine.filter(function (c) { return c.status === 'new' || c.due.slice(0, 10) <= today }).length
      setRelCards({ total: mine.length, due: dueCount })
    }).catch(function () {})
    createDb().getMistakes().then(function (list) {
      if (!alive || !chapter) return
      setRelMistakes(list.filter(function (m) { return m.chapterId === chapter.id }).length)
    }).catch(function () {})
    createDb().getReflections().then(function (list) {
      if (!alive || !chapter) return
      setRelReflections(list.filter(function (r) { return r.chapterId === chapter.id }).map(function (r) { return { id: r.id, title: r.title } }))
    }).catch(function () {})
    return function () { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, dataVersion])

  const save = function () {
    if (!chapter) return
    const tagList = tags.split(',').map(function (t) { return t.trim() }).filter(Boolean)
    updateChapterContent(chapter.id, { title, tags: tagList, content })
    setSaved(true)
    setSavedText('已保存 ✓')
    setTimeout(function () { setSaved(false) }, 1500)
  }

  useEffect(function () {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    const t = setTimeout(function () { save() }, 800)
    return function () { clearTimeout(t) }
  }, [title, tags, content])

  useEffect(function () {
    return function () {
      if (studyTimerRef.current) {
        clearInterval(studyTimerRef.current)
      }
    }
  }, [])

  const toggleStudy = function () {
    if (studying) {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000)
      if (studyTimerRef.current) {
        clearInterval(studyTimerRef.current)
        studyTimerRef.current = null
      }
      setStudying(false)
      setStudySeconds(0)
      if (chapter && elapsed >= 60) {
        const mins = Math.max(1, Math.round(elapsed / 60))
        updateChapterContent(chapter.id, { studyMinutes: (chapter.studyMinutes || 0) + mins })
      }
    } else {
      startRef.current = Date.now()
      setStudying(true)
      studyTimerRef.current = setInterval(function () {
        setStudySeconds(function (s) { return s + 1 })
      }, 1000)
    }
  }

  const handleDelete = async function () {
    if (!chapter) return
    const ok = window.confirm('确定删除章节「' + chapter.title + '」吗？')
    if (ok) {
      await deleteChapter(chapter.id)
    }
  }

  const showNotice = function (msg: string) {
    setNotice(msg)
    setTimeout(function () { setNotice('') }, 2500)
  }

  const subjectOfChapter = function (): Subject | undefined {
    if (!chapter) return undefined
    const tb = textbooks.find(function (t) { return t.id === chapter.textbookId })
    if (!tb) return undefined
    return subjects.find(function (s) { return s.id === tb.subjectId })
  }

  const startFocus = function () {
    if (!chapter) return
    startForTask({ id: 'ch-focus-' + chapter.id, text: '学习：' + chapter.title, subjectId: subjectOfChapter() ? subjectOfChapter()!.id : undefined })
    setActivePage('pomodoro')
  }

  const handleSchedule = async function () {
    if (!chapter) return
    const created = await createDb().scheduleEbbinghaus(chapter.id)
    if (created.length > 0) {
      showNotice('已安排 ' + created.length + ' 次复习（第 1/2/4/7/15/30 天），可到「每日必做」查看')
    } else {
      showNotice('复习计划已存在，无需重复安排')
    }
  }

  const handleClozeCard = async function () {
    if (!chapter || !contentRef.current) return
    const ta = contentRef.current
    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (start === end) {
      showNotice('请先在内容里选中要挖空的文字')
      return
    }
    const phrase = content.slice(start, end).trim()
    if (!phrase) return
    const before = content.slice(0, start)
    const after = content.slice(end)
    const lineStart = before.lastIndexOf('\n') + 1
    const nl = after.indexOf('\n')
    const lineEnd = nl === -1 ? content.length : end + nl
    const line = content.slice(lineStart, lineEnd)
    const now = new Date().toISOString()
    await createDb().saveCard({
      id: uid('card'),
      front: '【挖空】' + line.replace(phrase, '______'),
      back: phrase,
      chapterId: chapter.id,
      subjectId: subjectOfChapter() ? subjectOfChapter()!.id : undefined,
      status: 'new',
      due: now,
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      createdAt: now,
      updatedAt: now,
    })
    showNotice('已生成挖空卡片 ✓')
  }

  const handleMakeCard = async function () {
    if (!chapter) return
    const now = new Date().toISOString()
    const tb = textbooks.find(function (t) { return t.id === chapter.textbookId })
    await createDb().saveCard({
      id: uid('card'),
      front: chapter.title,
      back: chapter.content.slice(0, 300),
      chapterId: chapter.id,
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
    showNotice('已生成 1 张复习卡片，可到「复习卡片」页学习')
  }

  const handleAiSummary = async function () {
    if (!chapter) return
    setAiBusy(true)
    setAiResult('AI 总结中，请稍候...')
    const result = await createDb().aiChat([
      { role: 'system', content: '你是一名学习助手。请用简洁的中文总结以下章节的核心知识点、重点公式与易错点，控制在 300 字以内。' },
      { role: 'user', content: chapter.title + '\n\n' + chapter.content.slice(0, 4000) },
    ])
    setAiResult(result)
    setAiBusy(false)
    setShowAi(true)
  }

  const saveAiAsReflection = async function () {
    if (!chapter) return
    await saveReflection({
      title: 'AI 总结：' + chapter.title,
      content: aiResult,
      chapterId: chapter.id,
      subjectId: subjectOfChapter() ? subjectOfChapter()!.id : undefined,
    })
    setShowAi(false)
    showNotice('已保存到「学习心得」✓')
  }

  const handleImportMarkdown = async function () {
    if (!chapter || !window.electronAPI) return
    const result = await window.electronAPI.importChapterMarkdown()
    if (!result) return
    setContent(result.content)
    if (result.title) {
      setTitle(result.title)
    }
    showNotice('已导入 Markdown ✓')
  }

  const handleExport = function () {
    if (!chapter || !window.electronAPI) return
    window.electronAPI.exportChapterToMarkdown(chapter.id).then(function (p) {
      if (p && p !== 'cancelled' && p !== 'not found') {
        setSavedText('已导出：' + p)
        setSaved(true)
        setTimeout(function () { setSaved(false) }, 3000)
      }
    }).catch(function () {})
  }

  if (!chapter) {
    return <div className='page-empty'>未找到章节</div>
  }

  const related = chapters.filter(function (c) {
    return c.parentId === chapter.id || (chapter.parentId ? c.id === chapter.parentId : false)
  })

  const openCardsForChapter = function () {
    if (!chapter) return
    window.dispatchEvent(new CustomEvent('study:cards-filter', { detail: chapter.id }))
    setActivePage('cards')
  }

  // ---- 智能"下一步"：只推荐当前最有价值的一个动作 ----
  const nextStep = (function () {
    if (!chapter) return null
    if (relCards.due > 0) {
      return {
        icon: '📌', label: '有 ' + relCards.due + ' 张卡片到期，趁热先复习记得牢',
        text: '去复习 →', variant: 'primary' as const, action: openCardsForChapter,
      }
    }
    if (relCards.total === 0 && content.trim()) {
      return {
        icon: '🎴', label: '本章还没生成卡片，学完沉淀成可复习的知识点',
        text: '生成卡片', variant: 'primary' as const, action: function () { handleMakeCard() },
      }
    }
    if (relReflections.length === 0) {
      return {
        icon: '💡', label: '学完写一句心得，把今天收进自己的知识脉络',
        text: '去写心得 →', variant: 'default' as const, action: function () { setActivePage('reflections') },
      }
    }
    return null
  })()

  return (
    <div className='chapter-detail'>
      <div className='detail-toolbar'>
        <Button variant='ghost' onClick={function () { selectChapter(null) }}>← 返回列表</Button>
        <div className='detail-toolbar-right'>
          {saved ? <span className='save-hint'>{savedText}</span> : null}
          {notice ? <span className='save-hint'>{notice}</span> : null}
          <Button variant='ghost' onClick={handleImportMarkdown} disabled={!window.electronAPI} title='从 .md 文件导入内容'>📥 导入</Button>
          <Button variant='ghost' onClick={handleSchedule} title='按艾宾浩斯曲线安排 1/2/4/7/15/30 天复习'>🗓 安排复习</Button>
          <Button variant='ghost' onClick={handleMakeCard} title='为本章节生成一张复习卡片'><Layers size={13} /> 生成卡片</Button>
          <Button variant='ghost' onClick={handleClozeCard} title='选中内容里的关键词，一键挖空成复习卡片'>💡 挖空成卡</Button>
          <Button variant='ghost' onClick={handleAiSummary} disabled={aiBusy} title='使用 AI 总结本章节（需在设置中配置 API）'>🤖 AI 总结</Button>
          <Button variant='ghost' onClick={handleExport} disabled={!window.electronAPI} title='导出为 Markdown 文件'>导出</Button>
          <Button variant='danger' onClick={handleDelete}>删除</Button>
        </div>
      </div>
      <div className='detail-header'>
        <div className='detail-title-row'>
          <Input value={title} onChange={setTitle} className='detail-title-input' placeholder='章节标题' />
          {subjectOfChapter() ? (
            <span className='subject-chip' style={{ background: subjectOfChapter()!.color + '22', color: subjectOfChapter()!.color }}>
              {subjectOfChapter()!.name}
            </span>
          ) : null}
        </div>
        <Input value={tags} onChange={setTags} className='detail-tags-input' placeholder='标签，用逗号分隔' />
      </div>
      <div className='detail-status'>
        <div className='detail-status-item'><Timer size={13} /> 已学 <b>{formatDuration(chapter ? chapter.studyMinutes || 0 : 0)}</b></div>
        <div className='detail-status-item'><Layers size={13} /> 相关卡片 <b>{relCards.total}</b> 张{relCards.due > 0 ? <em className='status-warn'> · {relCards.due} 张待复习</em> : null}</div>
        <div className='detail-status-item'><FileQuestion size={13} /> 相关错题 <b>{relMistakes}</b> 题</div>
        {nextStep ? (
          <div className='next-step-bar'>
            <span className='next-step-label'>{nextStep.icon} {nextStep.label}</span>
            <Button variant={nextStep.variant} onClick={function () { nextStep.action() }}>{nextStep.text}</Button>
          </div>
        ) : relCards.total > 0 ? (
          <div className='detail-status-tip'>✅ 本课卡片都复习完了，可以放心学新章节</div>
        ) : null}
      </div>
      <div className='detail-backrefs'>
        <span className='detail-backref-label'>关联回看</span>
        {relReflections.length > 0 ? (
          <button className='detail-backref-chip' onClick={function () { setActivePage('reflections') }}><Lightbulb size={12} /> 心得 {relReflections.length} 篇</button>
        ) : null}
        {relCards.total > 0 ? (
          <button className='detail-backref-chip' onClick={function () { setActivePage('cards') }}><Layers size={12} /> 卡片 {relCards.total} 张{relCards.due > 0 ? '（待复习 ' + relCards.due + '）' : ''}</button>
        ) : null}
        {relMistakes > 0 ? (
          <button className='detail-backref-chip' onClick={function () { setActivePage('mistakes') }}><FileQuestion size={12} /> 错题 {relMistakes} 题</button>
        ) : null}
        {relReflections.length === 0 && relCards.total === 0 && relMistakes === 0 ? (
          <span className='detail-backref-empty'>还没有关联内容，学完可生成卡片或写心得</span>
        ) : null}
      </div>
      <div className='detail-editor'>
        <textarea
          className='detail-textarea'
          ref={contentRef}
          value={content}
          onChange={function (e) { setContent(e.target.value) }}
          placeholder={'支持 Markdown 与 LaTeX（KaTeX）公式，如 ' + String.fromCharCode(36) + String.fromCharCode(36) + ' f(x) = \\int_a^b g(t) dt ' + String.fromCharCode(36) + String.fromCharCode(36)}
          spellCheck={false}
        />
        <div className='detail-preview'>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
      {related.length > 0 ? (
        <div className='detail-related'>
          <h4>关联知识点</h4>
          {related.map(function (c) {
            return (
              <button key={c.id} className='related-chip' onClick={function () { selectChapter(c.id) }}>
                {c.title}
              </button>
            )
          })}
        </div>
      ) : null}
      {showAi ? (
        <Modal onClose={function () { setShowAi(false) }} className='ai-summary-modal'>
          <h3><Sparkles size={15} /> AI 总结</h3>
          <div className='ai-summary-content'>{aiResult}</div>
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () { setShowAi(false) }}>关闭</Button>
            <Button variant='primary' onClick={saveAiAsReflection}>保存为心得</Button>
          </div>
        </Modal>
      ) : null}

      <div className='detail-footer'>
        <Button variant='default' onClick={startFocus} title='用番茄钟专注学习这一章，结束后可顺手记心得'><Timer size={13} /> 番茄专注这一章</Button>
        <div className='study-timer'>
          <Button variant={studying ? 'danger' : 'primary'} onClick={toggleStudy}>
            {studying ? '停止学习计时' : '开始学习计时'}
          </Button>
          <span className='study-timer-display'>
            本次学习 {formatStudy(studySeconds)} · 累计 {formatDuration(chapter.studyMinutes)}
          </span>
        </div>
        <Button variant='primary' onClick={async function () {
          const planned = await toggleChapterComplete(chapter.id)
          if (!chapter.completed) {
            if (planned) {
              showNotice('✅ 已自动安排复习计划 + 生成卡片，去「今日必做」开始复习')
            } else {
              showNotice('已标记完成 ✓ 需要复习计划？可到设置开启「章节完成时自动安排复习」')
            }
          }
        }}>
          {chapter.completed ? '标记为未完成' : '✓ 标记完成'}
        </Button>
      </div>
    </div>
  )
}





