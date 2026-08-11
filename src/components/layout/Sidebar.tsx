import { useEffect, useState } from 'react'
import owlSvg from '../../../assets/brand/xiaogu-tray-final.svg?raw'
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3, BookOpen, CalendarDays, ChevronsLeft, ChevronsRight, Download, FileQuestion, House, Lamp, Layers, Library,
  Lightbulb, ListChecks, MonitorPlay, Network, Settings, Sparkles, Timer, Upload,
} from 'lucide-react'
import type { AppPage, StudyStats } from '../../types'
import { useApp } from '../../stores/AppContext'
import { createDb } from '../../lib/db'
import { classNames } from '../../lib/utils'

interface NavItem {
  id: AppPage
  label: string
  icon: LucideIcon
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: '学习',
    items: [
      { id: 'dashboard', label: '首页', icon: House },
      { id: 'tasks', label: '每日必做', icon: ListChecks },
      { id: 'chapters', label: '章节学习', icon: BookOpen },
      { id: 'mistakes', label: '错题本', icon: FileQuestion },
      { id: 'cards', label: '复习卡片', icon: Layers },
      { id: 'reflections', label: '学习心得', icon: Lightbulb },
    ],
  },
  {
    label: '专注',
    items: [
      { id: 'pomodoro', label: '番茄钟', icon: Timer },
      { id: 'timetable', label: '课表', icon: CalendarDays },
      { id: 'bookshelf', label: '资料书架', icon: Library },
    ],
  },
  {
    label: '洞察',
    items: [
      { id: 'stats', label: '学习统计', icon: BarChart3 },
      { id: 'graph', label: '知识图谱', icon: Network },
      { id: 'ai', label: 'AI 助手', icon: Sparkles },
      { id: 'bilibili', label: 'B站学习', icon: MonitorPlay },
    ],
  },
  {
    label: '系统',
    items: [
      { id: 'settings', label: '设置', icon: Settings },
    ],
  },
]

const MODULE_COLOR: Record<string, string> = {
  dashboard: 'var(--c-dashboard)',
  tasks: 'var(--c-tasks)',
  chapters: 'var(--c-chapters)',
  mistakes: 'var(--c-mistakes)',
  cards: 'var(--c-cards)',
  reflections: 'var(--c-reflections)',
  pomodoro: 'var(--c-pomodoro)',
  timetable: 'var(--c-timetable)',
  bookshelf: 'var(--c-bookshelf)',
  stats: 'var(--c-stats)',
  graph: 'var(--c-graph)',
  ai: 'var(--c-ai)',
  bilibili: 'var(--c-bilibili)',
  settings: 'var(--c-settings)',
}

export function Sidebar() {
  const { activePage, setActivePage } = useApp()
  const isElectron = !!window.electronAPI
  const [collapsed, setCollapsed] = useState(false)
  const [stats, setStats] = useState<StudyStats | null>(null)
  const [due, setDue] = useState(0)
  const [openTasks, setOpenTasks] = useState(0)

  useEffect(function () {
    let alive = true
    createDb().getStats(7).then(function (v) { if (alive) setStats(v) }).catch(function () {})
    createDb().getDueCards(1).then(function (r) { if (alive) setDue(r.length) }).catch(function () {})
    createDb().getDailyTasks().then(function (list) {
      if (alive) setOpenTasks(list.filter(function (t) { return !t.completed }).length)
    }).catch(function () {})
    return function () { alive = false }
  }, [])

  const pending = due + openTasks
  const allDone = pending === 0
  const lampText = (function () {
    if (due > 0) return '有 ' + due + ' 张卡片到期，灯还亮着'
    if (openTasks > 0) return '还有 ' + openTasks + ' 件必做，台灯为你亮着'
    if (stats && stats.streakDays >= 30) return '灯已连亮 30 晚，深夜书房的常客了，小咕敬佩'
    if (stats && stats.streakDays >= 7) return '灯已连亮 7 晚，习惯正在养成，继续'
    if (stats && stats.streakDays > 0) return '灯已亮 ' + stats.streakDays + ' 晚 · 今天也别灭'
    return '深夜书房，小咕留了一盏灯'
  })()

  const handleExport = function () {
    createDb().exportData().then(function (path) {
      if (path && path !== 'cancelled') {
        window.alert('数据已导出：' + path)
      }
    }).catch(function () {})
  }

  const handleImport = async function () {
    if (!window.electronAPI) {
      return
    }
    const result = await window.electronAPI.importDataFromFile()
    if (result === 'ok') {
      window.alert('导入成功，即将刷新页面')
      window.location.reload()
    } else if (result && result !== 'cancelled') {
      window.alert('导入失败：' + result)
    }
  }

  return (
    <aside className={classNames('sidebar', collapsed ? 'collapsed' : undefined)}>
      {!collapsed ? (
        <div className='sidebar-brand'>
          <span className='sidebar-logo' title='小咕 · 深夜书房'>
            <span className='sidebar-logo-owl' dangerouslySetInnerHTML={{ __html: owlSvg }} />
          </span>
          <div className='sidebar-brand-text'>
            <b>Study desktop</b>
            <span>深夜自习室 · 学习工作台</span>
          </div>
        </div>
      ) : (
        <div className='sidebar-brand collapsed'>
          <span className='sidebar-logo' title='小咕 · 深夜书房'>
            <span className='sidebar-logo-owl' dangerouslySetInnerHTML={{ __html: owlSvg }} />
          </span>
        </div>
      )}
      <div className='sidebar-collapse'>
        <button className='sidebar-collapse-btn' title={collapsed ? '展开侧栏' : '折叠侧栏'} onClick={function () { setCollapsed(function (v) { return !v }) }}>
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        </button>
      </div>
      <nav className='sidebar-nav'>
        {NAV_GROUPS.map(function (group) {
          return (
            <div key={group.label} className='sidebar-group'>
              {!collapsed ? <div className='sidebar-group-label'>{group.label}</div> : null}
              {group.items.map(function (item) {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    className={classNames('sidebar-nav-item', activePage === item.id ? 'active' : undefined)}
                    style={{ '--item-color': MODULE_COLOR[item.id] || 'var(--accent)' } as CSSProperties}
                    onClick={function () { setActivePage(item.id) }}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={17} />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>
      {!collapsed ? (
        <div className='sidebar-footer'>
          <div className='sidebar-footer-card'>
            <div className={'sbc-scene' + (allDone ? ' bright' : (pending > 0 ? ' lit' : ''))}>
              <div className='sbc-lamp'><Lamp size={13} /></div>
              <div className='sbc-owl' dangerouslySetInnerHTML={{ __html: owlSvg }} />
              <div className='sbc-scene-light' />
            </div>
            <div className='sbc-message'>{lampText}</div>
            <div className='sidebar-footer-card-stats'>
              <div className='sbc-stat'><b>{stats ? stats.streakDays : 0}</b><span>连续打卡</span></div>
              <div className='sbc-stat'><b>{stats ? stats.totalStudyMinutes : 0}</b><span>专注分钟</span></div>
            </div>
            <div className='sidebar-footer-card-actions'>
              <button className='sidebar-footer-btn' onClick={handleExport} title='导出备份'><Download size={13} /></button>
              {isElectron ? <button className='sidebar-footer-btn' onClick={handleImport} title='导入恢复'><Upload size={13} /></button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
