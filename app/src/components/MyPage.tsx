import { useAuth } from '../lib/auth'

export default function MyPage() {
  const { state, signOut } = useAuth()
  if (state.status !== 'ready') return null
  const { profile, session } = state
  return (
    <section className="screen placeholder" aria-label="マイページ">
      <h1>{profile.display_name || profile.username}</h1>
      <p>
        @{profile.username}
        <br />
        {session.user.email}
      </p>
      <p>公開の設定は、あとで作ります。</p>
      <button type="button" className="gate-link" onClick={signOut}>
        ログアウト
      </button>
    </section>
  )
}
