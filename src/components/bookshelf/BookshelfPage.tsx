import { useEffect, useRef, useState } from 'react'
import { Book, Bookmark, BookOpen, FileText, Folder, Image as ImageIcon, Library, MapPin, Paperclip, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createDb } from '../../lib/db'
import { useApp } from '../../stores/AppContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { formatDuration, uid } from '../../lib/utils'
import type { Reflection, Resource, ResourceBookmark, ResourceNote, ReviewCard } from '../../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const TYPE_ICONS: Record<string, LucideIcon> = {
  pdf: FileText,
  ebook: Book,
  image: ImageIcon,
  other: Folder,
}

const TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  ebook: '电子书',
  image: '图片',
  other: '其他',
}

export default function BookshelfPage() {
  const { dataVersion } = useApp()
  const [resources, setResources] = useState<Resource[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<Resource['type']>('pdf')
  const [filePath, setFilePath] = useState('')
  const [totalPages, setTotalPages] = useState('')
  const [currentPage, setCurrentPage] = useState('')
  const [tags, setTags] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteResourceId, setNoteResourceId] = useState('')
  const [expandedId, setExpandedId] = useState('')
  const [reading, setReading] = useState<{ id: string; start: number } | null>(null)
  const readingRef = useRef<{ id: string; start: number } | null>(null)
  const [readerId, setReaderId] = useState<string | null>(null)
  const [pdfNumPages, setPdfNumPages] = useState(0)
  const [pdfPage, setPdfPage] = useState(1)
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pdfCanvasRef2 = useRef<HTMLCanvasElement | null>(null)
  const pdfDocRef = useRef<any>(null)
  const [pdfViewMode, setPdfViewMode] = useState<'single' | 'dual'>('single')
  const [bookmarks, setBookmarks] = useState<ResourceBookmark[]>([])
  const [quickNote, setQuickNote] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageScale, setImageScale] = useState(1)
  const [readerError, setReaderError] = useState('')
  const [readerLoading, setReaderLoading] = useState(false)
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 })
  const [pdfPos, setPdfPos] = useState({ x: 0, y: 0 })
  const [pdfZoom, setPdfZoom] = useState(1)
  const [fitScale, setFitScale] = useState(1)
  const [viewerMsg, setViewerMsg] = useState('')
  const [draggingView, setDraggingView] = useState(false)
  const viewerMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewerDragRef = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const stageRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const pdfFitRef = useRef(1)
  const pdfFitAppliedRef = useRef(false)
  const pdfBaseScale = 1.0

  const load = function () {
    createDb().getResources().then(function (list) { setResources(list) }).catch(function () {})
  }

  useEffect(function () {
    load()
  }, [dataVersion])

  useEffect(function () {
    return function () {
      if (readingRef.current) {
        stopReading(readingRef.current.id)
      }
    }
  }, [])

  const openCreate = function () {
    setEditing(null)
    setTitle('')
    setType('pdf')
    setFilePath('')
    setTotalPages('')
    setCurrentPage('')
    setTags('')
    setOpen(true)
  }

  const openEdit = function (r: Resource) {
    setEditing(r)
    setTitle(r.title)
    setType(r.type)
    setFilePath(r.filePath || '')
    setTotalPages(r.totalPages ? String(r.totalPages) : '')
    setCurrentPage(r.currentPage ? String(r.currentPage) : '')
    setTags((r.tags || []).join(', '))
    setOpen(true)
  }

  const pickFile = async function () {
    if (!window.electronAPI) {
      window.alert('请在桌面应用中操作')
      return
    }
    const p = await window.electronAPI.pickResourceFile()
    if (p) {
      setFilePath(p)
    }
  }

  const handleSave = async function () {
    if (!title.trim()) {
      return
    }
    const now = new Date().toISOString()
    const existing = editing
    const resource: Resource = {
      id: editing ? editing.id : uid('res'),
      title: title.trim(),
      type,
      filePath: filePath || undefined,
      totalPages: totalPages ? parseInt(totalPages, 10) : undefined,
      currentPage: currentPage ? parseInt(currentPage, 10) : undefined,
      readingMinutes: existing ? existing.readingMinutes || 0 : 0,
      favorite: existing ? !!existing.favorite : false,
      tags: tags.split(',').map(function (t) { return t.trim() }).filter(Boolean),
      notes: existing ? existing.notes || [] : [],
      addedAt: existing ? existing.addedAt : now,
      updatedAt: now,
    }
    await createDb().saveResource(resource)
    setOpen(false)
    load()
  }

  const handleDelete = async function (r: Resource) {
    const ok = window.confirm('确定删除资料「' + r.title + '」吗？（不会删除源文件）')
    if (ok) {
      await createDb().deleteResource(r.id)
      load()
    }
  }

  const toggleFavorite = function (r: Resource) {
    createDb().updateResourceProgress(r.id, { favorite: !r.favorite }).then(load)
  }

  const updatePage = function (r: Resource, page: number) {
    if (isNaN(page) || page < 0) return
    createDb().updateResourceProgress(r.id, { currentPage: page }).then(load)
  }

  const toggleReading = function (r: Resource) {
    if (readingRef.current && readingRef.current.id === r.id) {
      stopReading(r.id)
      return
    }
    if (readingRef.current) {
      stopReading(readingRef.current.id)
    }
    const state = { id: r.id, start: Date.now() }
    readingRef.current = state
    setReading(state)
  }

  const stopReading = function (id: string) {
    const state = readingRef.current
    if (!state || state.id !== id) return
    readingRef.current = null
    setReading(null)
    const mins = Math.max(1, Math.round((Date.now() - state.start) / 60000))
    const found = resources.find(function (r) { return r.id === id })
    if (found) {
      createDb().updateResourceProgress(id, { readingMinutes: (found.readingMinutes || 0) + mins }).then(load)
      createDb().saveReadingRecord({
        id: uid('read'),
        resourceId: id,
        resourceTitle: found.title,
        startTime: new Date(state.start).toISOString(),
        endTime: new Date().toISOString(),
        durationMinutes: mins,
        createdAt: new Date().toISOString(),
      }).catch(function () {})
    }
  }

  const addNote = async function (r: Resource) {
    const text = noteText.trim()
    if (!text) return
    const note: ResourceNote = { id: uid('note'), text, createdAt: new Date().toISOString() }
    const updated = Object.assign({}, r, { notes: (r.notes || []).concat([note]) })
    await createDb().saveResource(updated)
    setNoteText('')
    load()
  }

  const deleteNote = async function (r: Resource, noteId: string) {
    const updated = Object.assign({}, r, { notes: (r.notes || []).filter(function (n) { return n.id !== noteId }) })
    await createDb().saveResource(updated)
    load()
  }

  const renderPdfPage = async function (doc: any, num: number, s: number) {
    const canvas = pdfCanvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const page = await doc.getPage(num)
    const viewport = page.getViewport({ scale: s })
    canvas.width = viewport.width * dpr
    canvas.height = viewport.height * dpr
    canvas.style.width = viewport.width + 'px'
    canvas.style.height = viewport.height + 'px'
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    await page.render({ canvasContext: ctx, viewport }).promise
    const canvas2 = pdfCanvasRef2.current
    if (canvas2) {
      const num2 = num + 1
      if (num2 <= pdfNumPages) {
        const page2 = await doc.getPage(num2)
        const vp2 = page2.getViewport({ scale: s })
        canvas2.width = vp2.width * dpr
        canvas2.height = vp2.height * dpr
        canvas2.style.width = vp2.width + 'px'
        canvas2.style.height = vp2.height + 'px'
        const ctx2 = canvas2.getContext('2d')
        if (ctx2) {
          ctx2.setTransform(dpr, 0, 0, dpr, 0, 0)
          await page2.render({ canvasContext: ctx2, viewport: vp2 }).promise
        }
      } else {
        canvas2.width = 0
        canvas2.height = 0
      }
    }
  }

  const openReader = async function (r: Resource) {
    if (!r.filePath || !window.electronAPI) return
    setReaderError('')
    setReaderLoading(true)
    try {
      let data: Uint8Array | null = null
      try {
        data = await window.electronAPI.readResourceFile(r.filePath)
      } catch (err) {
        setReaderError('读取文件失败：' + String((err as Error).message || err))
        return
      }
      if (!data || data.byteLength === 0) {
        setReaderError('无法读取文件，请确认文件仍存在：' + r.filePath)
        return
      }
      setBookmarks(r.bookmarks || [])
      setQuickNote('')
      if (r.type === 'image' || /.(png|jpe?g|gif|webp|bmp|svg)$/i.test(r.filePath)) {
        const ext = (r.filePath || '').toLowerCase()
        const mime = ext.endsWith('.png') ? 'image/png' : ext.endsWith('.gif') ? 'image/gif' : ext.endsWith('.webp') ? 'image/webp' : ext.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg'
        const bytes = new Uint8Array(data)
        const clean = bytes.slice()
        const blob = new Blob([clean.buffer], { type: mime })
        if (imageUrl) URL.revokeObjectURL(imageUrl)
        setImageUrl(URL.createObjectURL(blob))
        setPdfNumPages(0)
        setImageScale(1)
        setImagePos({ x: 0, y: 0 })
        setReaderId(r.id)
        return
      }
      setImageUrl('')
      const startPage = r.currentPage && r.currentPage > 0 ? r.currentPage : 1
      setPdfPage(startPage)
      setPdfZoom(1)
      setPdfPos({ x: 0, y: 0 })
      pdfFitAppliedRef.current = false
      try {
        const doc = await pdfjsLib.getDocument({ data }).promise
        pdfDocRef.current = doc
        setPdfNumPages(doc.numPages)
        setReaderId(r.id)
      } catch (err) {
        setReaderError('无法解析该文件（可能不是有效的 PDF）：' + String((err as Error).message || err))
      }
    } finally {
      setReaderLoading(false)
    }
  }

  const closeReader = function () {
    pdfDocRef.current = null
    setReaderId(null)
    setPdfNumPages(0)
    setReaderError('')
    setReaderLoading(false)
    setViewerMsg('')
    setImagePos({ x: 0, y: 0 })
    setPdfPos({ x: 0, y: 0 })
    setPdfZoom(1)
    if (viewerMsgTimer.current) {
      clearTimeout(viewerMsgTimer.current)
      viewerMsgTimer.current = null
    }
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
      setImageUrl('')
    }
  }

  const goPdfPage = async function (n: number) {
    const doc = pdfDocRef.current
    if (!doc || pdfNumPages === 0) return
    const target = Math.min(Math.max(1, n), pdfNumPages)
    setPdfPage(target)
    setPdfPos({ x: 0, y: 0 })
    const r = resources.find(function (x) { return x.id === readerId })
    if (r && r.totalPages) {
      createDb().updateResourceProgress(r.id, { currentPage: target }).then(load)
    }
  }

  const showViewerMsg = function (msg: string) {
    setViewerMsg(msg)
    if (viewerMsgTimer.current) clearTimeout(viewerMsgTimer.current)
    viewerMsgTimer.current = setTimeout(function () { setViewerMsg('') }, 2400)
  }

  const clampScale = function (s: number): number {
    return Math.min(8, Math.max(0.15, +(s).toFixed(2)))
  }

  const fitImage = function () {
    const img = imageRef.current
    const stage = stageRef.current
    if (!img || !stage || !img.naturalWidth || !img.naturalHeight) return
    const pad = 28
    const w = stage.clientWidth - pad * 2
    const h = stage.clientHeight - pad * 2
    const f = Math.max(0.05, Math.min(1, Math.min(w / img.naturalWidth, h / img.naturalHeight)))
    setFitScale(f)
    setImageScale(f)
    setImagePos({ x: 0, y: 0 })
  }

  const zoomIn = function () {
    if (imageUrl) {
      setImageScale(function (s) { return clampScale(s * 1.2) })
    } else {
      setPdfZoom(function (z) { return clampScale(z * 1.2) })
    }
  }

  const zoomOut = function () {
    if (imageUrl) {
      setImageScale(function (s) { return clampScale(s / 1.2) })
    } else {
      setPdfZoom(function (z) { return clampScale(z / 1.2) })
    }
  }

  const resetZoom = function () {
    if (imageUrl) {
      setImageScale(1)
      setImagePos({ x: 0, y: 0 })
    } else {
      setPdfZoom(1)
      setPdfPos({ x: 0, y: 0 })
    }
  }

  const fitView = function () {
    if (imageUrl) {
      fitImage()
    } else {
      setPdfZoom(pdfFitRef.current || 1)
      setPdfPos({ x: 0, y: 0 })
    }
  }

  const zoomPct = imageUrl ? Math.round(imageScale * 100) : Math.round(pdfZoom * 100)

  const onStageWheel = function (e: WheelEvent) {
    if (!readerId || !stageRef.current) return
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const stage = stageRef.current
    const rect = stage.getBoundingClientRect()
    const px = e.clientX - rect.left - rect.width / 2
    const py = e.clientY - rect.top - rect.height / 2
    if (imageUrl) {
      setImageScale(function (prev) {
        const next = clampScale(prev * factor)
        const ratio = next / prev
        setImagePos(function (p) { return { x: px - (px - p.x) * ratio, y: py - (py - p.y) * ratio } })
        return next
      })
    } else {
      setPdfZoom(function (prev) {
        const next = clampScale(prev * factor)
        const ratio = next / prev
        setPdfPos(function (p) { return { x: px - (px - p.x) * ratio, y: py - (py - p.y) * ratio } })
        return next
      })
    }
  }

  const onStagePointerDown = function (e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    viewerDragRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      ox: imageUrl ? imagePos.x : pdfPos.x,
      oy: imageUrl ? imagePos.y : pdfPos.y,
    }
    setDraggingView(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onStagePointerMove = function (e: React.PointerEvent<HTMLDivElement>) {
    const d = viewerDragRef.current
    if (!d.active) return
    const dx = e.clientX - d.sx + d.ox
    const dy = e.clientY - d.sy + d.oy
    if (imageUrl) setImagePos({ x: dx, y: dy })
    else setPdfPos({ x: dx, y: dy })
  }

  const onStagePointerUp = function () {
    viewerDragRef.current.active = false
    setDraggingView(false)
  }

  const onStageDoubleClick = function (e: React.MouseEvent<HTMLDivElement>) {
    if (!imageUrl || !stageRef.current) return
    const stage = stageRef.current
    const rect = stage.getBoundingClientRect()
    const px = e.clientX - rect.left - rect.width / 2
    const py = e.clientY - rect.top - rect.height / 2
    if (Math.abs(imageScale - 1) < 0.02) {
      fitImage()
    } else {
      const ratio = 1 / imageScale
      setImagePos(function (p) { return { x: px - (px - p.x) * ratio, y: py - (py - p.y) * ratio } })
      setImageScale(1)
    }
  }

  const addBookmark = async function () {
    const r = resources.find(function (x) { return x.id === readerId })
    if (!r || !readerId) return
    const bm: ResourceBookmark = { page: pdfPage, createdAt: new Date().toISOString() }
    const next = (r.bookmarks || []).concat([bm])
    setBookmarks(next)
    await createDb().updateResourceProgress(readerId, { bookmarks: next })
    showViewerMsg('已添加书签 · 第 ' + pdfPage + ' 页')
  }

  const addQuickNote = async function () {
    const text = quickNote.trim()
    const r = resources.find(function (x) { return x.id === readerId })
    if (!text || !r || !readerId) {
      showViewerMsg('先写一句批注再操作')
      return
    }
    const note: ResourceNote = { id: uid('note'), page: pdfPage, text, createdAt: new Date().toISOString() }
    const updated = Object.assign({}, r, { notes: (r.notes || []).concat([note]) })
    await createDb().saveResource(updated)
    setQuickNote('')
    load()
    showViewerMsg('已保存读书笔记 ✓')
  }

  const noteToCard = async function () {
    const text = quickNote.trim()
    const r = resources.find(function (x) { return x.id === readerId })
    if (!text || !r || !readerId) {
      showViewerMsg('先写一句批注再操作')
      return
    }
    const now = new Date().toISOString()
    const card: ReviewCard = {
      id: uid('card'),
      front: '《' + r.title + '》第 ' + pdfPage + ' 页 · 摘录',
      back: text,
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
    setQuickNote('')
    showViewerMsg('已生成复习卡片 ✓')
  }

  const noteToReflection = async function () {
    const text = quickNote.trim()
    const r = resources.find(function (x) { return x.id === readerId })
    if (!text || !r || !readerId) {
      showViewerMsg('先写一句批注再操作')
      return
    }
    const now = new Date().toISOString()
    const reflection: Reflection = {
      id: uid('rf'),
      title: '读书笔记 · 《' + r.title + '》第 ' + pdfPage + ' 页',
      content: text,
      createdAt: now,
      updatedAt: now,
    }
    await createDb().saveReflection(reflection)
    setQuickNote('')
    showViewerMsg('已存入学习心得 ✓')
  }

  const progressOf = function (r: Resource): number {
    if (r.totalPages && r.totalPages > 0 && r.currentPage != null) {
      return Math.min(100, Math.round((r.currentPage / r.totalPages) * 100))
    }
    return r.readingMinutes > 0 ? 5 : 0
  }

  // 滚轮缩放（原生监听以禁用默认滚动）
  useEffect(function () {
    if (!readerId || !stageRef.current) return
    const stage = stageRef.current
    stage.addEventListener('wheel', onStageWheel, { passive: false })
    return function () { stage.removeEventListener('wheel', onStageWheel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerId, imageUrl])

  // 阅读器快捷键：+/-/0 缩放，←/→ 翻页
  useEffect(function () {
    if (!readerId) return
    const onKey = function (e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-') zoomOut()
      else if (e.key === '0') resetZoom()
      else if (e.key === 'ArrowLeft' && !imageUrl) goPdfPage(pdfPage - 1)
      else if (e.key === 'ArrowRight' && !imageUrl) goPdfPage(pdfPage + 1)
    }
    window.addEventListener('keydown', onKey)
    return function () { window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerId, imageUrl, pdfPage])

  // PDF：挂载/翻页/单双页切换后渲染当前页；首次打开自动适应窗口
  useEffect(function () {
    if (!readerId || imageUrl || pdfNumPages === 0) return
    const doc = pdfDocRef.current
    const canvas = pdfCanvasRef.current
    if (!doc || !canvas) return
    let alive = true
    renderPdfPage(doc, pdfPage, pdfBaseScale).then(function () {
      if (!alive) return
      const stage = stageRef.current
      const c = pdfCanvasRef.current
      if (!stage || !c || c.width === 0) return
      const dpr = window.devicePixelRatio || 1
      const vpW = c.width / dpr / pdfBaseScale
      const vpH = c.height / dpr / pdfBaseScale
      const pad = 28
      const fit = Math.max(0.2, Math.min(1, Math.min((stage.clientWidth - pad * 2) / vpW, (stage.clientHeight - pad * 2) / vpH)))
      pdfFitRef.current = fit
      if (!pdfFitAppliedRef.current) {
        pdfFitAppliedRef.current = true
        setPdfZoom(fit)
        setPdfPos({ x: 0, y: 0 })
      }
    }).catch(function () {})
    return function () { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerId, imageUrl, pdfNumPages, pdfPage, pdfViewMode])

  return (
    <div className='bookshelf-page'>
      <div className='page-header'>
        <h2><Library size={18} /> 资料书架</h2>
        <Button variant='primary' onClick={openCreate}>+ 添加资料</Button>
      </div>
      {resources.length === 0 ? (
        <EmptyState title='书架上还没有资料' hint='添加 PDF、电子书、图片或笔记，跟踪阅读进度' color='var(--c-bookshelf)' />
      ) : (
        <div className='bookshelf-grid'>
          {resources.map(function (r) {
            const isReading = reading && reading.id === r.id
            return (
              <article key={r.id} className='resource-card'>
                <div className='resource-card-head'>
                  <span className='resource-icon'>{(() => { const T = TYPE_ICONS[r.type] || Folder; return <T size={16} /> })()}</span>
                  <button className={'resource-fav' + (r.favorite ? ' active' : '')} onClick={function () { toggleFavorite(r) }}>
                    {r.favorite ? '★' : '☆'}
                  </button>
                </div>
                <h3 title={r.title}>{r.title}</h3>
                <div className='resource-meta'>
                  <span>{TYPE_LABELS[r.type] || '其他'}</span>
                  {r.filePath ? <span className='resource-path' title={r.filePath}><Paperclip size={12} /> 已关联文件</span> : null}
                </div>
                <div className='resource-progress'>
                  <div className='resource-progress-bar'>
                    <div className='resource-progress-fill' style={{ width: progressOf(r) + '%' }} />
                  </div>
                  <span className='resource-progress-text'>
                    {r.totalPages && r.currentPage != null ? r.currentPage + '/' + r.totalPages + ' 页' : '阅读 ' + formatDuration(r.readingMinutes)}
                  </span>
                </div>
                {r.totalPages ? (
                  <div className='resource-page-row'>
                    <Input
                      value={r.currentPage != null ? String(r.currentPage) : ''}
                      onChange={function (v) { updatePage(r, parseInt(v, 10)) }}
                      className='resource-page-input'
                      placeholder='当前页'
                    />
                    <span className='resource-total'>/ {r.totalPages} 页</span>
                  </div>
                ) : null}
                <div className='resource-actions'>
                  {r.filePath && window.electronAPI ? (
                    <Button variant='primary' onClick={function () { openReader(r) }}><BookOpen size={13} /> 阅读</Button>
                  ) : null}
                  {r.filePath && window.electronAPI && r.type !== 'pdf' ? (
                    <Button variant='ghost' onClick={function () { window.electronAPI!.openResourceFile(r.filePath!) }}>系统打开</Button>
                  ) : null}
                  {window.electronAPI && !r.filePath ? (
                    <Button variant='ghost' onClick={async function () {
                      const p = await window.electronAPI!.pickResourceFile()
                      if (p) {
                        await createDb().updateResourceProgress(r.id, { filePath: p })
                        load()
                      }
                    }}>关联文件</Button>
                  ) : null}
                  <Button variant={isReading ? 'danger' : 'default'} onClick={function () { toggleReading(r) }} title='记录本次阅读时长'>
                    {isReading ? '停止计时' : <><Timer size={13} /> 计时</>}
                  </Button>
                  <Button variant='ghost' onClick={function () { setExpandedId(expandedId === r.id ? '' : r.id) }}>笔记</Button>
                  <Button variant='ghost' onClick={function () { openEdit(r) }}>编辑</Button>
                  <Button variant='danger' onClick={function () { handleDelete(r) }}>删除</Button>
                </div>
                {expandedId === r.id ? (
                  <div className='resource-notes'>
                    <h4>读书笔记</h4>
                    {(r.notes || []).length === 0 ? <p className='resource-no-notes'>暂无笔记</p> : null}
                    {(r.notes || []).map(function (n) {
                      return (
                        <div key={n.id} className='resource-note'>
                          <span>{n.text}</span>
                          <button className='note-delete' onClick={function () { deleteNote(r, n.id) }}>✕</button>
                        </div>
                      )
                    })}
                    <div className='resource-note-add'>
                      <Input value={noteResourceId === r.id ? noteText : ''} onChange={function (v) { setNoteResourceId(r.id); setNoteText(v) }} placeholder='记录摘录或想法...' />
                      <Button variant='primary' onClick={function () { addNote(r) }}>添加</Button>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {readerId ? (
        <Modal onClose={closeReader} className='pdf-reader-modal'>
          <div className='pdf-reader-toolbar'>
            <span className='pdf-reader-title'>{imageUrl ? <ImageIcon size={14} /> : <BookOpen size={14} />} {imageUrl ? '图片阅读' : '阅读器'}</span>
            {!imageUrl ? (
              <div className='pdf-reader-pagenav'>
                <button className='pdf-reader-btn' disabled={pdfPage <= 1} onClick={function () { goPdfPage(pdfPage - 1) }} title='上一页 (←)'>◀</button>
                <input
                  className='pdf-page-input'
                  type='number'
                  min={1}
                  max={pdfNumPages}
                  value={pdfPage}
                  onChange={function (e) { goPdfPage(parseInt(e.target.value, 10) || 1) }}
                />
                <span className='pdf-reader-total'>/ {pdfNumPages}</span>
                <button className='pdf-reader-btn' disabled={pdfPage >= pdfNumPages} onClick={function () { goPdfPage(pdfPage + 1) }} title='下一页 (→)'>▶</button>
                <button className='pdf-reader-btn' onClick={function () {
                  setPdfViewMode(pdfViewMode === 'single' ? 'dual' : 'single')
                }} title='切换单页 / 双页'>{pdfViewMode === 'single' ? '双页' : '单页'}</button>
              </div>
            ) : null}
            <div className='pdf-reader-zoom'>
              <button className='pdf-reader-btn' onClick={zoomOut} title='缩小 (-)'>−</button>
              <button className='pdf-reader-zoom-pct' onClick={resetZoom} title={imageUrl ? '回到 100%（实际像素）' : '回到 100%'}>{zoomPct}%</button>
              <button className='pdf-reader-btn' onClick={zoomIn} title='放大 (+)'>+</button>
              <button className='pdf-reader-btn' onClick={fitView} title='适应窗口'>适应</button>
            </div>
            {!imageUrl ? (
              <button className='pdf-reader-btn' onClick={addBookmark} title='给当前页加书签'><Bookmark size={13} /> 书签</button>
            ) : null}
            <div className='pdf-reader-note'>
              <input className='pdf-quicknote' value={quickNote} onChange={function (e) { setQuickNote(e.target.value) }} onKeyDown={function (e) { if (e.key === 'Enter') { addQuickNote() } }} placeholder='当前页批注…' />
              <button className='pdf-reader-btn' onClick={addQuickNote} title='保存为读书笔记'>批注</button>
              <button className='pdf-reader-btn' onClick={noteToCard} title='把当前批注转成一张复习卡片'>转卡片</button>
              <button className='pdf-reader-btn' onClick={noteToReflection} title='把当前批注存进学习心得'>存心得</button>
            </div>
            <span className='pdf-reader-close' onClick={closeReader}>✕ 关闭</span>
            {viewerMsg ? <div className='viewer-msg'>{viewerMsg}</div> : null}
            {bookmarks.length > 0 ? (
              <div className='pdf-bookmarks'>
                {bookmarks.map(function (b, i) {
                  return (
                    <button key={String(i)} className='pdf-bookmark-chip' onClick={function () { goPdfPage(b.page) }}>
                      <MapPin size={12} /> 第 {b.page} 页
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
          <div
            className={'viewer-stage' + (draggingView ? ' dragging' : '')}
            ref={stageRef}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerCancel={onStagePointerUp}
            onDoubleClick={onStageDoubleClick}
            title='拖动平移 · 滚轮缩放 · 双击图片切换 100%'
          >
            {readerLoading ? (
              <div className='reader-error'>正在打开文件…</div>
            ) : readerError ? (
              <div className='reader-error'>{readerError}</div>
            ) : imageUrl ? (
              <div className='viewer-transform' style={{ transform: 'translate(' + imagePos.x + 'px,' + imagePos.y + 'px) scale(' + imageScale + ')', transformOrigin: 'center' }}>
                <img ref={imageRef} src={imageUrl} alt='' onLoad={fitImage} draggable={false} />
              </div>
            ) : (
              <div className='viewer-transform' style={{ transform: 'translate(' + pdfPos.x + 'px,' + pdfPos.y + 'px) scale(' + pdfZoom + ')', transformOrigin: 'center' }}>
                <div className='pdf-pages-row'>
                  <canvas ref={pdfCanvasRef} />
                  {pdfViewMode === 'dual' ? <canvas ref={pdfCanvasRef2} /> : null}
                </div>
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {open ? (
        <Modal onClose={function () { setOpen(false) }} className='resource-modal'>
          <h3>{editing ? '编辑资料' : '添加资料'}</h3>
          <label>标题</label>
          <Input value={title} onChange={setTitle} placeholder='如：《数学分析》上册' autoFocus />
          <div className='lesson-form-grid'>
            <div>
              <label>类型</label>
              <select className='select-input' value={type} onChange={function (e) { setType(e.target.value as Resource['type']) }}>
                <option value='pdf'>PDF</option>
                <option value='ebook'>电子书</option>
                <option value='image'>图片</option>
                <option value='other'>其他</option>
              </select>
            </div>
            <div>
              <label>总页数</label>
              <Input value={totalPages} onChange={setTotalPages} placeholder='可选' />
            </div>
          </div>
          <label>本地文件</label>
          <div className='file-pick-row'>
            <Input value={filePath} onChange={setFilePath} placeholder='双击打开的外部文件路径' className='file-path-input' />
            <Button variant='default' onClick={pickFile}>选择文件</Button>
          </div>
          <label>标签（逗号分隔）</label>
          <Input value={tags} onChange={setTags} placeholder='如：教材, 复习' />
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () { setOpen(false) }}>取消</Button>
            <Button variant='primary' onClick={handleSave}>保存</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}





