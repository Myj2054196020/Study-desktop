import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Mascot } from '../mascot/Mascot'
import type { CSSProperties } from 'react'
import type { AppPage } from '../../types'
import { useApp } from '../../stores/AppContext'
import { createDb } from '../../lib/db'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import SearchModal from '../search/SearchModal'
import { BookOpen, FileText, Keyboard, Layers, ListChecks } from 'lucide-react'
import owlSvg from '../../../assets/brand/xiaogu-tray-final.svg?raw'

const DashboardPage = lazy(function () { return import('../dashboard/DashboardPage') })
const ChapterList = lazy(function () { return import('../chapters/ChapterList') })
const DailyTasksPage = lazy(function () { return import('../tasks/DailyTasksPage') })
const ReflectionsPage = lazy(function () { return import('../reflections/ReflectionsPage') })
const MistakesPage = lazy(function () { return import('../mistakes/MistakesPage') })
const CardsPage = lazy(function () { return import('../cards/CardsPage') })
const AIPage = lazy(function () { return import('../ai/AIPage') })
const BilibiliPage = lazy(function () { return import('../bilibili/BilibiliPage') })
const TimetablePage = lazy(function () { return import('../timetable/TimetablePage') })
const PomodoroTimer = lazy(function () { return import('../pomodoro/PomodoroTimer') })
const PomodoroHistory = lazy(function () { return import('../pomodoro/PomodoroHistory') })
const BookshelfPage = lazy(function () { return import('../bookshelf/BookshelfPage') })
const StatsDashboard = lazy(function () { return import('../stats/StatsDashboard') })
const KnowledgeGraph = lazy(function () { return import('../graph/KnowledgeGraph') })
const SettingsPage = lazy(function () { return import('../settings/SettingsPage') })

function Loading() {
  return <div className='page-empty'>加载中...</div>
}

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Ctrl + Shift + F', desc: '全局搜索' },
  { keys: 'Ctrl + Shift + P', desc: '开始 / 暂停番茄钟' },
  { keys: 'Ctrl + Shift + T', desc: '快速添加任务' },
  { keys: 'Ctrl + K', desc: '搜索（应用内）' },
  { keys: '1 - 9', desc: '快捷切换左侧导航模块' },
  { keys: 'F2', desc: '打开本帮助' },
]

const NAV_ORDER: AppPage[] = ['dashboard', 'tasks', 'chapters', 'mistakes', 'cards', 'reflections', 'pomodoro', 'timetable', 'bookshelf', 'stats', 'graph', 'ai', 'bilibili', 'settings']

export default function AppShell() {
  const { activePage, setActivePage, openSearch, settings, refreshSettings, minimal } = useApp()
  const [helpOpen, setHelpOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [onboardStep, setOnboardStep] = useState(0)
  const mainRef = useRef<HTMLElement | null>(null)

  useEffect(function () {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0
    }
  }, [activePage])

  useEffect(function () {
    if (settings && settings.onboardingDone !== true) {
      setOnboardOpen(true)
    }
  }, [settings])

  const finishOnboard = function () {
    setOnboardOpen(false)
    if (settings) {
      createDb().saveSettings(Object.assign({}, settings, { onboardingDone: true })).then(function () {
        refreshSettings()
      })
    }
  }

  useEffect(function () {
    const onKey = function (e: KeyboardEvent) {
      if (e.key === 'F1' || e.key === 'F2') {
        e.preventDefault()
        setHelpOpen(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openSearch()
      }
      if (/^[1-9]$/.test(e.key)) {
        const tag = (e.target as HTMLElement).tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          const page = NAV_ORDER[parseInt(e.key, 10) - 1]
          if (page) {
            setActivePage(page)
          }
        }
      }
    }
    const onEvent = function () { setHelpOpen(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-help', onEvent)
    return function () {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-help', onEvent)
    }
  }, [openSearch])

  useEffect(function () {
    const onKey = function (e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyF') {
        e.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return function () { window.removeEventListener('keydown', onKey) }
  }, [openSearch])

  useEffect(function () {
    if (!window.electronAPI) return
    const off = window.electronAPI.onOpenSearch(function () { openSearch() })
    return off
  }, [openSearch])

  let content = null
  if (activePage === 'dashboard') {
    content = <DashboardPage />
  } else if (activePage === 'chapters') {
    content = <ChapterList />
  } else if (activePage === 'mistakes') {
    content = <MistakesPage />
  } else if (activePage === 'ai') {
    content = <AIPage />
  } else if (activePage === 'bilibili') {
    content = <BilibiliPage />
  } else if (activePage === 'tasks') {
    content = <DailyTasksPage />
  } else if (activePage === 'reflections') {
    content = <ReflectionsPage />
  } else if (activePage === 'cards') {
    content = <CardsPage />
  } else if (activePage === 'timetable') {
    content = <TimetablePage />
  } else if (activePage === 'bookshelf') {
    content = <BookshelfPage />
  } else if (activePage === 'settings') {
    content = <SettingsPage />
  } else if (activePage === 'pomodoro') {
    content = (
      <div className='pomodoro-page'>
        <PomodoroTimer />
        <PomodoroHistory />
      </div>
    )
  } else if (activePage === 'stats') {
    content = <StatsDashboard />
  } else {
    content = <KnowledgeGraph />
  }

  return (
    <div className={minimal ? 'app-shell minimal' : 'app-shell'}>
      <TitleBar />
      <div className='app-body'>
        <Sidebar />
        <main className='app-main' ref={mainRef}>
          <Suspense fallback={<Loading />}>
            {content}
          </Suspense>
        </main>
      </div>
      <SearchModal />
      <Mascot />
      {onboardOpen ? (
        <Modal onClose={finishOnboard} className='onboard-modal'>
          {onboardStep === 0 ? (
            <div className='onboard-step'>
              <div className='onboard-mascot'>
                <div className='empty-mascot'>
                  <div className='empty-mascot-bg' />
                  <div className='empty-mascot-owl' dangerouslySetInnerHTML={{ __html: owlSvg }} />
                </div>
              </div>
              <h3 className='onboard-title'>深夜书房，为你留一盏灯</h3>
              <p className='onboard-desc'>我是小咕，你的学习伙伴。这盏灯会一直亮着：记任务、学章节、按时复习，习惯在灯下慢慢养成。</p>
            </div>
          ) : onboardStep === 1 ? (
            <div className='onboard-step'>
              <h3 className='onboard-title'>一盏灯下，三件事</h3>
              <div className='onboard-cards'>
                <div className='onboard-card' style={{ '--oc': 'var(--c-tasks)' } as CSSProperties}>
                  <ListChecks size={18} />
                  <b>每日必做</b>
                  <span>添加任务、归属科目，一键开始番茄钟</span>
                </div>
                <div className='onboard-card' style={{ '--oc': 'var(--c-chapters)' } as CSSProperties}>
                  <BookOpen size={18} />
                  <b>章节学习</b>
                  <span>用模板建章节，记笔记、支持公式，安排复习</span>
                </div>
                <div className='onboard-card' style={{ '--oc': 'var(--c-cards)' } as CSSProperties}>
                  <Layers size={18} />
                  <b>复习卡片</b>
                  <span>章节一键生成卡片，按 FSRS 智能复习</span>
                </div>
              </div>
            </div>
          ) : (
            <div className='onboard-step'>
              <h3 className='onboard-title'>把灯点亮吧</h3>
              <p className='onboard-desc'>先从一件小事开始：记下今天最重要的任务，或开始第一个 25 分钟专注——专注时，这盏台灯会为你亮起。</p>
              <div className='onboard-actions'>
                <Button variant='primary' onClick={function () { finishOnboard(); setActivePage('tasks') }}>去添加今日任务</Button>
                <Button variant='default' onClick={finishOnboard}>直接开始使用</Button>
              </div>
            </div>
          )}
          <div className='onboard-footer'>
            <button className='onboard-skip' onClick={finishOnboard}>跳过</button>
            <div className='onboard-dots'>
              <span className={onboardStep === 0 ? 'dot active' : 'dot'} />
              <span className={onboardStep === 1 ? 'dot active' : 'dot'} />
              <span className={onboardStep === 2 ? 'dot active' : 'dot'} />
              <span className='onboard-count'>{onboardStep + 1} / 3</span>
            </div>
            {onboardStep < 2 ? (
              <Button variant='default' onClick={function () { setOnboardStep(onboardStep + 1) }}>下一步</Button>
            ) : (
              <Button variant='primary' onClick={finishOnboard}>完成</Button>
            )}
          </div>
        </Modal>
      ) : null}
      {helpOpen ? (
        <Modal onClose={function () { setHelpOpen(false) }} className='help-modal'>
          <h3><Keyboard size={15} /> 快捷键</h3>
          <ul className='help-list'>
            {SHORTCUTS.map(function (s) {
              return (
                <li key={s.keys} className='help-item'>
                  <span className='help-keys'>{s.keys}</span>
                  <span>{s.desc}</span>
                </li>
              )
            })}
          </ul>
          <h3><FileText size={15} /> 更新日志</h3>
          <ul className='help-changelog'>
            <li><b>v1.3.0</b>：卡片自测 / 错题导出打印 / 目标拆解 / 阅读器升级（拖动缩放）/ AI 多服务商 / 品牌精化（深夜书房 × 小咕）</li>
            <li><b>v1.2.0</b>：复习卡片 FSRS / 每日必做 / 学习心得 / 统计热力图 / 课表 / 资料书架 / 知识图谱 / 番茄钟 / AI 助手 / 错题本 / B站学习</li>
            <li><b>v1.1.0</b>：桌面应用上线，章节 / 搜索 / 统计 / 图谱</li>
          </ul>
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () { setHelpOpen(false) }}>关闭</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}






