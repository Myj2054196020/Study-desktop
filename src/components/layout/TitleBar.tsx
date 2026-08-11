import { useEffect, useState } from 'react'
import { Bell, FileQuestion, Lamp, Layers, Lightbulb, ListChecks, Minimize2, Moon, Search, Square, Sun, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AppPage } from '../../types'
import { useApp } from '../../stores/AppContext'
import owlSvg from '../../../assets/brand/xiaogu-tray-final.svg?raw'

interface QuickAction {
  id: AppPage
  label: string
  icon: LucideIcon
}

interface Notice {
  title: string
  body: string
  time: number
}

export function TitleBar() {
  const { theme, toggleTheme, setActivePage, minimal, toggleMinimal, openSearch } = useApp()
  const isElectron = !!window.electronAPI
  const [notices, setNotices] = useState<Notice[]>([])
  const [showNotices, setShowNotices] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)

  const quickActions: QuickAction[] = [
    { id: 'tasks', label: '记任务', icon: ListChecks },
    { id: 'reflections', label: '记心得', icon: Lightbulb },
    { id: 'mistakes', label: '记错题', icon: FileQuestion },
    { id: 'cards', label: '记卡片', icon: Layers },
  ]

  useEffect(function () {
    if (!window.electronAPI) return
    const off = window.electronAPI.onSystemNotification(function (n) {
      setNotices(function (prev) {
        return [Object.assign({ time: Date.now() }, n)].concat(prev).slice(0, 20)
      })
    })
    return off
  }, [])

  return (
    <header className='titlebar'>
      <div className='titlebar-brand'>
          <span className='titlebar-logo' title='小咕 · 深夜书房'><span className='titlebar-logo-owl' dangerouslySetInnerHTML={{ __html: owlSvg }} /></span>
          <span className='titlebar-title'>Study desktop</span>
        </div>
      <button className='titlebar-search' onClick={openSearch}>
        <Search size={13} />
        <span>搜索章节、笔记、任务…</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className='titlebar-controls'>
        <div className='quick-wrap'>
          <button className='titlebar-btn quick-add' title='快速添加' onClick={function () { setQuickOpen(function (v) { return !v }) }}>
            +
          </button>
          {quickOpen ? (
            <div className='quick-menu'>
              {quickActions.map(function (a) {
                return (
                  <button key={a.id} className='quick-menu-item' onClick={function () {
                    setActivePage(a.id)
                    setQuickOpen(false)
                  }}>
                    <a.icon size={14} /> {a.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
        <div className='notice-wrap'>
          <button
            className={'titlebar-btn' + (notices.length > 0 ? ' has-notice' : '')}
            title='通知中心'
            onClick={function () { setShowNotices(function (v) { return !v }) }}
          >
            <Bell size={14} />
            {notices.length > 0 ? <span className='notice-badge'>{notices.length}</span> : null}
          </button>
          {showNotices ? (
            <div className='notice-panel'>
              <div className='notice-panel-head'>
                <span>通知中心</span>
                <button className='notice-clear' onClick={function () { setNotices([]) }}>清空</button>
              </div>
              {notices.length === 0 ? (
                <div className='notice-empty'>暂无通知</div>
              ) : (
                notices.map(function (n, i) {
                  return (
                    <div key={String(i)} className='notice-item'>
                      <div className='notice-item-title'>{n.title}</div>
                      <div className='notice-item-body'>{n.body}</div>
                    </div>
                  )
                })
              )}
            </div>
          ) : null}
        </div>
        {isElectron ? (
          <button className='titlebar-btn' title='桌面便签' onClick={function () { if (window.electronAPI) window.electronAPI.notesWidgetToggle() }}>
            📌
          </button>
        ) : null}
        <button className={minimal ? 'titlebar-btn active' : 'titlebar-btn'} title='极简模式（隐藏侧栏）' onClick={toggleMinimal}>
          ◧
        </button>
        <button className='titlebar-btn' title='快捷键帮助 (F2)' onClick={function () { window.dispatchEvent(new CustomEvent('open-help')) }}>
          ?
        </button>
        <button className='titlebar-btn' title='切换主题' onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>
        {isElectron ? (
          <>
            <button className='titlebar-btn' title='最小化' onClick={function () { if (window.electronAPI) window.electronAPI.windowControls.minimize() }}>
              <Minimize2 size={14} />
            </button>
            <button className='titlebar-btn' title='最大化/还原' onClick={function () { if (window.electronAPI) window.electronAPI.windowControls.toggleMaximize() }}>
              <Square size={14} />
            </button>
            <button className='titlebar-btn titlebar-close' title='关闭' onClick={function () { if (window.electronAPI) window.electronAPI.windowControls.close() }}>
              <X size={14} />
            </button>
          </>
        ) : null}
      </div>
    </header>
  )
}





