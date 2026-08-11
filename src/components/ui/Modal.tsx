import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { classNames } from '../../lib/utils'

interface ModalProps {
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Modal(props: ModalProps) {
  useEffect(function () {
    const onKey = function (e: KeyboardEvent) {
      if (e.key === 'Escape') {
        props.onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return function () { window.removeEventListener('keydown', onKey) }
  }, [props.onClose])

  return (
    <div className='modal-overlay' onClick={props.onClose}>
      <div className={classNames('modal', props.className)} onClick={function (e) { e.stopPropagation() }}>
        {props.children}
      </div>
    </div>
  )
}
