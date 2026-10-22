import { useState } from 'react'
import { InviteScreen, Loading, LoginScreen } from './components/Gate'
import HomeScreen from './components/HomeScreen'
import MyPage from './components/MyPage'
import Placeholder from './components/Placeholder'
import PublicPage from './components/PublicPage'
import RecordSheet from './components/RecordSheet'
import ReviewScreen from './components/ReviewScreen'
import ShelfScreen from './components/ShelfScreen'
import TabBar, { type TabId } from './components/TabBar'
import { AuthProvider, useAuth } from './lib/auth'
import { parsePublicPath } from './lib/publicView'
import { RecordsProvider } from './lib/RecordsContext'
import { supabase } from './lib/supabase'

/** 記録の入力シート。entryId があれば、その記録を直す */
type Sheet = { entryId?: string } | null

function Main({ signedIn }: { signedIn: boolean }) {
  const [tab, setTab] = useState<TabId>('home')
  const [sheet, setSheet] = useState<Sheet>(null)

  const record = () => setSheet({})
  const open = (entryId: string) => setSheet({ entryId })

  return (
    <div className="app">
      {tab === 'home' && <HomeScreen onRecord={record} onOpen={open} />}
      {tab === 'shelf' && <ShelfScreen onOpen={open} />}
      {tab === 'review' && <ReviewScreen onOpen={open} />}
      {tab === 'mypage' &&
        (signedIn ? (
          <MyPage />
        ) : (
          <Placeholder title="マイページ" note="ログインや公開の設定は、あとで作ります。" />
        ))}
      <TabBar current={tab} onSelect={setTab} onRecord={record} />
      {/* 開くたびに作り直して、前の入力を引きずらない */}
      {sheet && <RecordSheet key={sheet.entryId ?? 'new'} entryId={sheet.entryId} onClose={() => setSheet(null)} />}
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
      return (
        <RecordsProvider>
          <Main signedIn />
        </RecordsProvider>
      )
  }
}

export default function App() {
  // 公開ページ(/u/ユーザー名)は、ログインなしで見られる
  const publicUsername = parsePublicPath(window.location.pathname)
  if (publicUsername) return <PublicPage username={publicUsername} />

  // Supabase の接続情報がない間(まだ設定していない公開先など)は、見た目の確認用の画面を出す
  if (!supabase)
    return (
      <RecordsProvider>
        <Main signedIn={false} />
      </RecordsProvider>
    )
  return (
    <AuthProvider>
      <Gated />
    </AuthProvider>
  )
}
