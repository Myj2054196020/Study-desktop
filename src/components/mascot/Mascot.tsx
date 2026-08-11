import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../stores/AppContext'
import { createDb } from '../../lib/db'
import owlSvg from '../../../assets/brand/xiaogu-tray-final.svg?raw'

export function Mascot() {
  const { dataVersion } = useApp()
  const [dismissed, setDismissed] = useState(false)
  const [bubble, setBubble] = useState('')
  const [bounceKey, setBounceKey] = useState(0)
  const [due, setDue] = useState(0)
  const [openTasks, setOpenTasks] = useState(0)

  useEffect(function () {
    if (dismissed) return
    createDb().getDueCards(1).then(function (r) { setDue(r.length) }).catch(function () {})
    createDb().getDailyTasks().then(function (list) {
      setOpenTasks(list.filter(function (t) { return !t.completed }).length)
    }).catch(function () {})
  }, [dataVersion, dismissed])

  function pickMessage(): string {
    const h = new Date().getHours()
    if (due > 0) return '有 ' + due + ' 张卡片到期了，灯还亮着，趁热复习吧'
    if (openTasks > 0) return '还有 ' + openTasks + ' 件待办等着你完成'
    if (h >= 22 || h < 6) return '夜深了，学完这一节就早点休息吧'
    if (h < 12) return '早上好！今天想先学点什么？'
    if (h < 18) return '下午好，来一段专注时间？'
    return '晚上好，小咕陪你学习'
  }

  const dragRef = useRef({ sx: 0, sy: 0, baseX: 0, baseY: 0, moved: false, active: false })
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [swingKey, setSwingKey] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [look, setLook] = useState(0)
  const MAX_X = 180
  const MAX_Y = 140

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    // 点「×」关闭按钮时不要启动拖拽/捕获指针，否则 click 会被父级吃掉，叉就"删不掉"
    const t = e.target as HTMLElement
    if (t && typeof t.closest === 'function' && t.closest('.mascot-close')) return
    dragRef.current = { sx: e.clientX, sy: e.clientY, baseX: dragPos.x, baseY: dragPos.y, moved: false, active: true }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d.active) return
    const dx = Math.max(-MAX_X, Math.min(MAX_X, e.clientX - d.sx + d.baseX))
    const dy = Math.max(-MAX_Y, Math.min(MAX_Y, e.clientY - d.sy + d.baseY))
    if (Math.abs(e.clientX - d.sx) > 6 || Math.abs(e.clientY - d.sy) > 6) d.moved = true
    setLook(Math.max(-12, Math.min(12, (e.clientX - d.sx) * 0.1)))
    setDragPos({ x: dx, y: dy })
  }
  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (d.moved) {
      setSwingKey(function (k) { return k + 1 })
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const item = el && typeof el.closest === 'function' ? el.closest('.sidebar-nav-item') : null
      const label = item && item.textContent ? item.textContent : ''
      const ctxMsg =
        label.indexOf('番茄') >= 0 ? '想开始专注吗？我帮你计时' :
        label.indexOf('必做') >= 0 ? '记一件必做，我来提醒你' :
        label.indexOf('复习') >= 0 ? '有卡片到期的话，现在正好复习' :
        label.indexOf('章节') >= 0 ? '新章节？记得学完生成卡片' : ''
      if (ctxMsg) {
        setBubble(ctxMsg)
        window.setTimeout(function () { setBubble('') }, 4500)
      }
    }
    d.active = false
    setDragging(false)
    setLook(0)
    setDragPos({ x: 0, y: 0 })
  }

  if (dismissed) return null

  return (
    <div className={dragging ? 'mascot dragging' : 'mascot'} style={{ transform: 'translate(' + dragPos.x + 'px,' + dragPos.y + 'px)' }} title='点我和小咕说说话 · 按住可拖动' onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onClick={function () {
      if (dragRef.current.moved) return
      setBounceKey(function (k) { return k + 1 })
      setBubble(pickMessage())
      window.setTimeout(function () { setBubble('') }, 4500)
    }}>
      {bubble ? <div className='mascot-bubble'>{bubble}</div> : null}
      <div className='mascot-breathe'>
        <div key={String(bounceKey) + '-' + String(swingKey)} className={(bounceKey > 0 ? 'mascot-owl bounce' : 'mascot-owl') + (swingKey > 0 ? ' swing' : '')} style={dragging ? { transform: 'rotate(' + look + 'deg)' } : undefined} dangerouslySetInnerHTML={{ __html: owlSvg }} />
      </div>
      <button className='mascot-close' title='暂时藏起小咕' onClick={function (e) { e.stopPropagation(); setDismissed(true) }}>×</button>
    </div>
  )
}
