import { useEffect, useState } from 'react'
import { Layers, ListVideo, MonitorPlay, Search, Sparkles, Star, X } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { createDb } from '../../lib/db'
import { useApp } from '../../stores/AppContext'
import { useChapters } from '../../stores/ChapterContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { uid as genId } from '../../lib/utils'
import type { AppSettings, Subject, VideoNote, VideoNoteItem } from '../../types'

export default function BilibiliPage() {
  const { dataVersion } = useApp()
  const { chapters, textbooks } = useChapters()
  const [keyword, setKeyword] = useState('')
  const [uid, setUid] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [aiKeywords, setAiKeywords] = useState<string[]>([])
  const [aiBusy, setAiBusy] = useState(false)
  const [videos, setVideos] = useState<VideoNote[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noteTime, setNoteTime] = useState('')
  const [noteText, setNoteText] = useState('')

  useEffect(function () {
    createDb().getVideoNotes().then(function (list) { setVideos(list) }).catch(function () {})
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
  }, [dataVersion])

  const addVideo = async function () {
    const url = newUrl.trim()
    if (!url) return
    const now = new Date().toISOString()
    const video: VideoNote = {
      id: genId('vn'),
      url,
      title: newTitle.trim() || '未命名视频',
      subjectId: newSubject || undefined,
      notes: [],
      createdAt: now,
      updatedAt: now,
    }
    await createDb().saveVideoNote(video)
    setVideos(function (prev) { return prev.concat([video]) })
    setNewUrl('')
    setNewTitle('')
    setNewSubject('')
    setExpandedId(video.id)
  }

  const addNote = async function (v: VideoNote) {
    const text = noteText.trim()
    if (!text) return
    const now = new Date().toISOString()
    const updated = Object.assign({}, v, {
      notes: v.notes.concat([{ id: genId('ni'), time: noteTime.trim() || '00:00', text, createdAt: now }]),
      updatedAt: now,
    })
    await createDb().saveVideoNote(updated)
    setVideos(function (prev) { return prev.map(function (x) { return x.id === v.id ? updated : x }) })
    setNoteText('')
    setNoteTime('')
  }

  const deleteNote = async function (v: VideoNote, noteId: string) {
    const updated = Object.assign({}, v, {
      notes: v.notes.filter(function (n) { return n.id !== noteId }),
      updatedAt: new Date().toISOString(),
    })
    await createDb().saveVideoNote(updated)
    setVideos(function (prev) { return prev.map(function (x) { return x.id === v.id ? updated : x }) })
  }

  const deleteVideo = async function (id: string) {
    const ok = window.confirm('删除这个视频及其全部片段笔记？')
    if (ok) {
      await createDb().deleteVideoNote(id)
      setVideos(function (prev) { return prev.filter(function (x) { return x.id !== id }) })
    }
  }

  const openVideo = function (url: string) {
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const noteToCard = async function (v: VideoNote, n: VideoNoteItem) {
    const now = new Date().toISOString()
    await createDb().saveCard({
      id: genId('card'),
      front: '【视频笔记】' + v.title + ' @' + n.time,
      back: n.text,
      subjectId: v.subjectId,
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

  useEffect(function () {
    createDb().getSettings().then(function (s) { setSettings(s) }).catch(function () {})
  }, [dataVersion])

  const search = function (kw: string) {
    if (!kw.trim()) return
    createDb().openBilibiliSearch(kw.trim())
  }

  const openFavorites = function () {
    if (!uid.trim()) return
    createDb().openBilibiliFavorites(uid.trim())
  }

  const aiSuggest = async function () {
    setAiBusy(true)
    const subjects = Array.from(new Set(textbooks.map(function (t) { return t.subject || '未分类' })))
    const recent = chapters.slice(0, 8).map(function (c) { return c.title })
    const context = '我的学习科目：' + subjects.join('、') + '；最近学习的章节：' + recent.join('、')
    const raw = await createDb().aiChat([
      { role: 'system', content: '我是小咕，深夜书房里的猫头鹰，你的专属学习伙伴；回答用中文，温暖简洁，避免官腔。 请根据我的学习内容推荐 5 个适合在 B 站搜索的学习视频关键词，只输出 JSON 数组，如：[ 高数 极限 入门, ...]。不要输出其它内容。' },
      { role: 'user', content: context },
    ])
    const m = raw.match(/\[[\s\S]*\]/)
    const list: string[] = []
    if (m) {
      try {
        const arr = JSON.parse(m[0])
        if (Array.isArray(arr)) {
          for (const x of arr) {
            if (typeof x === 'string' && x.trim()) list.push(String(x).trim())
          }
        }
      } catch (e) { /* ignore */ }
    }
    setAiKeywords(list.length > 0 ? list : ['AI 未返回有效关键词，请手动搜索'])
    setAiBusy(false)
  }

  const smartKeywords = Array.from(new Set(
    textbooks.map(function (t) { return t.subject ? t.subject + ' 学习' : '' })
      .concat(chapters.slice(0, 6).map(function (c) { return c.title.replace(/^第[一二三四五六七八九十\d]+章[:：]/, '') }))
      .filter(function (s) { return !!s })
  ))

  return (
    <div className='bilibili-page'>
      <div className='page-header'>
        <h2><MonitorPlay size={18} /> B站学习</h2>
        <span className='graph-hint'>搜索学习视频 · 智能推荐 · 直达收藏夹（浏览器中打开）</span>
      </div>

      <section className='bili-card'>
        <h3><Search size={15} /> 搜索学习视频</h3>
        <div className='bili-search-row'>
          <Input value={keyword} onChange={setKeyword} placeholder='输入关键词，如：高等数学 极限 讲解' className='bili-search-input' />
          <Button variant='primary' onClick={function () { search(keyword) }}>去 B 站搜索</Button>
        </div>
      </section>

      <section className='bili-card'>
        <h3>✨ 智能化推荐</h3>
        <p className='setting-desc'>根据你的科目与最近学习的章节自动生成推荐关键词，点击即可在 B 站搜索。</p>
        <div className='bili-chips'>
          {smartKeywords.map(function (kw, i) {
            return (
              <button key={String(i)} className='bili-chip' onClick={function () { search(kw) }}>
                {kw} →
              </button>
            )
          })}
        </div>
        {settings && settings.aiApiKey ? (
          <div className='bili-ai-row'>
            <Button variant='default' disabled={aiBusy} onClick={aiSuggest}>
              {aiBusy ? 'AI 思考中...' : <><Sparkles size={13} /> AI 生成推荐关键词</>}
            </Button>
            {aiKeywords.length > 0 ? (
              <div className='bili-chips'>
                {aiKeywords.map(function (kw, i) {
                  return (
                    <button key={String(i)} className='bili-chip ai' onClick={function () { search(kw) }}>
                      {kw} →
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <p className='setting-desc'>在「设置」中配置 AI 接口后，可使用 AI 智能推荐关键词。</p>
        )}
      </section>

      <section className='bili-card'>
        <h3><Star size={15} /> 我的收藏夹</h3>
        <p className='setting-desc'>
          填写你的 B 站 UID（个人空间地址末尾的数字），将跳转浏览器打开你的收藏夹列表。
          出于账号安全考虑，应用不会读取你的登录态；在浏览器中登录后即可查看收藏。
        </p>
        <div className='bili-search-row'>
          <Input value={uid} onChange={setUid} placeholder='B站 UID，如：123456789' className='bili-search-input' />
          <Button variant='default' onClick={openFavorites}>打开收藏夹</Button>
        </div>
      </section>

      <section className='bili-card'>
        <h3><ListVideo size={15} /> 视频片段笔记</h3>
        <p className='setting-desc'>把 B 站视频链接存进来，按时间点记笔记；片段可一键转为复习卡片，学视频不白看。</p>
        <div className='bili-search-row'>
          <Input value={newUrl} onChange={setNewUrl} placeholder='粘贴 B 站视频链接，如 https://www.bilibili.com/video/BV1...' className='bili-search-input' />
          <Input value={newTitle} onChange={setNewTitle} placeholder='标题（可选）' className='bili-title-input' />
          <select className='select-input bili-subject-select' value={newSubject} onChange={function (e) { setNewSubject(e.target.value) }}>
            <option value=''>科目（可选）</option>
            {subjects.map(function (s) {
              return <option key={s.id} value={s.id}>{s.name}</option>
            })}
          </select>
          <Button variant='primary' onClick={addVideo} disabled={!newUrl.trim()}>添加视频</Button>
        </div>
        {videos.length === 0 ? (
          <EmptyState compact title='还没有视频笔记' hint='粘贴一个 B 站学习视频链接，边看边记' color='var(--c-bilibili)' />
        ) : (
          <div className='video-note-list'>
            {videos.map(function (v) {
              const expanded = expandedId === v.id
              return (
                <div key={v.id} className='video-note-item'>
                  <div className='video-note-head'>
                    <button className='video-note-title' onClick={function () { setExpandedId(expanded ? null : v.id) }}>
                      <MonitorPlay size={14} /> {v.title}
                    </button>
                    <span className='video-note-count'>{v.notes.length} 条笔记</span>
                    <div className='video-note-actions'>
                      <Button variant='ghost' onClick={function () { openVideo(v.url) }}>打开视频</Button>
                      <Button variant='danger' onClick={function () { deleteVideo(v.id) }}>删除</Button>
                    </div>
                  </div>
                  {expanded ? (
                    <div className='video-note-body'>
                      {v.notes.length === 0 ? (
                        <p className='video-note-empty'>还没有笔记，下面记第一条：</p>
                      ) : (
                        <ul className='video-notes'>
                          {v.notes.map(function (n) {
                            return (
                              <li key={n.id} className='video-note-line'>
                                <span className='video-note-time'>{n.time}</span>
                                <span className='video-note-text'>{n.text}</span>
                                <button className='video-note-to-card' title='转为复习卡片' onClick={function () { noteToCard(v, n) }}><Layers size={12} /></button>
                                <button className='video-note-del' title='删除这条笔记' onClick={function () { deleteNote(v, n.id) }}><X size={12} /></button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      <div className='video-note-add'>
                        <Input value={noteTime} onChange={setNoteTime} placeholder='时间 如 03:25' className='video-note-time-input' />
                        <Input value={noteText} onChange={setNoteText} placeholder='这一秒讲的关键点...' className='video-note-text-input' />
                        <Button variant='primary' onClick={function () { addNote(v) }} disabled={!noteText.trim()}>记一条</Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
