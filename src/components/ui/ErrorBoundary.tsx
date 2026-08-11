import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || String(err) }
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error('App error:', err, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className='error-boundary'>
          <div className='error-boundary-box'>
            <div className='error-boundary-emoji'>😢</div>
            <h3>小咕遇到了一点问题</h3>
            <p>{this.state.message}</p>
            <div className='error-boundary-actions'>
              <button className='btn btn-primary' onClick={function () { window.location.reload() }}>重新加载</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
