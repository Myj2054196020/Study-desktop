import { useEffect, useState } from 'react'
import { BookOpen, BookPlus, Search } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { useChapters } from '../../stores/ChapterContext'
import { useApp } from '../../stores/AppContext'
import { createDb } from '../../lib/db'
import { CHAPTER_TEMPLATES, templatesByCategory } from '../../lib/templates'
import { Checkbox } from '../ui/Checkbox'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import type { Subject } from '../../types'
import { formatDuration } from '../../lib/utils'
import ChapterDetail from './ChapterDetail'

export default function ChapterList() {
  const { textbooks, chapters, loading, selectedId, selectChapter, toggleChapterComplete, addChapter } = useChapters()
  const { settings, bumpDataVersion } = useApp()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [showTemplate, setShowTemplate] = useState(false)
  const [targetTbId, setTargetTbId] = useState('')
  const [showNewTb, setShowNewTb] = useState(false)
  const [newTbName, setNewTbName] = useState('')
  const [newTbSubject, setNewTbSubject] = useState('')
  const keyword = filter.trim().toLowerCase()

  useEffect(function () {
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
  }, [])

  const subjectOf = function (id?: string): Subject | undefined {
    return subjects.find(function (s) { return s.id === id })
  }

  if (selectedId) {
    return <ChapterDetail />
  }

  if (loading) {
    return <div className='page-empty'>加载中...</div>
  }

  const toggleCollapse = function (id: string) {
    setCollapsed(function (prev) {
      const next = Object.assign({}, prev)
      next[id] = !next[id]
      return next
    })
  }

  const handleAddChapter = function () {
    if (!targetTbId) {
      const remembered = window.localStorage.getItem('study-desktop-last-textbook')
      const exists = remembered && textbooks.some(function (t) { return t.id === remembered })
      if (exists) {
        setTargetTbId(remembered as string)
      } else if (textbooks.length === 1) {
        setTargetTbId(textbooks[0].id)
      } else {
        setTargetTbId('')
      }
    }
    setShowTemplate(true)
  }

  const handleCreateTextbook = async function () {
    const name = newTbName.trim()
    if (!name) return
    const subject = subjects.find(function (s) { return s.id === newTbSubject })
    const tb = await createDb().addTextbook({
      name,
      subject: subject ? subject.name : '',
      subjectId: subject ? subject.id : undefined,
    })
    setTargetTbId(tb.id)
    setShowNewTb(false)
    setNewTbName('')
    bumpDataVersion()
  }

  const handleImportFolder = async function () {
    if (!window.electronAPI) return
    const count = await window.electronAPI.importChaptersFolder()
    if (count > 0) {
      window.alert('已导入 ' + count + ' 个章节')
    }
  }

  const pickTemplate = async function (content: string) {
    setShowTemplate(false)
    if (targetTbId) {
      window.localStorage.setItem('study-desktop-last-textbook', targetTbId)
    }
    const chapter = await addChapter({ title: '新章节', content, textbookId: targetTbId || undefined })
    selectChapter(chapter.id)
  }

  const textbookIds = new Set(textbooks.map(function (t) { return t.id }))
  const unclassifiedChapters = chapters.filter(function (c) { return !c.textbookId || !textbookIds.has(c.textbookId) })

  return (
    <div className='chapter-page'>
      <div className='page-header'>
        <h2><BookOpen size={18} /> 章节学习</h2>
        <div className='chapter-toolbar'>
          <Input value={filter} onChange={setFilter} placeholder='搜索章节标题...' className='chapter-filter-input' />
          <Button variant='ghost' onClick={handleImportFolder} disabled={!window.electronAPI} title='批量导入 .md 文件为章节'>📥 批量导入</Button>
          <Button variant='primary' onClick={handleAddChapter}>+ 新建章节</Button>
        </div>
      </div>
      {showTemplate ? (
        <Modal onClose={function () { setShowTemplate(false) }} className='template-modal'>
          <h3>新建章节</h3>
          <div className='chapter-new-target'>
            <span className='chapter-new-label'>添加到课本</span>
            <select className='select-input chapter-new-select' value={targetTbId} onChange={function (e) { setTargetTbId(e.target.value) }}>
              <option value=''>{textbooks.length === 0 ? '（还没有课本，先新建一本）' : '（未指定 · 未分类）'}</option>
              {textbooks.map(function (tb) {
                const subj = subjectOf(tb.subjectId)
                return <option key={tb.id} value={tb.id}>{tb.name}{subj ? ' · ' + subj.name : ''}</option>
              })}
            </select>
            <Button variant='ghost' onClick={function () { setShowNewTb(function (v) { return !v }) }}><BookPlus size={13} /> {showNewTb ? '取消新建' : '新建课本'}</Button>
          </div>
          {showNewTb ? (
            <div className='chapter-new-tb'>
              <Input value={newTbName} onChange={setNewTbName} placeholder='课本名称，如：大学英语 / 数据结构' className='chapter-new-tb-name' />
              <select className='select-input chapter-new-subject' value={newTbSubject} onChange={function (e) { setNewTbSubject(e.target.value) }}>
                <option value=''>科目（可在设置中添加）</option>
                {subjects.map(function (s) {
                  return <option key={s.id} value={s.id}>{s.name}</option>
                })}
              </select>
              <Button variant='primary' onClick={handleCreateTextbook} disabled={!newTbName.trim()}>创建</Button>
            </div>
          ) : null}
          <div className='template-lib'>
            {templatesByCategory(CHAPTER_TEMPLATES.concat(settings && settings.chapterTemplates ? settings.chapterTemplates : [])).map(function (group) {
              return (
                <div key={group.category} className='template-category'>
                  <div className='template-category-label'>{group.category}</div>
                  <div className='template-grid'>
                    {group.items.map(function (tpl) {
                      return (
                        <button key={tpl.id} className='template-card' onClick={function () { pickTemplate(tpl.content) }}>
                          <div className='template-name'>{tpl.name}</div>
                          <div className='template-desc'>{tpl.desc}</div>
                          {tpl.fields && tpl.fields.length > 0 ? (
                            <div className='template-fields'>
                              {tpl.fields.slice(0, 3).map(function (f, i) {
                                return <span key={String(i)} className='template-field-chip'>{f.emoji || '·'} {f.label}</span>
                              })}
                              {tpl.fields.length > 3 ? <span className='template-field-more'>+{tpl.fields.length - 3}</span> : null}
                            </div>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <div className='reflection-modal-actions'>
            <Button variant='default' onClick={function () { setShowTemplate(false) }}>取消</Button>
          </div>
        </Modal>
      ) : null}

      {textbooks.length === 0 ? (
        <EmptyState title='暂无课本数据' hint='导入课本或新建章节，开始你的学习之旅' color='var(--c-chapters)' />
      ) : (
        textbooks.map(function (tb) {
          const tbChapters = chapters.filter(function (c) {
            if (c.textbookId !== tb.id) return false
            if (!keyword) return true
            return c.title.toLowerCase().indexOf(keyword) !== -1
          })
          const doneCount = tbChapters.filter(function (c) { return c.completed }).length
          const isCollapsed = !!collapsed[tb.id]
          return (
            <section key={tb.id} className='textbook-section'>
              <button className='textbook-header' onClick={function () { toggleCollapse(tb.id) }}>
                <span className='textbook-name'>{tb.name}</span>
                {subjectOf(tb.subjectId) ? (
                  <span className='subject-chip' style={{ background: subjectOf(tb.subjectId)!.color + '22', color: subjectOf(tb.subjectId)!.color }}>
                    {subjectOf(tb.subjectId)!.name}
                  </span>
                ) : null}
                <span className='textbook-meta'>{tb.subject || ''} · {doneCount}/{tbChapters.length} 已完成</span>
                <span className='textbook-arrow'>{isCollapsed ? '▸' : '▾'}</span>
              </button>
              {!isCollapsed ? (
                <ul className='chapter-list'>
                  {tbChapters.map(function (ch) {
                    return (
                      <li key={ch.id} className={ch.completed ? 'chapter-row done' : 'chapter-row'}>
                        <Checkbox
                          checked={ch.completed}
                          onChange={function () { toggleChapterComplete(ch.id) }}
                        />
                        <button
                          className='chapter-title'
                          onClick={function () { selectChapter(ch.id) }}
                          title='点击进入章节详情'
                        >
                          <span className='chapter-order'>{ch.order}</span>
                          {ch.title}
                        </button>
                        {ch.studyMinutes > 0 ? (
                          <span className='chapter-duration'>{formatDuration(ch.studyMinutes)}</span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </section>
          )
        })
      )}

      {unclassifiedChapters.length > 0 ? (
        <section className='textbook-section'>
          <button className='textbook-header' onClick={function () { toggleCollapse('__unclassified__') }}>
            <span className='textbook-name'>未分类</span>
            <span className='textbook-meta'>{unclassifiedChapters.length} 章 · 未指定课本</span>
            <span className='textbook-arrow'>{collapsed['__unclassified__'] ? '▸' : '▾'}</span>
          </button>
          {!collapsed['__unclassified__'] ? (
            <ul className='chapter-list'>
              {unclassifiedChapters.map(function (ch) {
                return (
                  <li key={ch.id} className={ch.completed ? 'chapter-row done' : 'chapter-row'}>
                    <Checkbox checked={ch.completed} onChange={function () { toggleChapterComplete(ch.id) }} />
                    <button className='chapter-title' onClick={function () { selectChapter(ch.id) }} title='点击进入章节详情'>
                      <span className='chapter-order'>{ch.order}</span>
                      {ch.title}
                    </button>
                    {ch.studyMinutes > 0 ? (
                      <span className='chapter-duration'>{formatDuration(ch.studyMinutes)}</span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}





