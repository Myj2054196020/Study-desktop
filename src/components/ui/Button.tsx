import type { ReactNode, MouseEvent } from 'react'
import { classNames } from '../../lib/utils'

interface ButtonProps {
  children: ReactNode
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  title?: string
  className?: string
}

export function Button(props: ButtonProps) {
  return (
    <button
      className={classNames('btn', 'btn-' + (props.variant || 'default'), props.className)}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
    >
      {props.children}
    </button>
  )
}
