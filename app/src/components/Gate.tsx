import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'

function GateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <section className="screen gate">
        <div className="photo full" />
        <div className="veil" />
        <div className="gate-card glass">{children}</div>
      </section>
    </div>
  )
}

export function Loading() {
  return (
    <GateFrame>
      <p className="gate-note">読み込み中…</p>
    </GateFrame>
  )
}

export function LoginScreen() {
  const { signInWithGoogle } = useAuth()
  return (
    <GateFrame>
      <div className="logo gate-logo">
        <i className="ti ti-leaf" aria-hidden="true" /> つむよむ
      </div>
      <p className="gate-lead">論文を読んだ日々を、積み上げていく。</p>
      <button type="button" className="gate-button" onClick={signInWithGoogle}>
        <i className="ti ti-brand-google" aria-hidden="true" /> Google でログイン
      </button>
      <p className="gate-note">いまは、招待された人だけが使えます。</p>
    </GateFrame>
  )
}

export function InviteScreen() {
  const { claimInvite, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(await claimInvite(code, username))
    setBusy(false)
  }

  return (
    <GateFrame>
      <h1 className="gate-title">はじめまして</h1>
      <p className="gate-lead">招待コードと、使いたいユーザー名を入れてください。</p>
      <form onSubmit={submit} className="gate-form">
        <label>
          招待コード
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <label>
          ユーザー名
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            pattern="[a-z0-9_]{3,20}"
            title="英小文字・数字・_ の 3〜20 文字"
            required
          />
          <small>公開ページのアドレスに使います。英小文字・数字・_ の 3〜20 文字。</small>
        </label>
        {error && (
          <p className="gate-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="gate-button" disabled={busy}>
          {busy ? '確認しています…' : '登録する'}
        </button>
      </form>
      <button type="button" className="gate-link" onClick={signOut}>
        ログアウト
      </button>
    </GateFrame>
  )
}
