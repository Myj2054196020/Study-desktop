import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { BarChart3, BookOpen, CalendarDays, FileQuestion, Layers, Library, Lightbulb, ListChecks, MonitorPlay, Network, Settings, Sparkles, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useApp } from '../../stores/AppContext'
import { useSearch } from '../../stores/SearchContext'
import { useChapters } from '../../stores/ChapterContext'
import { highlightParts } from '../../lib/search'
import type { AppPage, SearchResult } from '../../types'
import { classNames, todayKey } from '../../lib/utils'
import { createDb } from '../../lib/db'

export default function SearchModal() {
  const { searchOpen, closeSearch, setActivePage } = useApp()
  const { query, results, isLoading, setQuery, clear } = useSearch()
  const { selectChapter } = useChapters()
  const [activeIndex, setActiveIndex] = useState(0)
  const [today, setToday] = useState({ pomodoro: 0, tasksDone: 0, tasksTotal: 0, reviewed: 0, due: 0, mistakes: 0, reflections: 0 })
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(function () {
    if (searchOpen) {
      setActiveIndex(0)
      const key = todayKey()
      Promise.all([
        createDb().getPomodoroHistory(),
        createDb().getDailyTasks(),
        createDb().getDueCards(50),
        createDb().getCards(),
        createDb().getMistakes(),
        createDb().getReflections(),
      ]).then(function (r) {
        const pomodoro = r[0].filter(function (x) { return x.completed && x.startTime.slice(0, 10) === key }).length
        const tasksTotal = r[1].length
        const tasksDone = r[1].filter(function (x) { return x.completed }).length
        const due = r[2].length
        const reviewed = r[3].filter(function (x) { return x.lastReviewedAt && x.lastReviewedAt.slice(0, 10) === key }).length
        const mistakes = r[4].filter(function (x) { return x.createdAt.slice(0, 10) === key }).length
        const reflections = r[5].filter(function (x) { return x.createdAt.slice(0, 10) === key }).length
        setToday({ pomodoro, tasksDone, tasksTotal, reviewed, due, mistakes, reflections })
      }).catch(function () {})
      const t = setTimeout(function () {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 30)
      return function () { clearTimeout(t) }
    }
  }, [searchOpen])

  if (!searchOpen) {
    return null
  }

  const COMMANDS: { kw: string; label: string; page: string; icon: LucideIcon }[] = [
    { kw: '番茄', label: '番茄钟', page: 'pomodoro', icon: Timer },
    { kw: '专注', label: '番茄钟', page: 'pomodoro', icon: Timer },
    { kw: '任务', label: '每日必做', page: 'tasks', icon: ListChecks },
    { kw: '心得', label: '学习心得', page: 'reflections', icon: Lightbulb },
    { kw: '卡片', label: '复习卡片', page: 'cards', icon: Layers },
    { kw: '错题', label: '错题本', page: 'mistakes', icon: FileQuestion },
    { kw: '章节', label: '章节学习', page: 'chapters', icon: BookOpen },
    { kw: '统计', label: '学习统计', page: 'stats', icon: BarChart3 },
    { kw: '图谱', label: '知识图谱', page: 'graph', icon: Network },
    { kw: '书架', label: '资料书架', page: 'bookshelf', icon: Library },
    { kw: '课表', label: '课表', page: 'timetable', icon: CalendarDays },
    { kw: 'AI', label: 'AI 助手', page: 'ai', icon: Sparkles },
    { kw: 'B站', label: 'B站学习', page: 'bilibili', icon: MonitorPlay },
    { kw: '设置', label: '设置', page: 'settings', icon: Settings },
  ]

  const KIND_GROUPS: { kind: SearchResult['kind']; label: string; icon: LucideIcon }[] = [
    { kind: 'chapter', label: '章节', icon: BookOpen },
    { kind: 'reflection', label: '学习心得', icon: Lightbulb },
    { kind: 'task', label: '每日任务', icon: ListChecks },
  ]

  const isCommand = query.trim().startsWith('>')
  const cmdText = query.trim().slice(1).trim().toLowerCase()
  const commands = isCommand
    ? (cmdText
        ? COMMANDS.filter(function (c) { return c.kw.toLowerCase().indexOf(cmdText) !== -1 || cmdText.indexOf(c.kw.toLowerCase()) !== -1 })
        : COMMANDS)
    : []
  const jumpCommand = function (page: string) {
    setActivePage(page as AppPage)
    closeSearch()
    clear()
  }

  const jump = function (r: SearchResult) {
    if (r.kind === 'chapter') {
      selectChapter(r.chapterId)
      setActivePage('chapters')
    } else if (r.kind === 'reflection') {
      setActivePage('reflections')
    } else {
      setActivePage('tasks')
    }
    closeSearch()
    clear()
  }

  const onKeyDown = function (e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(function (i) { return Math.min(i + 1, Math.max(flat.length - 1, 0)) })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(function (i) { return Math.max(i - 1, 0) })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isCommand) {
        const cmd = commands[activeIndex]
        if (cmd) {
          jumpCommand(cmd.page)
        }
        return
      }
      const item = flat[activeIndex]
      if (item) {
        jump(item)
      }
    }
  }

  const renderHighlight = function (text: string, q: string) {
    return highlightParts(text, q).map(function (p, i) {
      return p.hit ? <mark key={String(i)}>{p.text}</mark> : <span key={String(i)}>{p.text}</span>
    })
  }

  const grouped = KIND_GROUPS.map(function (g) {
    return Object.assign({}, g, { items: results.filter(function (r) { return r.kind === g.kind }) })
  }).filter(function (g) { return g.items.length > 0 })
  const flat = grouped.reduce(function (acc, g) { return acc.concat(g.items) }, [] as SearchResult[])

  return (
    <Modal onClose={function () { closeSearch(); clear() }} className='search-modal'>
      <div className='search-input-row'>
        <span className='search-icon'>🔍</span>
        <input
          ref={inputRef}
          className='search-input'
          value={query}
          placeholder='输入关键词搜索章节、笔记...'
          onChange={function (e) { setQuery(e.target.value); setActiveIndex(0) }}
          onKeyDown={onKeyDown}
        />
        {isLoading ? <span className='search-loading'>搜索中...</span> : null}
      </div>
      <div className='search-results'>
        {!query.trim() ? (
          <div className='search-today'>
            <div className='search-today-head'>📅 今日速览</div>
            <div className='search-today-grid'>
              <button onClick={function () { jumpCommand('stats') }} title='查看学习统计'><Timer size={14} /> 专注 <b>{today.pomodoro}</b> 次</button>
              <button onClick={function () { jumpCommand('tasks') }} title='打开每日必做'><ListChecks size={14} /> 必做 <b>{today.tasksDone}/{today.tasksTotal}</b></button>
              <button onClick={function () { jumpCommand('cards') }} title='打开复习卡片'><Layers size={14} /> 已复习 <b>{today.reviewed}</b> 张{today.due > 0 ? <em> · 待复习 {today.due}</em> : null}</button>
              <button onClick={function () { jumpCommand('mistakes') }} title='打开错题本'><FileQuestion size={14} /> 新增错题 <b>{today.mistakes}</b></button>
              <button onClick={function () { jumpCommand('reflections') }} title='打开学习心得'><Lightbulb size={14} /> 心得 <b>{today.reflections}</b> 篇</button>
            </div>
            <div className='search-empty'>输入关键词搜索章节、笔记、任务…；「&gt;」+ 命令可直接跳转，如「&gt;番茄」</div>
          </div>
        ) : null}
        {isCommand ? (
          <div className='search-commands'>
            {commands.length === 0 ? (
              <div className='search-empty'>没有匹配的命令，试试「&gt;番茄」「&gt;图谱」「&gt;设置」</div>
            ) : (
              commands.map(function (c, idx) {
                const Icon = c.icon
                return (
                  <button
                    key={c.page + c.kw}
                    className={idx === activeIndex ? 'search-command active' : 'search-command'}
                    onMouseEnter={function () { setActiveIndex(idx) }}
                    onClick={function () { jumpCommand(c.page) }}
                  >
                    <Icon size={14} /> <span>跳转 · {c.label}</span>
                    <kbd>↵</kbd>
                  </button>
                )
              })
            )}
          </div>
        ) : null}
        {!isCommand && query.trim() && results.length === 0 && !isLoading ? (
          <div className='search-empty'>没有找到匹配结果</div>
        ) : null}
        {!isCommand ? (
          grouped.map(function (g) {
            return (
              <div key={g.kind} className='search-group'>
                <div className='search-group-label'><g.icon size={12} /> {g.label} · {g.items.length}</div>
                {g.items.map(function (r) {
                  const idx = flat.indexOf(r)
                  const active = idx === activeIndex
                  return (
                    <button
                      key={r.kind + '-' + r.chapterId}
                      className={classNames('search-result', active ? 'active' : undefined)}
                      onMouseEnter={function () { setActiveIndex(idx) }}
                      onClick={function () { jump(r) }}
                    >
                      <div className='search-result-title'>{renderHighlight(r.title, query)}</div>
                      {r.snippet ? (
                        <div className='search-result-snippet'>{renderHighlight(r.snippet, query)}</div>
                      ) : null}
                      {r.textbookName ? <div className='search-result-meta'>{r.textbookName}</div> : null}
                    </button>
                  )
                })}
              </div>
            )
          })
        ) : null}
      </div>
      <div className='search-footer'>↑↓ 选择 · Enter 打开 · Esc 关闭</div>
    </Modal>
  )
}


