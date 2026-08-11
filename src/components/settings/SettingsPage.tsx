import { useEffect, useState } from 'react'
import { Download, Folder, Info, Layers, Palette, RefreshCw, Save, Settings as SettingsIcon, Shield, Sparkles, Timer, Upload, Zap, FileText } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { createDb } from '../../lib/db'
import { useApp } from '../../stores/AppContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { uid } from '../../lib/utils'
import { buildTemplateContent } from '../../lib/templates'
import type { AppSettings, ChapterTemplate, ChapterTemplateField, Subject } from '../../types'

const SUBJECT_COLORS = ['#2B3A67', '#8B5CF6', '#EC4899', '#E8A33D', '#3FA87C', '#06B6D4', '#E2574C', '#84CC16']

const AI_PROVIDERS: { id: string; name: string; baseUrl: string; model: string; keyHint: string; needsKey: boolean }[] = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', keyHint: 'sk-...', needsKey: true },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyHint: 'sk-...', needsKey: true },
  { id: 'moonshot', name: 'Kimi（月之暗面）', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', keyHint: 'sk-...', needsKey: true },
  { id: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', keyHint: '填入智谱 API Key', needsKey: true },
  { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', keyHint: 'sk-...', needsKey: true },
  { id: 'ollama', name: 'Ollama（本地）', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1', keyHint: '本地模型无需 Key', needsKey: false },
  { id: 'custom', name: '自定义（OpenAI 兼容）', baseUrl: '', model: '', keyHint: 'sk-...', needsKey: true },
]

function currentProvider(s: AppSettings): string {
  if (s.aiProvider) return s.aiProvider
  const hit = AI_PROVIDERS.find(function (p) { return p.baseUrl && (s.aiBaseUrl || '').indexOf(p.baseUrl) === 0 })
  if (hit) return hit.id
  return s.aiBaseUrl ? 'custom' : 'deepseek'
}


export default function SettingsPage() {
  const { dataVersion } = useApp()
  const [settings, setSettings] = useState<AppSettings>({
    aiProvider: 'deepseek',
    aiBaseUrl: 'https://api.deepseek.com',
    aiApiKey: '',
    aiModel: 'deepseek-chat',
    autoStart: false,
    startHidden: false,
    periods: [],
  })
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [saved, setSaved] = useState(false)
  const [aiStatus, setAiStatus] = useState('')
  const [updateStatus, setUpdateStatus] = useState('')
  const [tplOpen, setTplOpen] = useState(false)
  const [tplId, setTplId] = useState('')
  const [tplName, setTplName] = useState('')
  const [tplContent, setTplContent] = useState('')
  const [tplFields, setTplFields] = useState<ChapterTemplateField[]>([])

  const load = function () {
    createDb().getSettings().then(function (s) { setSettings(s) }).catch(function () {})
    createDb().getSubjects().then(function (list) { setSubjects(list) }).catch(function () {})
  }

  useEffect(function () {
    load()
  }, [dataVersion])

  const saveSettings = function (next?: AppSettings) {
    const target = next || settings
    createDb().saveSettings(target).then(function () {
      setSaved(true)
      setTimeout(function () { setSaved(false) }, 1500)
    })
  }

  const openTemplateModal = function (t?: ChapterTemplate) {
    setTplId(t ? t.id : '')
    setTplName(t ? t.name : '')
    setTplContent(t ? t.content : '')
    setTplFields(t && t.fields && t.fields.length > 0 ? t.fields : [{ label: '学习目标', emoji: '🎯', placeholder: '' }])
    setTplOpen(true)
  }

  const updateTplField = function (idx: number, patch: Partial<ChapterTemplateField>) {
    setTplFields(function (prev) {
      return prev.map(function (f, i) {
        if (i !== idx) return f
        return Object.assign({}, f, patch)
      })
    })
  }
  const addTplField = function () {
    setTplFields(function (prev) { return prev.concat([{ label: '', emoji: '', placeholder: '' }]) })
  }
  const removeTplField = function (idx: number) {
    setTplFields(function (prev) { return prev.filter(function (_, i) { return i !== idx }) })
  }

  const saveTemplate = function () {
    const name = tplName.trim()
    if (!name) return
    const cleanFields = tplFields.filter(function (f) { return f.label.trim() })
    const content = buildTemplateContent(cleanFields)
    const list = (settings.chapterTemplates || []).slice()
    const tpl = { name, desc: name, category: '自定义', fields: cleanFields, content }
    if (tplId) {
      const idx = list.findIndex(function (x) { return x.id === tplId })
      if (idx !== -1) {
        list[idx] = Object.assign({ id: tplId }, tpl)
      }
    } else {
      list.push(Object.assign({ id: 'tpl-' + Date.now().toString(36) }, tpl))
    }
    const next = Object.assign({}, settings, { chapterTemplates: list })
    setSettings(next)
    saveSettings(next)
    setTplOpen(false)
  }

  const deleteTemplate = function (id: string) {
    const list = (settings.chapterTemplates || []).filter(function (x) { return x.id !== id })
    const next = Object.assign({}, settings, { chapterTemplates: list })
    setSettings(next)
    saveSettings(next)
  }

  const addSubject = function () {
    const name = newSubject.trim()
    if (!name) return
    const subject: Subject = {
      id: uid('sub'),
      name,
      color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length],
      createdAt: new Date().toISOString(),
    }
    createDb().saveSubject(subject).then(function () {
      setSubjects(function (prev) { return prev.concat([subject]) })
      setNewSubject('')
    })
  }

  const renameSubject = function (id: string, name: string) {
    const found = subjects.find(function (s) { return s.id === id })
    if (!found) return
    const updated = Object.assign({}, found, { name: name.trim() || found.name })
    createDb().saveSubject(updated).then(function () {
      setSubjects(function (prev) { return prev.map(function (s) { return s.id === id ? updated : s }) })
    })
  }

  const colorSubject = function (id: string, color: string) {
    const found = subjects.find(function (s) { return s.id === id })
    if (!found) return
    const updated = Object.assign({}, found, { color })
    createDb().saveSubject(updated).then(function () {
      setSubjects(function (prev) { return prev.map(function (s) { return s.id === id ? updated : s }) })
    })
  }

  const deleteSubject = function (id: string) {
    if (subjects.length <= 1) {
      window.alert('至少保留一个科目')
      return
    }
    const ok = window.confirm('删除科目后，其下的章节/任务/心得将归入第一个科目。确定删除吗？')
    if (ok) {
      createDb().deleteSubject(id).then(function () {
        setSubjects(function (prev) { return prev.filter(function (s) { return s.id !== id }) })
      })
    }
  }

  const checkUpdate = async function () {
    setUpdateStatus('检查中...')
    const result = await createDb().checkUpdate()
    setUpdateStatus(result)
  }

  const testAi = async function () {
    setAiStatus('测试中...')
    const result = await createDb().aiChat([
      { role: 'user', content: '请只回复两个字：正常' },
    ])
    setAiStatus(result)
  }

  return (
    <div className='settings-page'>
      <div className='page-header'>
        <h2><SettingsIcon size={18} /> 设置</h2>
      </div>

      <section className='setting-card'>
        <h3><Folder size={15} /> 科目管理</h3>
        <p className='setting-desc'>任务、章节、心得、课表、复习卡片均可归属科目，统计按科目汇总。</p>
        <div className='subject-manage-row'>
          <Input value={newSubject} onChange={setNewSubject} placeholder='新科目名称，如：高等数学 / 英语 / 专业课' className='subject-name-input' />
          <Button variant='primary' onClick={addSubject}>添加科目</Button>
        </div>
        <ul className='subject-list'>
          {subjects.map(function (s) {
            return (
              <li key={s.id} className='subject-item'>
                <input
                  type='color'
                  className='subject-color-input'
                  value={s.color}
                  onChange={function (e) { colorSubject(s.id, e.target.value) }}
                  title='点击更换颜色'
                />
                <Input value={s.name} onChange={function (v) { renameSubject(s.id, v) }} className='subject-name-edit' />
                <Button variant='danger' onClick={function () { deleteSubject(s.id) }}>删除</Button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className='setting-card'>
        <h3><Sparkles size={15} /> AI 助手配置</h3>
        <p className='setting-desc'>预置多个服务商，选择后自动填入接口与模型；也支持任意 OpenAI 兼容接口或本地 Ollama（无需 Key）。用于章节总结、生成复习卡片等。</p>
        <div className='ai-form'>
          <label>服务商</label>
          <select className='select-input' value={currentProvider(settings)} onChange={function (e) {
            const id = e.target.value
            const preset = AI_PROVIDERS.find(function (p) { return p.id === id })
            const next = Object.assign({}, settings, { aiProvider: id })
            if (preset && preset.baseUrl) {
              next.aiBaseUrl = preset.baseUrl
              next.aiModel = preset.model
            }
            setSettings(next)
          }}>
            {AI_PROVIDERS.map(function (p) {
              return <option key={p.id} value={p.id}>{p.name}</option>
            })}
          </select>
          <label>接口地址（Base URL）</label>
          <Input value={settings.aiBaseUrl} onChange={function (v) { setSettings(Object.assign({}, settings, { aiBaseUrl: v })) }} placeholder='https://api.openai.com/v1' />
          <label>API Key（{currentProvider(settings) === 'ollama' ? '本地模型可留空' : '必填'}）</label>
          <Input value={settings.aiApiKey} onChange={function (v) { setSettings(Object.assign({}, settings, { aiApiKey: v })) }} placeholder={(AI_PROVIDERS.find(function (p) { return p.id === currentProvider(settings) }) || AI_PROVIDERS[0]).keyHint} type='password' />
          <label>模型</label>
          <Input value={settings.aiModel} onChange={function (v) { setSettings(Object.assign({}, settings, { aiModel: v })) }} placeholder='deepseek-chat / gpt-4o-mini / qwen-plus' />
          <div className='ai-form-actions'>
            <Button variant='default' onClick={testAi}>测试连接</Button>
            <Button variant='primary' onClick={function () { saveSettings() }}>保存设置</Button>
            {saved ? <span className='save-hint'>已保存 ✓</span> : null}
          </div>
          {aiStatus ? <p className='ai-status'>{aiStatus}</p> : null}
        </div>
      </section>

      <section className='setting-card'>
        <h3><RefreshCw size={15} /> 文件夹同步</h3>
        <p className='setting-desc'>把数据同步到指定文件夹（可配合网盘实现多设备备份）。启动、保存设置、每 30 分钟及「立即同步」时写入 study-desktop-data.json。</p>
        <div className='file-pick-row'>
          <Input value={settings.syncFolder || ''} onChange={function (v) { setSettings(Object.assign({}, settings, { syncFolder: v })) }} placeholder='同步文件夹路径' className='file-path-input' />
          <Button variant='default' onClick={async function () {
            if (!window.electronAPI) return
            const folder = await window.electronAPI.pickFolder()
            if (folder) setSettings(Object.assign({}, settings, { syncFolder: folder }))
          }}>选择文件夹</Button>
        </div>
        <div className='backup-actions sync-actions'>
          <Button variant='primary' onClick={function () { saveSettings() }}>保存并同步</Button>
          <Button variant='default' onClick={async function () {
            const file = await createDb().syncNow()
            window.alert(file ? '已同步到：' + file : '未设置同步文件夹或同步失败')
          }}>立即同步</Button>
        </div>
      </section>

      <section className='setting-card'>
        <h3><FileText size={15} /> Obsidian 互通</h3>
        <p className='setting-desc'>设置一个 Markdown 资料库文件夹：导出会创建 study-desktop-export 子目录（章节 + 心得），导入会将该文件夹中的 .md 文件批量转为章节。</p>
        <div className='file-pick-row'>
          <Input value={settings.obsidianFolder || ''} onChange={function (v) { setSettings(Object.assign({}, settings, { obsidianFolder: v })) }} placeholder='资料库文件夹路径' className='file-path-input' />
          <Button variant='default' onClick={async function () {
            if (!window.electronAPI) return
            const folder = await window.electronAPI.pickFolder()
            if (folder) setSettings(Object.assign({}, settings, { obsidianFolder: folder }))
          }}>选择文件夹</Button>
        </div>
        <div className='backup-actions sync-actions'>
          <Button variant='primary' onClick={function () { saveSettings() }}>保存设置</Button>
          <Button variant='default' onClick={async function () {
            const p = await createDb().obsidianExport()
            window.alert(p && p !== 'no folder' ? '已导出到：' + p : '未设置资料库文件夹')
          }}>导出到资料库</Button>
          <Button variant='default' onClick={async function () {
            const n = await createDb().obsidianImport()
            window.alert(n > 0 ? '已导入 ' + n + ' 个章节' : '未设置资料库文件夹或没有 .md 文件')
          }}>从资料库导入</Button>
        </div>
      </section>

      <section className='setting-card'>
        <h3><Palette size={15} /> 外观</h3>
        <div className='appearance-row'>
          <label>强调色</label>
          <div className='accent-presets'>
            {['#2B3A67', '#8B5CF6', '#EC4899', '#E8A33D', '#3FA87C', '#E2574C'].map(function (c) {
              return (
                <button key={c} className={'accent-dot' + (settings.accentColor === c ? ' active' : '')} style={{ background: c }} onClick={function () {
                  setSettings(Object.assign({}, settings, { accentColor: c }))
                }} />
              )
            })}
            <input type='color' className='color-input' value={settings.accentColor || '#D9922E'} onChange={function (e) {
              setSettings(Object.assign({}, settings, { accentColor: e.target.value }))
            }} title='自定义颜色' />
          </div>
        </div>
        <div className='appearance-row'>
          <label>字号</label>
          <div className='option-pills'>
            {[['small', '小'], ['normal', '标准'], ['large', '大']].map(function (o) {
              return (
                <button key={o[0]} className={settings.fontSize === o[0] ? 'pill active' : 'pill'} onClick={function () {
                  setSettings(Object.assign({}, settings, { fontSize: o[0] as 'small' | 'normal' | 'large' }))
                }}>{o[1]}</button>
              )
            })}
          </div>
        </div>
        <div className='appearance-row'>
          <label>密度</label>
          <div className='option-pills'>
            {[['comfortable', '舒适'], ['compact', '紧凑']].map(function (o) {
              return (
                <button key={o[0]} className={settings.density === o[0] ? 'pill active' : 'pill'} onClick={function () {
                  setSettings(Object.assign({}, settings, { density: o[0] as 'comfortable' | 'compact' }))
                }}>{o[1]}</button>
              )
            })}
          </div>
        </div>
        <div className='backup-actions sync-actions'>
          <Button variant='primary' onClick={function () { saveSettings() }}>保存外观</Button>
          <Button variant='ghost' onClick={function () {
            setSettings(Object.assign({}, settings, { onboardingDone: false }))
            saveSettings()
          }}>重新查看新手引导</Button>
        </div>
      </section>

      <section className='setting-card'>
        <h3><Timer size={15} /> 番茄钟</h3>
        <div className='appearance-row'>
          <label>每日番茄目标</label>
          <input type='number' className='time-input goal-input' min={1} max={30} value={String(settings.dailyPomodoroGoal || 4)} onChange={function (e) {
            setSettings(Object.assign({}, settings, { dailyPomodoroGoal: parseInt(e.target.value, 10) || 4 }))
          }} />
          <span className='setting-desc-inline'>个 / 天</span>
        </div>
        <div className='appearance-row'>
          <label>晚间未完成提醒</label>
          <input type='time' className='time-input' value={settings.unfinishedRemindAt || ''} onChange={function (e) {
            setSettings(Object.assign({}, settings, { unfinishedRemindAt: e.target.value || undefined }))
          }} />
          <span className='setting-desc-inline'>到点提醒当天还没完成的必做</span>
        </div>
        <div className='backup-actions sync-actions'>
          <Button variant='primary' onClick={function () { saveSettings() }}>保存番茄设置</Button>
        </div>
      </section>

      <section className='setting-card'>
        <h3><Zap size={15} /> 自动化</h3>
        <div className='setting-toggle-row'>
          <label className='checkbox'>
            <input type='checkbox' checked={!!settings.autoReviewOnComplete} onChange={function (e) {
              setSettings(Object.assign({}, settings, { autoReviewOnComplete: e.target.checked }))
            }} />
            <span className='checkbox-box'>{settings.autoReviewOnComplete ? '✓' : ''}</span>
            <span className='checkbox-label'>章节完成时自动安排复习计划 + 生成复习卡片</span>
          </label>
        </div>
        <div className='setting-toggle-row'>
          <label className='checkbox'>
            <input type='checkbox' checked={!!settings.autoCardOnMistake} onChange={function (e) {
              setSettings(Object.assign({}, settings, { autoCardOnMistake: e.target.checked }))
            }} />
            <span className='checkbox-box'>{settings.autoCardOnMistake ? '✓' : ''}</span>
            <span className='checkbox-label'>新增错题时自动生成复习卡片</span>
          </label>
        </div>
        <div className='backup-actions sync-actions'>
          <Button variant='primary' onClick={function () { saveSettings() }}>保存自动化设置</Button>
        </div>
      </section>

      <section className='setting-card'>
        <h3><FileText size={15} /> 自定义章节模板</h3>
        <p className='setting-desc'>新建章节时可选用内置或自定义模板。</p>
        <div className='template-manage-row'>
          <Button variant='primary' onClick={function () { openTemplateModal() }}>+ 新建模板</Button>
        </div>
        <div className='custom-template-list'>
          {(settings.chapterTemplates || []).map(function (t) {
            return (
              <div key={t.id} className='custom-template-item'>
                <span className='custom-template-name'>{t.name}</span>
                <Button variant='ghost' onClick={function () { openTemplateModal(t) }}>编辑</Button>
                <Button variant='danger' onClick={function () { deleteTemplate(t.id) }}>删除</Button>
              </div>
            )
          })}
          {!settings.chapterTemplates || settings.chapterTemplates.length === 0 ? <EmptyState compact showMascot={false} title='暂无自定义模板' hint='新建一个章节模板，快速开始记笔记' color='var(--c-settings)' /> : null}
        </div>
        {tplOpen ? (
          <Modal onClose={function () { setTplOpen(false) }} className='tpl-modal'>
            <h3>{tplId ? '编辑模板' : '新建模板'}</h3>
            <Input value={tplName} onChange={setTplName} placeholder='模板名，如：实验报告' autoFocus />
            <div className='tpl-field-list'>
              {tplFields.map(function (f, i) {
                return (
                  <div key={String(i)} className='tpl-field-row'>
                    <Input value={f.emoji || ''} onChange={function (v) { updateTplField(i, { emoji: v }) }} placeholder='图标' className='tpl-field-emoji' />
                    <Input value={f.label} onChange={function (v) { updateTplField(i, { label: v }) }} placeholder='字段名，如：学习目标' className='tpl-field-label' />
                    <Input value={f.placeholder || ''} onChange={function (v) { updateTplField(i, { placeholder: v }) }} placeholder='提示文字（可留空）' className='tpl-field-placeholder' />
                    <Button variant='danger' onClick={function () { removeTplField(i) }} title='删除该字段'>✕</Button>
                  </div>
                )
              })}
              <Button variant='default' onClick={addTplField}>+ 添加字段</Button>
            </div>
            <p className='tpl-preview-hint'>保存后自动生成 Markdown：</p>
            <pre className='tpl-preview'>{buildTemplateContent(tplFields.filter(function (f) { return f.label.trim() }))}</pre>
            <div className='reflection-modal-actions'>
              <Button variant='default' onClick={function () { setTplOpen(false) }}>取消</Button>
              <Button variant='primary' onClick={saveTemplate}>保存</Button>
            </div>
          </Modal>
        ) : null}
      </section>

      <section className='setting-card'>
        <h3><Save size={15} /> 数据备份</h3>
        <p className='setting-desc'>应用每天自动备份到系统用户目录（保留最近 10 份）。也可手动导出全部数据为 JSON 文件，或从备份恢复。换机迁移：本机「导出备份」→ 新机安装后「导入恢复」即可带走全部科目 / 设置 / 数据。</p>
        <div className='backup-actions'>
          <Button variant='default' onClick={async function () {
            const dir = await createDb().backupNow()
            window.alert(dir ? '已立即备份到：' + dir : '备份失败')
          }}><Shield size={13} /> 立即备份</Button>
          <Button variant='default' onClick={async function () {
            const p = await createDb().exportCardsCsv()
            if (p && p !== 'cancelled') window.alert('卡片已导出：' + p)
          }}><Layers size={13} /> 导出卡片 CSV（Anki）</Button>
          <Button variant='default' onClick={async function () {
            const p = await createDb().exportMarkdownFolder()
            if (p && p !== 'cancelled') window.alert('已导出到：' + p)
          }}><FileText size={13} /> 导出 Markdown 资料库</Button>
          <Button variant='default' onClick={function () {
            createDb().exportData().then(function (p) {
              if (p && p !== 'cancelled') window.alert('数据已导出：' + p)
            }).catch(function () {})
          }}><Download size={13} /> 导出备份</Button>
          {window.electronAPI ? (
            <Button variant='default' onClick={async function () {
              const result = await window.electronAPI!.importDataFromFile()
              if (result === 'ok') {
                window.alert('导入成功，即将刷新页面')
                window.location.reload()
              } else if (result && result !== 'cancelled') {
                window.alert('导入失败：' + result)
              }
            }}><Upload size={13} /> 导入恢复</Button>
          ) : null}
        </div>
      </section>

      <section className='setting-card'>
        <h3><SettingsIcon size={15} /> 系统</h3>
        <div className='setting-toggle-row'>
          <label className='checkbox'>
            <input type='checkbox' checked={!!settings.autoStart} onChange={function (e) {
              setSettings(Object.assign({}, settings, { autoStart: e.target.checked }))
            }} />
            <span className='checkbox-box'>{settings.autoStart ? '✓' : ''}</span>
            <span className='checkbox-label'>开机自启动</span>
          </label>
        </div>
        <div className='setting-toggle-row'>
          <label className='checkbox'>
            <input type='checkbox' checked={!!settings.startHidden} disabled={!settings.autoStart} onChange={function (e) {
              setSettings(Object.assign({}, settings, { startHidden: e.target.checked }))
            }} />
            <span className='checkbox-box'>{settings.startHidden ? '✓' : ''}</span>
            <span className='checkbox-label'>自启动时后台隐藏运行（不弹出窗口）</span>
          </label>
        </div>
        <p className='setting-desc'>自启动仅在登录系统时于后台运行、不弹窗；任何时候点击桌面图标、托盘图标或全局快捷键都能打开主窗口。首次启动始终显示窗口。修改后点击下方「保存设置」生效。</p>
        <div className='backup-actions'>
          <Button variant='default' onClick={function () { saveSettings() }}>保存设置</Button>
          <Button variant='default' onClick={checkUpdate}>检查更新</Button>
          {updateStatus ? <span className='ai-status'>{updateStatus}</span> : null}
        </div>
      </section>

      <section className='setting-card'>
        <h3><Info size={15} /> 关于</h3>
        <p className='setting-desc'>Study desktop v1.3.2 · 本地优先的学习工作台。数据存储于系统用户目录，无需联网。</p>
        <p className='settings-author'>作者：溪浣涟辞</p>
      </section>
    </div>
  )
}









