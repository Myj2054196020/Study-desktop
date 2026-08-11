import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Bookmark, BookOpen, Bug, Clock, Layers, Network, Save, X } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import cytoscape from 'cytoscape'
import type { Core } from 'cytoscape'
import dagre from 'cytoscape-dagre'
import { useChapters } from '../../stores/ChapterContext'
import { useApp } from '../../stores/AppContext'
import { createDb } from '../../lib/db'
import { formatDuration, uid } from '../../lib/utils'
import type { AppSettings, Mistake, ReviewCard, Subject } from '../../types'

cytoscape.use(dagre)

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#8A92A8'
}

function hexToRgba(hex: string, alpha: number): string {
  const m = String(hex || '').replace('#', '')
  const full = m.length === 3 ? m.split('').map(function (ch) { return ch + ch }).join('') : m
  const n = parseInt(full, 16)
  if (isNaN(n) || full.length !== 6) return 'rgba(0,0,0,' + alpha + ')'
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')'
}

const TAG_COLORS = ['#E8A33D', '#3FA87C', '#4E9FDB', '#9B6FD8', '#E05A47', '#2AA198', '#B58A5A', '#D86FB0']

function tagColor(tag: string): string {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

type GroupBy = 'status' | 'subject' | 'tag' | 'none'
type LayoutKind = 'lr' | 'tb' | 'cose'
type SizeMode = 'fixed' | 'time'

interface TooltipState {
  title: string
  status: string
  minutes: string
  x: number
  y: number
}

interface DetailState {
  id: string
  title: string
  done: boolean
  minutes: number
  subjectName: string
  tags: string[]
  cardCount: number
  mistakeCount: number
}

const MAX_NODES = 150

export default function KnowledgeGraph() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { chapters, textbooks, selectChapter } = useChapters()
  const { setActivePage, settings, refreshSettings } = useApp()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [cards, setCards] = useState<ReviewCard[]>([])
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)

  // ---- 可配置状态（分组 / 布局 / 节点大小 / 筛选 / 搜索） ----
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [layout, setLayout] = useState<LayoutKind>('lr')
  const [sizeMode, setSizeMode] = useState<SizeMode>('fixed')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [presetName, setPresetName] = useState('')

  const presets: AppSettings['graphPresets'] = settings && settings.graphPresets ? settings.graphPresets : []

  useEffect(function () {
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
    createDb().getCards().then(function (list) { setCards(list) }).catch(function () {})
    createDb().getMistakes().then(function (list) { setMistakes(list) }).catch(function () {})
  }, [])

  const subjectById = useMemo(function () {
    return new Map(subjects.map(function (s) { return [s.id, s] }))
  }, [subjects])
  const textbookById = useMemo(function () {
    return new Map(textbooks.map(function (t) { return [t.id, t] }))
  }, [textbooks])

  // ---- 总览统计（基于全部章节，不受筛选影响） ----
  const stats = useMemo(function () {
    const done = chapters.filter(function (c) { return c.completed }).length
    const progress = chapters.filter(function (c) { return !c.completed && c.studyMinutes > 0 }).length
    const todo = chapters.filter(function (c) { return !c.completed && c.studyMinutes <= 0 }).length
    const minutes = chapters.reduce(function (s, c) { return s + (c.studyMinutes || 0) }, 0)
    return { total: chapters.length, done, progress, todo, minutes }
  }, [chapters])

  // ---- 过滤：学科 / 状态 / 搜索 ----
  const keyword = search.trim().toLowerCase()
  const visibleChapters = useMemo(function () {
    return chapters.filter(function (ch) {
      if (subjectFilter !== 'all') {
        const tb = textbookById.get(ch.textbookId)
        if (!tb || tb.subjectId !== subjectFilter) return false
      }
      if (statusFilter === 'done' && !ch.completed) return false
      if (statusFilter === 'progress' && (ch.completed || ch.studyMinutes <= 0)) return false
      if (statusFilter === 'todo' && (ch.completed || ch.studyMinutes > 0)) return false
      if (keyword) {
        const hitTitle = ch.title.toLowerCase().indexOf(keyword) !== -1
        const hitTag = ch.tags.some(function (t) { return t.toLowerCase().indexOf(keyword) !== -1 })
        if (!hitTitle && !hitTag) return false
      }
      return true
    }).slice(0, MAX_NODES)
  }, [chapters, textbookById, subjectFilter, statusFilter, keyword])

  useEffect(function () {
    if (!containerRef.current || visibleChapters.length === 0) return
    const visible = visibleChapters
    const ids = new Set(visible.map(function (ch) { return ch.id }))
    const nodes = visible.map(function (ch) {
      const tb = textbookById.get(ch.textbookId)
      const subj = tb && tb.subjectId ? subjectById.get(tb.subjectId) : undefined
      return {
        data: {
          id: ch.id,
          label: ch.title,
          completed: ch.completed,
          minutes: ch.studyMinutes,
          subjectColor: subj && subj.color ? subj.color : '',
          tag: ch.tags && ch.tags.length > 0 ? ch.tags[0] : '',
        },
      }
    })
    const edges = visible
      .filter(function (ch) { return ch.parentId && ids.has(ch.parentId) })
      .map(function (ch) {
        return { data: { id: 'e-' + ch.id, source: ch.parentId as string, target: ch.id } }
      })

    const fillColor = function (ele: { data: (k: string) => unknown }): string {
      if (groupBy === 'subject') {
        const c = ele.data('subjectColor') as string
        return c || cssVar('--text-3')
      }
      if (groupBy === 'tag') {
        const t = ele.data('tag') as string
        return t ? tagColor(t) : cssVar('--text-3')
      }
      if (groupBy === 'none') return cssVar('--c-dashboard')
      if (ele.data('completed')) return cssVar('--accent')
      if (Number(ele.data('minutes')) > 0) return cssVar('--c-dashboard')
      return cssVar('--text-3')
    }
    const nodeSize = function (minutes: number): number {
      if (sizeMode === 'time') return 26 + Math.min(26, Math.round(minutes / 10))
      return 34
    }
    const styleArr = [
      {
        selector: 'node',
        style: {
          'background-color': fillColor,
          'border-color': function () { return cssVar('--surface') },
          'border-width': 2,
          label: 'data(label)',
          color: function () { return cssVar('--text') },
          'text-wrap': 'wrap',
          'text-max-width': '100px',
          'font-size': 11,
          'text-valign': 'bottom',
          'text-margin-y': 6,
          width: function (ele: { data: (k: string) => unknown }) { return nodeSize(Number(ele.data('minutes')) || 0) },
          height: function (ele: { data: (k: string) => unknown }) { return nodeSize(Number(ele.data('minutes')) || 0) },
          'shadow-blur': 8,
          'shadow-color': 'rgba(0,0,0,0.22)',
          'shadow-offset-x': 0,
          'shadow-offset-y': 2,
          'overlay-opacity': 0,
        },
      },
      {
        selector: 'node[?completed]',
        style: {
          'border-width': 3,
          'border-color': function () { return cssVar('--accent') },
          'shadow-blur': 14,
          'shadow-color': function () { return hexToRgba(cssVar('--accent'), 0.45) },
        },
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': function () { return cssVar('--border') },
          'target-arrow-color': function () { return cssVar('--border') },
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
        },
      },
      {
        selector: 'node.faded',
        style: { 'opacity': 0.25 },
      },
      {
        selector: 'edge.faded',
        style: { 'opacity': 0.1 },
      },
      {
        selector: 'node.lit',
        style: {
          'border-width': 3.5,
          'border-color': function () { return cssVar('--accent') },
        },
      },
      {
        selector: 'edge.lit',
        style: {
          'line-color': function () { return cssVar('--accent') },
          'target-arrow-color': function () { return cssVar('--accent') },
          width: 2.5,
        },
      },
    ]

    let cy: Core | null = null
    try {
      cy = cytoscape({ container: containerRef.current, elements: { nodes, edges }, style: styleArr } as any)
      const layoutOpts = layout === 'cose'
        ? { name: 'cose', padding: 40 }
        : { name: 'dagre', rankDir: layout === 'tb' ? 'TB' : 'LR', padding: 40, nodeSep: 40, edgeSep: 20, rankSep: 60 }
      cy.layout(layoutOpts as any).run()
    } catch (err) {
      console.log('graph layout failed, falling back to cose: ' + String(err))
      try {
        cy = cytoscape({ container: containerRef.current, elements: { nodes, edges }, style: styleArr, layout: { name: 'cose', padding: 40 } } as any)
      } catch (err2) {
        console.log('graph render failed: ' + String(err2))
      }
    }
    if (!cy) return
    const cyRef: Core = cy
    cyRef.on('layoutstop', function () {
      try { cyRef.fit(undefined, 50) } catch (e) {}
    })
    cyRef.on('tap', 'node', function (evt) {
      const node = evt.target
      const d = node.data()
      const bb = node.renderedBoundingBox()
      setTooltip({
        title: String(d.label || ''),
        status: d.completed ? '已掌握' : (Number(d.minutes) > 0 ? '进行中' : '未开始'),
        minutes: formatDuration(Number(d.minutes) || 0),
        x: bb.x1 + bb.w / 2,
        y: bb.y1 - 6,
      })
      const id = String(node.id())
      const ch = chapters.find(function (c) { return c.id === id })
      if (ch) {
        const tb = textbookById.get(ch.textbookId)
        const subj = tb && tb.subjectId ? subjectById.get(tb.subjectId) : undefined
        setDetail({
          id,
          title: ch.title,
          done: !!ch.completed,
          minutes: ch.studyMinutes || 0,
          subjectName: subj ? subj.name : (tb ? tb.name : '未分类'),
          tags: ch.tags || [],
          cardCount: cards.filter(function (c) { return c.chapterId === id }).length,
          mistakeCount: mistakes.filter(function (m) { return m.chapterId === id }).length,
        })
      }
    })
    cyRef.on('tap', function (evt) {
      if (evt.target === cyRef) {
        setTooltip(null)
        setDetail(null)
      }
    })
    cyRef.on('dbltap', 'node', function (evt) {
      const id = String(evt.target.id())
      selectChapter(id)
      setActivePage('chapters')
    })
    cyRef.on('mouseover', 'node', function (evt) {
      const neighborhood = evt.target.closedNeighborhood()
      cyRef.elements().addClass('faded')
      neighborhood.removeClass('faded').addClass('lit')
    })
    cyRef.on('mouseout', 'node', function () {
      cyRef.elements().removeClass('faded lit')
    })
    cyRef.on('zoom pan', function () { setTooltip(null) })

    setNodeCount(cyRef.nodes().length)
    setEdgeCount(cyRef.edges().length)

    return function () {
      cyRef.destroy()
      setTooltip(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleChapters, groupBy, layout, sizeMode, subjectById, textbookById])

  // ---- 视图预设 ----
  const applyPreset = function (p: NonNullable<AppSettings['graphPresets']>[number]) {
    setGroupBy(p.groupBy as GroupBy)
    setLayout(p.layout as LayoutKind)
    setSizeMode(p.sizeMode as SizeMode)
    setSubjectFilter(p.subjectFilter)
    setStatusFilter(p.statusFilter)
    setSearch(p.search || '')
  }
  const savePreset = function () {
    const name = presetName.trim()
    if (!name) return
    const preset = { id: uid('gv'), name, groupBy, layout, sizeMode, subjectFilter, statusFilter, search }
    createDb().saveSettings(Object.assign({}, settings, { graphPresets: presets.concat([preset]) })).then(function () {
      refreshSettings()
      setSaveOpen(false)
      setPresetName('')
    }).catch(function () {})
  }
  const deletePreset = function (id: string) {
    createDb().saveSettings(Object.assign({}, settings, { graphPresets: presets.filter(function (p) { return p.id !== id }) })).then(function () {
      refreshSettings()
    }).catch(function () {})
  }

  const openCardsFor = function (chapterId: string) {
    window.dispatchEvent(new CustomEvent('study:cards-filter', { detail: chapterId }))
    setActivePage('cards')
  }

  if (chapters.length === 0) {
    return (
      <div className='graph-page'>
        <div className='page-header'>
          <h2><Network size={18} /> 知识图谱</h2>
        </div>
        <div className='graph-container'><EmptyState title='知识图谱还是空的' hint='添加章节后，这里会自动生成知识点网络' color='var(--c-graph)' /></div>
      </div>
    )
  }

  const legend = (function () {
    if (groupBy === 'subject') {
      return subjects.map(function (s) {
        return <span key={s.id} className='legend-item'><span className='legend-dot' style={{ background: s.color }} />{s.name}</span>
      })
    }
    if (groupBy === 'tag') {
      return <span className='legend-item'><span className='legend-dot' style={{ background: 'linear-gradient(135deg,#E8A33D,#9B6FD8)' }} />按首个标签着色</span>
    }
    if (groupBy === 'none') {
      return <span className='legend-item'><span className='legend-dot' style={{ background: cssVar('--c-dashboard') }} />统一配色</span>
    }
    return (
      <>
        <span className='legend-item'><span className='legend-dot done' />已掌握</span>
        <span className='legend-item'><span className='legend-dot progress' />进行中</span>
        <span className='legend-item'><span className='legend-dot gray' />未开始</span>
      </>
    )
  })()

  return (
    <div className='graph-page'>
      <div className='page-header'>
        <h2><Network size={18} /> 知识图谱</h2>
        <span className='graph-hint'>拖拽平移 · 滚轮缩放 · 悬停看关联 · 单击看详情 · 双击跳转章节</span>
      </div>
      <div className='graph-stats'>
        <div className='graph-stat'><Layers size={14} /><b>{stats.total}</b>章节</div>
        <div className='graph-stat done'><span className='stat-dot' />{stats.done} 已掌握</div>
        <div className='graph-stat progress'><span className='stat-dot' />{stats.progress} 进行中</div>
        <div className='graph-stat todo'><span className='stat-dot' />{stats.todo} 未开始</div>
        <div className='graph-stat' title='各章节学习计时之和'><Clock size={14} />章节累计 <b>{formatDuration(stats.minutes)}</b></div>
        <div className='graph-stat'><BookOpen size={14} />关联卡片 <b>{cards.length}</b></div>
      </div>
      <div className='graph-toolbar'>
        <select className='select-input graph-ctl' value={groupBy} onChange={function (e) { setGroupBy(e.target.value as GroupBy) }} title='分组着色'>
          <option value='status'>按完成状态</option>
          <option value='subject'>按学科</option>
          <option value='tag'>按标签</option>
          <option value='none'>统一配色</option>
        </select>
        <select className='select-input graph-ctl' value={layout} onChange={function (e) { setLayout(e.target.value as LayoutKind) }} title='布局'>
          <option value='lr'>左右递进</option>
          <option value='tb'>上下递进</option>
          <option value='cose'>力导向</option>
        </select>
        <select className='select-input graph-ctl' value={sizeMode} onChange={function (e) { setSizeMode(e.target.value as SizeMode) }} title='节点大小'>
          <option value='fixed'>节点等大</option>
          <option value='time'>按学习时长</option>
        </select>
        <select className='select-input graph-ctl' value={subjectFilter} onChange={function (e) { setSubjectFilter(e.target.value) }} title='按学科筛选'>
          <option value='all'>全部学科</option>
          {subjects.map(function (s) {
            return <option key={s.id} value={s.id}>{s.name}</option>
          })}
        </select>
        <select className='select-input graph-ctl' value={statusFilter} onChange={function (e) { setStatusFilter(e.target.value) }} title='按状态筛选'>
          <option value='all'>全部状态</option>
          <option value='done'>已掌握</option>
          <option value='progress'>进行中</option>
          <option value='todo'>未开始</option>
        </select>
        <Input value={search} onChange={setSearch} placeholder='搜索标题或标签…' className='graph-search' />
        <Button variant='ghost' onClick={function () { setSaveOpen(true) }} title='保存当前视图为预设'><Save size={13} /> 存视图</Button>
      </div>
      {saveOpen ? (
        <div className='graph-save-row'>
          <Input value={presetName} onChange={setPresetName} placeholder='视图名称，如「期中冲刺」' className='graph-save-input' />
          <Button variant='primary' onClick={savePreset} disabled={!presetName.trim()}>保存</Button>
          <Button variant='ghost' onClick={function () { setSaveOpen(false); setPresetName('') }}>取消</Button>
        </div>
      ) : null}
      {presets.length > 0 ? (
        <div className='graph-presets'>
          {presets.map(function (p) {
            const active = p.groupBy === groupBy && p.layout === layout && p.sizeMode === sizeMode && p.subjectFilter === subjectFilter && p.statusFilter === statusFilter
            return (
              <span key={p.id} className={active ? 'graph-preset-chip active' : 'graph-preset-chip'} onClick={function () { applyPreset(p) }} title={p.search ? '搜索：' + p.search : undefined}>
                <Bookmark size={11} /> {p.name}
                <button className='graph-preset-del' title='删除此视图' onClick={function (e) { e.stopPropagation(); deletePreset(p.id) }}><X size={10} /></button>
              </span>
            )
          })}
        </div>
      ) : null}
      <div className='graph-stage'>
        <div className='graph-container' ref={containerRef}>
          {visibleChapters.length === 0 ? (
            <div className='graph-empty-filter'>没有符合筛选条件的章节，试试调整筛选或搜索</div>
          ) : null}
          {tooltip ? (
            <div className='graph-tooltip' style={{ left: tooltip.x, top: tooltip.y }}>
              <div className='graph-tooltip-title'>{tooltip.title}</div>
              <div className='graph-tooltip-status'>{tooltip.status}</div>
              <div className='graph-tooltip-minutes'>学习时长：{tooltip.minutes}</div>
            </div>
          ) : null}
        </div>
        {detail ? (
          <div className='graph-detail'>
            <div className='graph-detail-head'>
              <span className={'graph-detail-badge ' + (detail.done ? 'done' : (detail.minutes > 0 ? 'progress' : 'todo'))}>{detail.done ? '已掌握' : (detail.minutes > 0 ? '进行中' : '未开始')}</span>
              <button className='graph-detail-close' onClick={function () { setDetail(null) }} title='关闭'><X size={12} /></button>
            </div>
            <h4 className='graph-detail-title'>{detail.title}</h4>
            <div className='graph-detail-meta'>
              <span><BookOpen size={12} /> {detail.subjectName}</span>
              <span><Clock size={12} /> {formatDuration(detail.minutes)}</span>
            </div>
            {detail.tags.length > 0 ? (
              <div className='graph-detail-tags'>
                {detail.tags.map(function (t) {
                  return <span key={t} className='graph-detail-tag' style={{ background: tagColor(t) + '26', color: tagColor(t) }}>{t}</span>
                })}
              </div>
            ) : null}
            <div className='graph-detail-links'>
              <div className='graph-detail-link'><Bug size={13} /> 相关错题 <b>{detail.mistakeCount}</b></div>
              <div className='graph-detail-link'><BookOpen size={13} /> 相关卡片 <b>{detail.cardCount}</b></div>
            </div>
            <div className='graph-detail-actions'>
              <Button variant='primary' onClick={function () { selectChapter(detail.id); setActivePage('chapters') }}>打开章节 <ArrowRight size={12} /></Button>
              <Button variant='default' onClick={function () { openCardsFor(detail.id) }}>看相关卡片</Button>
              <Button variant='ghost' onClick={function () { setActivePage('mistakes') }}>错题本</Button>
            </div>
          </div>
        ) : null}
      </div>
      <div className='graph-legend'>
        {legend}
        <span className='legend-count'>节点 {nodeCount} · 关系 {edgeCount}{chapters.length > MAX_NODES ? '（仅显示前 ' + MAX_NODES + ' 个节点）' : ''}</span>
      </div>
    </div>
  )
}