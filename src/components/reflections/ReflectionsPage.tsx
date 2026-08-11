import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { BookOpen, ImagePlus, Lightbulb, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { EmptyState } from '../ui/EmptyState'
import { useReflections } from '../../stores/ReflectionContext'
import { useChapters } from '../../stores/ChapterContext'
import { createDb } from '../../lib/db'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { formatDate } from '../../lib/utils'

function compressImage(file: File): Promise<string> {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader()
    reader.onload = function () {
      const img = new Image()
      img.onload = function () {
        const MAX = 1200
        let w = img.width
        let h = img.height
        if (Math.max(w, h) > MAX) {
          const scale = MAX / Math.max(w, h)
          w = Math.round(w * scale)
          h = Math.round(h * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = function () { reject(new Error('图片加载失败')) }
      img.src = reader.result as string
    }
    reader.onerror = function () { reject(new Error('文件读取失败')) }
    reader.readAsDataURL(file)
  })
}
import type { Reflection, Subject } from '../../types'

export default function ReflectionsPage() {
  const { reflections, loading, saveReflection, deleteReflection } = useReflections()
  const { chapters } = useChapters()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Reflection | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [subjectSel, setSubjectSel] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [images, setImages] = useState<string[]>([])
  const [zoomImg, setZoomImg] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(function () {
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
  }, [])

  const openCreate = function () {
    setEditing(null)
    setTitle('')
    setContent('')
    setChapterId('')
    setSubjectSel('')
    setImages([])
    setPreview(false)
    setOpen(true)
  }

  const openEdit = function (r: Reflection) {
    setEditing(r)
    setTitle(r.title)
    setContent(r.content)
    setChapterId(r.chapterId || '')
    setSubjectSel(r.subjectId || '')
    setImages(r.images || [])
    setPreview(false)
    setOpen(true)
  }

  const handleSave = async function () {
    if (!title.trim() && !content.trim()) {
      return
    }
    await saveReflection({
      id: editing ? editing.id : undefined,
      title,
      content,
      chapterId: chapterId || undefined,
      subjectId: subjectSel || undefined,
      images: images.length > 0 ? images : undefined,
    })
    setOpen(false)
  }

  const handleDelete = async function (r: Reflection) {
    const ok = window.confirm('确定删除这篇心得吗？')
    if (ok) {
      await deleteReflection(r.id)
    }
  }

  const handleFiles = async function (e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    for (const file of files) {
      try {
        const dataUrl = await compressImage(file)
        setImages(function (prev) { return prev.concat([dataUrl]) })
      } catch (err) {
        console.log('image add failed: ' + String(err))
      }
    }
  }
  const removeImage = function (idx: number) {
    setImages(function (prev) { return prev.filter(function (_, i) { return i !== idx }) })
  }

  const chapterTitle = function (id?: string): string {
    if (!id) return ''
    const ch = chapters.find(function (c) { return c.id === id })
    return ch ? ch.title : ''
  }

  const subjectOf = function (id?: string): Subject | undefined {
    return subjects.find(function (s) { return s.id === id })
  }

  const sorted = reflections.slice().sort(function (a, b) {
    return a.updatedAt < b.updatedAt ? 1 : (a.updatedAt > b.updatedAt ? -1 : 0)
  })
  const groups: { month: string; items: Reflection[] }[] = []
  for (const r of sorted) {
    const mk = r.updatedAt.slice(0, 7)
    const last = groups.length > 0 ? groups[groups.length - 1] : undefined
    if (last && last.month === mk) {
      last.items.push(r)
    } else {
      groups.push({ month: mk, items: [r] })
    }
  }
  const monthLabel = function (mk: string) {
    const parts = mk.split('-')
    return parts[0] + ' 年 ' + parseInt(parts[1], 10) + ' 月'
  }
  const totalChars = reflections.reduce(function (sum, r) { return sum + (r.content ? r.content.length : 0) }, 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthCount = reflections.filter(function (r) { return r.updatedAt.slice(0, 7) === thisMonth }).length

  return (
    <div className='reflections-page'>
      <div className='page-header'>
        <h2><Lightbulb size={18} /> 学习心得</h2>
        <Button variant='primary' onClick={openCreate}>+ 新建心得</Button>
      </div>
      {loading ? (
        <div className='page-empty'>加载中...</div>
      ) : reflections.length === 0 ? (
        <EmptyState title='还没有学习心得' hint='记下今天的思考与收获，它们会沉淀成属于你的知识脉络' color='var(--c-reflections)' />
      ) : (
        <>
        <div className='reflection-summary'>
          <div className='reflection-summary-item'><b>{reflections.length}</b><span>总篇数</span></div>
          <div className='reflection-summary-item'><b>{totalChars}</b><span>累计字数</span></div>
          <div className='reflection-summary-item'><b>{monthCount}</b><span>本月新增</span></div>
        </div>
        <div className='reflection-list'>
          {groups.map(function (g) {
            return (
              <div key={g.month} className='reflection-month-group'>
                <div className='reflection-month-label'>{monthLabel(g.month)} · {g.items.length} 篇</div>
                {g.items.map(function (r) {
                  return (
                    <article key={r.id} className='reflection-card'>
                      <div className='reflection-card-head'>
                        <h3>{r.title}</h3>
                        <div className='reflection-card-actions'>
                          <Button variant='ghost' onClick={function () { openEdit(r) }}>编辑</Button>
                          <Button variant='danger' onClick={function () { handleDelete(r) }}>删除</Button>
                        </div>
                      </div>
                      <div className='reflection-content md-body'>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{r.content}</ReactMarkdown>
                      </div>
                      {r.images && r.images.length > 0 ? (
                        <div className='reflection-imgs'>
                          {r.images.map(function (src, i) {
                            return <img key={String(i)} src={src} alt='' className='reflection-img' onClick={function () { setZoomImg(src) }} title='点击放大' />
                          })}
                        </div>
                      ) : null}
                      <div className='reflection-meta'>
                        <span>{formatDate(r.updatedAt)}</span>
                        {chapterTitle(r.chapterId) ? <span className='reflection-chapter'><BookOpen size={12} /> {chapterTitle(r.chapterId)}</span> : null}
                        {subjectOf(r.subjectId) ? (
                          <span className='subject-chip' style={{ background: subjectOf(r.subjectId)!.color + '22', color: subjectOf(r.subjectId)!.color }}>
                            {subjectOf(r.subjectId)!.name}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            )
          })}
        </div>
        </>
      )}

      {zoomImg ? (
        <div className='img-zoom-overlay' onClick={function () { setZoomImg('') }}>
          <img src={zoomImg} alt='' />
        </div>
      ) : null}
      {open ? (
        <Modal onClose={function () { setOpen(false) }} className='reflection-modal'>
          <h3>{editing ? '编辑心得' : '新建心得'}</h3>
          <Input value={title} onChange={setTitle} placeholder='心得标题' className='reflection-title-input' autoFocus />
          <select
            className='reflection-chapter-select'
            value={chapterId}
            onChange={function (e) { setChapterId(e.target.value) }}
          >
            <option value=''>关联章节（可选）</option>
            {chapters.map(function (c) {
              return <option key={c.id} value={c.id}>{c.title}</option>
            })}
          </select>
          <select
            className='reflection-chapter-select'
            value={subjectSel}
            onChange={function (e) { setSubjectSel(e.target.value) }}
          >
            <option value=''>所属科目（可选）</option>
            {subjects.map(function (s) {
              return <option key={s.id} value={s.id}>{s.name}</option>
            })}
          </select>
          <div className='reflection-edit-head'>
            <span className='reflection-edit-hint'>支持 Markdown 与公式（$ $ ... $ $）</span>
            <Button variant='ghost' onClick={function () { setPreview(function (v) { return !v }) }}>
              {preview ? '✏️ 编辑' : '👁 预览'}
            </Button>
          </div>
          {preview ? (
            <div className='reflection-preview md-body'>
              {content.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
              ) : (
                <span className='reflection-preview-empty'>预览为空，写点内容试试</span>
              )}
            </div>
          ) : (
            <textarea
              className='reflection-content-input'
              value={content}
              onChange={function (e) { setContent(e.target.value) }}
              placeholder={'写下你的学习心得、收获、疑问...\n支持 Markdown：**加粗**、- 列表、$ $ 公式'}
            />
          )}
          <div className='mistake-img-editor'>
            {images.map(function (src, i) {
              return (
                <div key={String(i)} className='mistake-img-thumb'>
                  <img src={src} alt='' />
                  <button className='mistake-img-del' title='移除图片' onClick={function () { removeImage(i) }}><X size={11} /></button>
                </div>
              )
            })}
            <label className='mistake-img-add'>
              <ImagePlus size={14} /> 添加图片
              <input type='file' accept='image/*' multiple hidden onChange={handleFiles} />
            </label>
          </div>
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () { setOpen(false) }}>取消</Button>
            <Button variant='primary' onClick={handleSave}>保存</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

