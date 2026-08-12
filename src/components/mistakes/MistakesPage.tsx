import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { BookOpen, FileQuestion, ImagePlus, Layers, ScanText, X } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { createDb } from '../../lib/db'
import { useApp } from '../../stores/AppContext'
import { useChapters } from '../../stores/ChapterContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { formatDate, uid } from '../../lib/utils'
import type { Mistake, Subject } from '../../types'

const STATUS_LABELS: Record<string, string> = {
  open: '待订正',
  reviewing: '复习中',
  mastered: '已掌握',
}

const STATUS_COLORS: Record<string, string> = {
  open: '#ef4444',
  reviewing: '#f59e0b',
  mastered: '#16a34a',
}

const REASON_PRESETS = ['概念混淆', '计算粗心', '方法不会', '审题不清', '记忆模糊', '逻辑错误']

function preprocessForOcr(src: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    const img = new Image()
    img.onload = function () {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(src)
        return
      }
      ctx.filter = 'grayscale(1) contrast(1.35) brightness(1.05)'
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = function () { reject(new Error('图片处理失败')) }
    img.src = src
  })
}

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

export default function MistakesPage() {
  const { dataVersion, settings, setActivePage } = useApp()
  const { chapters, textbooks } = useChapters()
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [filter, setFilter] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Mistake | null>(null)
  const [question, setQuestion] = useState('')
  const [myAnswer, setMyAnswer] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [reason, setReason] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [subjectSel, setSubjectSel] = useState('')
  const [status, setStatus] = useState<Mistake['status']>('open')
  const [images, setImages] = useState<string[]>([])
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrMsg, setOcrMsg] = useState('')
  const [zoomImg, setZoomImg] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')

  const load = function () {
    createDb().getMistakes().then(function (list) { setMistakes(list) }).catch(function () {})
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
  }

  useEffect(function () {
    load()
  }, [dataVersion])

  const subjectOf = function (id?: string): Subject | undefined {
    return subjects.find(function (s) { return s.id === id })
  }

  const chapterTitle = function (id?: string): string {
    if (!id) return ''
    const ch = chapters.find(function (c) { return c.id === id })
    return ch ? ch.title : ''
  }

  const openCreate = function () {
    setEditing(null)
    setQuestion('')
    setMyAnswer('')
    setCorrectAnswer('')
    setReason('')
    setChapterId('')
    setSubjectSel('')
    setStatus('open')
    setImages([])
    setOcrMsg('')
    setOpen(true)
  }

  const openEdit = function (m: Mistake) {
    setEditing(m)
    setQuestion(m.question || '')
    setMyAnswer(m.myAnswer || '')
    setCorrectAnswer(m.correctAnswer || '')
    setReason(m.reason || '')
    setChapterId(m.chapterId || '')
    setSubjectSel(m.subjectId || '')
    setStatus(m.status)
    setImages(m.images || [])
    setOcrMsg('')
    setOpen(true)
  }

  const handleSave = async function () {
    if (!question.trim()) {
      return
    }
    const now = new Date().toISOString()
    const existing = editing
    const mistake: Mistake = {
      id: editing ? editing.id : uid('mist'),
      question: question.trim(),
      myAnswer: myAnswer.trim() || undefined,
      correctAnswer: correctAnswer.trim() || undefined,
      reason: reason.trim() || undefined,
      chapterId: chapterId || undefined,
      subjectId: subjectSel || undefined,
      status,
      images: images.length > 0 ? images : undefined,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    }
    await createDb().saveMistake(mistake)
    if (!editing && settings && settings.autoCardOnMistake) {
      await createDb().saveCard({
        id: uid('card'),
        front: mistake.question,
        back: (mistake.correctAnswer ? '正确答案：' + mistake.correctAnswer + '\n' : '') + (mistake.reason ? '错因：' + mistake.reason : ''),
        chapterId: mistake.chapterId,
        subjectId: mistake.subjectId,
        status: 'new',
        due: now,
        intervalDays: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        createdAt: now,
        updatedAt: now,
      })
    }
    setOpen(false)
    load()
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

  const ocrImage = async function (idx: number) {
    const src = images[idx]
    if (!src || ocrBusy) return
    setOcrBusy(true)
    setOcrMsg('识别中… 首次需下载识别引擎（约 15MB），可能较慢')
    try {
      const { createWorker } = await import('tesseract.js')
      const w = await createWorker('chi_sim+eng')
      const prepped = await preprocessForOcr(src)
      try {
        const result = await Promise.race([
          w.recognize(prepped),
          new Promise<never>(function (_, reject) {
            setTimeout(function () { reject(new Error('识别超时，请检查网络后重试')) }, 75000)
          }),
        ])
        const text = (result.data.text || '').trim()
        setQuestion(function (q) { return q ? q + '\n' + text : text })
        setOcrMsg(text ? '已识别 ' + text.length + ' 字，已填入题目' : '未识别到文字，可换更清晰的图片')
      } finally {
        try { await w.terminate() } catch (e) { /* ignore */ }
      }
    } catch (err) {
      setOcrMsg('识别失败：' + String((err as Error).message || err))
    }
    setOcrBusy(false)
  }

  const handleDelete = async function (m: Mistake) {
    const ok = window.confirm('确定删除这道错题吗？')
    if (ok) {
      await createDb().deleteMistake(m.id)
      load()
    }
  }

  const toCard = async function (m: Mistake) {
    const now = new Date().toISOString()
    await createDb().saveCard({
      id: uid('card'),
      front: m.question,
      back: (m.correctAnswer ? '正确答案：' + m.correctAnswer + '\n' : '') + (m.reason ? '错因：' + m.reason : ''),
      chapterId: m.chapterId,
      mistakeId: m.id,
      subjectId: m.subjectId,
      status: 'new',
      due: now,
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      createdAt: now,
      updatedAt: now,
    })
    window.alert('已生成复习卡片，可到「复习卡片」页复习')
  }

  const changeStatus = async function (m: Mistake, next: Mistake['status']) {
    await createDb().saveMistake(Object.assign({}, m, { status: next, updatedAt: new Date().toISOString() }))
    load()
  }

  const visible = mistakes.filter(function (m) {
    if (filter !== 'all' && m.status !== filter) return false
    if (subjectFilter && m.subjectId !== subjectFilter) return false
    if (reasonFilter && m.reason !== reasonFilter) return false
    return true
  })

  const countBy = function (s: string) {
    return mistakes.filter(function (m) { return m.status === s }).length
  }

  const reasonMap = new Map<string, number>()
  for (const m of mistakes) {
    if (!m.reason) continue
    const r = m.reason.trim()
    reasonMap.set(r, (reasonMap.get(r) || 0) + 1)
  }
  const topReasons = Array.from(reasonMap.entries())
    .map(function (e) { return { reason: e[0], count: e[1] } })
    .sort(function (a, b) { return b.count - a.count })
    .slice(0, 6)

  // 当前选中的错因 → 相关章节（用于"同类加强"复习建议）
  const activeReason = reasonFilter || ''
  const reasonChapterIds = activeReason ? Array.from(new Set(
    mistakes.filter(function (m) { return m.reason === activeReason && m.chapterId })
      .map(function (m) { return m.chapterId as string })
  )) : []
  const reasonChapterCards = activeReason && reasonChapterIds.length > 0 ? reasonChapterIds.map(function (cid) {
    const ch = chapters.find(function (x) { return x.id === cid })
    return { id: cid, title: ch ? ch.title : '未知章节' }
  }) : []

  const openChapterCards = function (chapterId: string) {
    window.dispatchEvent(new CustomEvent('study:cards-filter', { detail: chapterId }))
    setActivePage('cards')
  }

  const escHtml = function (s?: string): string {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  const exportMistakes = async function () {
    if (visible.length === 0) {
      window.alert('当前筛选下没有错题可导出')
      return
    }
    const groups = (['open', 'reviewing', 'mastered'] as const).map(function (st) {
      return { key: st, label: STATUS_LABELS[st], list: visible.filter(function (m) { return m.status === st }) }
    }).filter(function (g) { return g.list.length > 0 })
    const items = groups.map(function (g) {
      const rows = g.list.map(function (m) {
        const imgs = (m.images && m.images.length > 0)
          ? '<div class="imgs">' + m.images.map(function (src) { return '<img src="' + src + '" alt="错题图片" />' }).join('') + '</div>'
          : ''
        return '<div class="mistake"><div class="q">' + escHtml(m.question) + '</div>' +
          (m.myAnswer ? '<div class="row"><span class="label">我的答案</span><span class="my-answer">' + escHtml(m.myAnswer) + '</span></div>' : '') +
          (m.correctAnswer ? '<div class="row"><span class="label">正确答案</span><span class="correct">' + escHtml(m.correctAnswer) + '</span></div>' : '') +
          (m.reason ? '<div class="row"><span class="label">错因</span><span class="reason">' + escHtml(m.reason) + '</span></div>' : '') +
          (chapterTitle(m.chapterId) ? '<div class="row"><span class="label">章节</span><span class="chapter">' + escHtml(chapterTitle(m.chapterId)) + '</span></div>' : '') +
          imgs +
          '</div>'
      }).join('')
      return '<h2 class="group">' + escHtml(g.label) + '（' + g.list.length + '）</h2>' + rows
    }).join('')
    const html = '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>错题本 · 考前打印</title><style>' +
      'body{font-family:"Songti SC","SimSun",serif;color:#242A45;max-width:720px;margin:0 auto;padding:36px 24px;}' +
      'h1{font-size:22px;margin:0 0 4px;}h2.group{font-size:15px;margin:22px 0 10px;color:#2B3A67;}' +
      '.meta{color:#8A92A8;font-size:12px;margin-bottom:22px;}' +
      '.mistake{border:1px solid #E6E0D2;border-radius:10px;padding:13px 15px;margin-bottom:13px;page-break-inside:avoid;}' +
      '.q{font-weight:700;font-size:14px;margin-bottom:6px;}' +
      '.row{font-size:13px;margin:4px 0;line-height:1.6;}' +
      '.label{color:#8A92A8;margin-right:6px;}.my-answer{color:#C24338;}.correct{color:#2E8B67;}.reason{color:#7A5CC8;}.chapter{color:#3E7CB1;}' +
      '.imgs{margin:8px 0 2px;}' +
      '.imgs img{display:block;max-width:100%;height:auto;border:1px solid #E6E0D2;border-radius:8px;margin:6px 0;background:#fff;}' +
      '@media print{body{padding:0}h1{font-size:20px}.mistake{break-inside:avoid;page-break-inside:avoid}.imgs img{max-width:90%;}' +
      '</style></head><body>' +
      '<h1>错题本 · 考前打印</h1>' +
      '<div class="meta">共 ' + visible.length + ' 题 · 导出于 ' + new Date().toLocaleString('zh-CN', { hour12: false }) + '</div>' +
      items +
      '</body></html>'
    const p = await createDb().exportTextFile('错题本-考前打印', html, 'html')
    if (p && p !== 'cancelled') {
      window.alert('已导出：' + p + '\n用浏览器打开后可直接打印成 PDF')
    }
  }

  return (
    <div className='mistakes-page'>
      <div className='page-header'>
        <h2><FileQuestion size={18} /> 错题本</h2>
        <div className='mistake-header-actions'>
          <Button variant='ghost' onClick={exportMistakes} title='把当前筛选下的错题导出为可打印的 HTML'>🖨 导出/打印</Button>
          <Button variant='ghost' onClick={load}>刷新</Button>
          <Button variant='primary' onClick={openCreate}>+ 新建错题</Button>
        </div>
      </div>
      <div className='mistake-filters'>
        {['all', 'open', 'reviewing', 'mastered'].map(function (f) {
          return (
            <button
              key={f}
              className={filter === f ? 'filter-chip active' : 'filter-chip'}
              onClick={function () { setFilter(f) }}
            >
              {f === 'all' ? '全部' : STATUS_LABELS[f]}
            </button>
          )
        })}
        <select className='select-input mistake-subject-filter' value={subjectFilter} onChange={function (e) { setSubjectFilter(e.target.value) }}>
          <option value=''>全部科目</option>
          {subjects.map(function (s) {
            return <option key={s.id} value={s.id}>{s.name}</option>
          })}
        </select>
      </div>
      {mistakes.length > 0 ? (
        <div className='mistake-summary'>
          <span>待订正 <b>{countBy('open')}</b></span>
          <span>复习中 <b>{countBy('reviewing')}</b></span>
          <span>已掌握 <b>{countBy('mastered')}</b></span>
          <span className='mistake-summary-total'>共 <b>{mistakes.length}</b> 题</span>
        </div>
      ) : null}
      {topReasons.length > 0 ? (
        <div className='mistake-cluster'>
          <span className='mistake-cluster-label'>错因聚类</span>
          <button className={reasonFilter === '' ? 'mistake-chip active' : 'mistake-chip'} onClick={function () { setReasonFilter('') }}>全部</button>
          {topReasons.map(function (r) {
            return (
              <button key={r.reason} className={reasonFilter === r.reason ? 'mistake-chip active' : 'mistake-chip'} onClick={function () { setReasonFilter(reasonFilter === r.reason ? '' : r.reason) }} title='点击筛选这类错因'>
                {r.reason} · {r.count}
              </button>
            )
          })}
        </div>
      ) : null}
      {activeReason ? (
        <div className='mistake-suggest'>
          <span className='mistake-suggest-label'>📌 「{activeReason}」共 {reasonMap.get(activeReason) || 0} 题</span>
          {reasonChapterCards.length > 0 ? (
            <>
              <span className='mistake-suggest-hint'>建议回到相关章节重看概念，再用卡片强化：</span>
              <div className='mistake-suggest-actions'>
                {reasonChapterCards.map(function (ch) {
                  return (
                    <Button key={ch.id} variant='default' onClick={function () { openChapterCards(ch.id) }} title='去复习这个章节的卡片'>
                      <BookOpen size={12} /> 复习《{ch.title}》的卡片
                    </Button>
                  )
                })}
              </div>
            </>
          ) : (
            <span className='mistake-suggest-hint'>这类错题还没关联章节，可编辑错题补上章节后获得复习建议</span>
          )}
          <Button variant='ghost' onClick={function () { setReasonFilter('') }}>收起</Button>
        </div>
      ) : null}
      {visible.length === 0 ? (
        <EmptyState title='错题本还是空的' hint='把做错的题记下来，考前重点复习；错题可一键转为复习卡片' color='var(--c-mistakes)' />
      ) : (
        <div className='mistake-list'>
          {visible.map(function (m) {
            const stColor = STATUS_COLORS[m.status] || '#9ca3af'
            const stLabel = STATUS_LABELS[m.status] || '未知'
            return (
              <article key={m.id} className='mistake-card'>
                <div className='mistake-card-head'>
                  <span className='mistake-status' style={{ background: stColor + '22', color: stColor }}>
                    {stLabel}
                  </span>
                  <div className='mistake-actions'>
                    <select className='select-input mistake-status-select' value={m.status} onChange={function (e) { changeStatus(m, e.target.value as Mistake['status']) }}>
                      {Object.keys(STATUS_LABELS).map(function (s) {
                        return <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      })}
                    </select>
                    <Button variant='ghost' onClick={function () { openEdit(m) }}>编辑</Button>
                    <Button variant='ghost' onClick={function () { toCard(m) }} title='转为复习卡片'><Layers size={13} /> 转卡片</Button>
                    <Button variant='danger' onClick={function () { handleDelete(m) }}>删除</Button>
                  </div>
                </div>
                <div className='mistake-question'>{(m.question || '').split('\n').map(function (line, i) {
                  return <span key={String(i)}>{line}<br /></span>
                })}</div>
                {m.images && m.images.length > 0 ? (
                  <div className='mistake-imgs'>
                    {m.images.map(function (src, i) {
                      return <img key={String(i)} src={src} alt='' className='mistake-img' onClick={function () { setZoomImg(src) }} title='点击放大' />
                    })}
                  </div>
                ) : null}
                <div className='mistake-body'>
                  {m.myAnswer ? (
                    <div className='mistake-line wrong'><span className='mistake-label'>我的答案</span>{m.myAnswer}</div>
                  ) : null}
                  {m.correctAnswer ? (
                    <div className='mistake-line right'><span className='mistake-label'>正确答案</span>{m.correctAnswer}</div>
                  ) : null}
                  {m.reason ? (
                    <div className='mistake-line reason'><span className='mistake-label'>错因</span>{m.reason}</div>
                  ) : null}
                </div>
                <div className='mistake-meta'>
                  <span>{formatDate(m.updatedAt)}</span>
                  {subjectOf(m.subjectId) ? (
                    <span className='subject-chip' style={{ background: subjectOf(m.subjectId)!.color + '22', color: subjectOf(m.subjectId)!.color }}>
                      {subjectOf(m.subjectId)!.name}
                    </span>
                  ) : null}
                  {chapterTitle(m.chapterId) ? <span className='mistake-chapter'><BookOpen size={12} /> {chapterTitle(m.chapterId)}</span> : null}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {open ? (
        <Modal onClose={function () { setOpen(false) }} className='mistake-modal'>
          <h3>{editing ? '编辑错题' : '新建错题'}</h3>
          <label>题目</label>
          <textarea className='reflection-content-input mistake-question-input' value={question} onChange={function (e) { setQuestion(e.target.value) }} placeholder='题目内容，或用图片识别填入' autoFocus />
          <div className='mistake-img-editor'>
            {images.map(function (src, i) {
              return (
                <div key={String(i)} className='mistake-img-thumb'>
                  <img src={src} alt='' />
                  <button className='mistake-img-del' title='移除图片' onClick={function () { removeImage(i) }}><X size={11} /></button>
                  <button className='mistake-img-ocr' title='识别图片中的文字并填入题目' onClick={function () { ocrImage(i) }} disabled={ocrBusy}><ScanText size={11} /> 识别</button>
                </div>
              )
            })}
            <label className='mistake-img-add'>
              <ImagePlus size={14} /> 添加图片
              <input type='file' accept='image/*' multiple hidden onChange={handleFiles} />
            </label>
          </div>
          {ocrMsg ? <p className='mistake-ocr-msg'>{ocrMsg}</p> : null}
          <label>我的答案</label>
          <textarea className='reflection-content-input mistake-short-input' value={myAnswer} onChange={function (e) { setMyAnswer(e.target.value) }} placeholder='写下当时的错误答案' />
          <label>正确答案</label>
          <textarea className='reflection-content-input mistake-short-input' value={correctAnswer} onChange={function (e) { setCorrectAnswer(e.target.value) }} placeholder='正确答案与解析' />
          <label>错误原因</label>
          <Input value={reason} onChange={setReason} placeholder='如：概念混淆 / 计算粗心 / 方法不会' />
          <div className='mistake-reason-chips'>
            {REASON_PRESETS.map(function (r) {
              return (
                <button key={r} className={reason === r ? 'mistake-chip active' : 'mistake-chip'} onClick={function () { setReason(reason === r ? '' : r) }}>{r}</button>
              )
            })}
          </div>
          <div className='lesson-form-grid'>
            <div>
              <label>科目</label>
              <select className='select-input' value={subjectSel} onChange={function (e) { setSubjectSel(e.target.value) }}>
                <option value=''>未分类</option>
                {subjects.map(function (s) {
                  return <option key={s.id} value={s.id}>{s.name}</option>
                })}
              </select>
            </div>
            <div>
              <label>关联章节</label>
              <select className='select-input' value={chapterId} onChange={function (e) { setChapterId(e.target.value) }}>
                <option value=''>无</option>
                {chapters.map(function (c) {
                  return <option key={c.id} value={c.id}>{c.title}</option>
                })}
              </select>
            </div>
          </div>
          <label>状态</label>
          <select className='select-input' value={status} onChange={function (e) { setStatus(e.target.value as Mistake['status']) }}>
            <option value='open'>待订正</option>
            <option value='reviewing'>复习中</option>
            <option value='mastered'>已掌握</option>
          </select>
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () { setOpen(false) }}>取消</Button>
            <Button variant='primary' onClick={handleSave}>保存</Button>
          </div>
        </Modal>
      ) : null}

      {zoomImg ? (
        <div className='img-zoom-overlay' onClick={function () { setZoomImg('') }}>
          <img src={zoomImg} alt='' />
        </div>
      ) : null}
    </div>
  )
}
