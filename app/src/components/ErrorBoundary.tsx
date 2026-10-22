import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  failed: boolean
}

// 想定していないエラーで、画面が真っ白にならないようにする
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="app">
        <section className="screen gate">
          <div className="photo full" />
          <div className="veil" />
          <div className="gate-card glass">
            <h1 className="gate-title">うまく表示できませんでした</h1>
            <p className="gate-lead">画面を読み込み直すと、直ることがあります。記録は、消えていません。</p>
            <button type="button" className="gate-button" onClick={() => window.location.reload()}>
              読み込み直す
            </button>
          </div>
        </section>
      </div>
    )
  }
}
