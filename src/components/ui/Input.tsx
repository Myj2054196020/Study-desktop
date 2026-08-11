import { classNames } from '../../lib/utils'

import type { RefObject } from 'react'

interface InputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  type?: string
  autoFocus?: boolean
  inputMode?: 'text' | 'numeric' | 'decimal'
  inputRef?: RefObject<HTMLInputElement | null>
}

export function Input(props: InputProps) {
  return (
    <input
      ref={props.inputRef}
      className={classNames('input', props.className)}
      value={props.value}
      type={props.type || 'text'}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      inputMode={props.inputMode}
      onChange={function (e) { props.onChange(e.target.value) }}
    />
  )
}

