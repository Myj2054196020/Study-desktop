import type { CSSProperties, ReactNode } from 'react'
import owlSvg from '../../../assets/brand/xiaogu-tray-final.svg?raw'

interface EmptyStateProps {
  title: string
  hint?: string
  action?: ReactNode
  color?: string
  compact?: boolean
  showMascot?: boolean
}

export function EmptyState(props: EmptyStateProps) {
  const { title, hint, action, color = 'var(--accent)', compact = false, showMascot = true } = props
  return (
    <div
      className={compact ? 'empty-state compact' : 'empty-state'}
      style={{ '--empty-c': color } as CSSProperties}
    >
      {showMascot ? (
        <div className='empty-mascot'>
          <div className='empty-mascot-bg' />
          <div className='empty-mascot-owl' dangerouslySetInnerHTML={{ __html: owlSvg }} />
        </div>
      ) : null}
      <div className='empty-title'>{title}</div>
      {hint ? <div className='empty-hint'>{hint}</div> : null}
      {action ? <div className='empty-action'>{action}</div> : null}
    </div>
  )
}
