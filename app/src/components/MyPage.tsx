import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { publicPath } from '../lib/publicView'
import { useRecords } from '../lib/RecordsContext'

function ShelfRowItem({ id, name, isPublic }: { id: string; name: string; isPublic: boolean }) {
  const { setShelfPublic, removeShelf } = useRecords()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true)
    setError(await task())
    setBusy(false)
  }

  return (
    <li className="shelf-row">
      <div className="shelf-row-main">
        <span className="name">{name}</span>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          aria-label={`${name} を公開する`}
          className={`tog${isPublic ? ' on' : ''}`}
          disabled={busy}
          onClick={() => run(() => setShelfPublic(id, !isPublic))}
        />
      </div>
      <div className="shelf-row-sub">
        <small>{isPublic ? '公開中(中の「公開」にした記録だけが見えます)' : '非公開'}</small>
        {confirming ? (
          <span className="danger">
            <span>この棚を消します(記録は消えません)。</span>
            <button type="button" className="danger-yes" disabled={busy} onClick={() => run(() => removeShelf(id))}>
              消す
            </button>
            <button type="button" className="gate-link" onClick={() => setConfirming(false)}>
              やめる
            </button>
          </span>
        ) : (
          <button type="button" className="gate-link" onClick={() => setConfirming(true)}>
            削除
          </button>
        )}
      </div>
      {error && (
        <p className="gate-error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

export default function MyPage() {
  const { state, signOut, updateProfile } = useAuth()
  const { shelves, entries } = useRecords()
  const profile = state.status === 'ready' ? state.profile : null
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  if (state.status !== 'ready' || !profile) return null

  const url = `${window.location.origin}${publicPath(profile.username)}`
  const publicCount = entries.filter((e) => e.visibility === 'public' && e.status === 'done').length

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const failure = await updateProfile(displayName, bio)
    setMessage(failure ? { text: failure, ok: false } : { text: '保存しました。', ok: true })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMessage({ text: 'コピーできませんでした。アドレスを選んで、コピーしてください。', ok: false })
    }
  }

  return (
    <section className="screen mypage" aria-label="マイページ">
      <div className="mypage-head">
        <h1>{profile.display_name || profile.username}</h1>
        <p>
          @{profile.username}
          <br />
          {state.session.user.email}
        </p>
      </div>

      <div className="card glass">
        <h2>公開ページ</h2>
        <p className="legend">
          公開にした記録と棚だけが、このアドレスで見えます。ログインしていない人にも見えます。いまの公開中の記録は、{publicCount}本です。
        </p>
        <p className="url">{url}</p>
        <div className="actions">
          <a className="gate-button small" href={publicPath(profile.username)} target="_blank" rel="noopener noreferrer">
            開く
          </a>
          <button type="button" className="gate-button small ghost" onClick={copy}>
            {copied ? 'コピーしました' : 'アドレスをコピー'}
          </button>
        </div>
        <p className="legend">記録を公開にするには、書棚で本を開いて「この記録を公開する」を入れてください。</p>
      </div>

      <form className="card glass gate-form" onSubmit={save}>
        <h2>プロフィール</h2>
        <label>
          表示名
          <input value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} placeholder={profile.username} />
        </label>
        <label>
          自己紹介
          <textarea className="ta" value={bio} maxLength={400} onChange={(e) => setBio(e.target.value)} />
        </label>
        {message && (
          <p className={message.ok ? 'legend' : 'gate-error'} role="status">
            {message.text}
          </p>
        )}
        <button type="submit" className="gate-button small">
          保存する
        </button>
      </form>

      <div className="card glass">
        <h2>棚の公開</h2>
        {shelves.length === 0 ? (
          <p className="legend">まだ、棚がありません。書棚の「+ 棚」から作れます。</p>
        ) : (
          <ul className="shelf-rows">
            {shelves.map((s) => (
              <ShelfRowItem key={s.id} id={s.id} name={s.name} isPublic={s.visibility === 'public'} />
            ))}
          </ul>
        )}
      </div>

      <button type="button" className="gate-link logout" onClick={signOut}>
        ログアウト
      </button>
    </section>
  )
}
