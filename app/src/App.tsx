import { useState } from 'react'
import { InviteScreen, Loading, LoginScreen } from './components/Gate'
import HomeScreen from './components/HomeScreen'
import MyPage from './components/MyPage'
import Placeholder from './components/Placeholder'
import RecordSheet from './components/RecordSheet'
import ShelfScreen from './components/ShelfScreen'
import TabBar, { type TabId } from './components/TabBar'
import { AuthProvider, useAuth } from './lib/auth'
import { supabase } from './lib/supabase'

function Main({ signedIn }: { signedIn: boolean }) {
  const [tab, setTab] = useState<TabId>('home')
  const [recording, setRecording] = useState(false)

  return (
    <div className="app">
      {tab === 'home' && <HomeScreen />}
      {tab === 'shelf' && <ShelfScreen />}
      {tab === 'review' && <Placeholder title="ふりかえり" note="通算や月ごとの推移は、あとで作ります。" />}
      {tab === 'mypage' &&
        (signedIn ? (
          <MyPage />
        ) : (
          <Placeholder title="マイページ" note="ログインや公開の設定は、あとで作ります。" />
        ))}
      <TabBar current={tab} onSelect={setTab} onRecord={() => setRecording(true)} />
      {recording && <RecordSheet onClose={() => setRecording(false)} />}
    </div>
  )
}

function Gated() {
  const { state } = useAuth()
  switch (state.status) {
    case 'loading':
      return <Loading />
    case 'signed-out':
      return <LoginScreen />
    case 'needs-invite':
      return <InviteScreen />
    case 'ready':
      return <Main signedIn />
  }
}

export default function App() {
  // Supabase の接続情報がない間(まだ設定していない公開先など)は、見た目の確認用の画面を出す
  if (!supabase) return <Main signedIn={false} />
  return (
    <AuthProvider>
      <Gated />
    </AuthProvider>
  )
}
