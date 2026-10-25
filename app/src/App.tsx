import { useCallback, useState } from 'react'
import { InviteScreen, LoadErrorScreen, Loading, LoginScreen } from './components/Gate'
import HomeScreen from './components/HomeScreen'
import MyPage from './components/MyPage'
import Placeholder from './components/Placeholder'
import PublicPage from './components/PublicPage'
import RecordSheet from './components/RecordSheet'
import ReviewScreen from './components/ReviewScreen'
import SearchScreen from './components/SearchScreen'
import ShelfScreen from './components/ShelfScreen'
import TabBar, { type TabId } from './components/TabBar'
import Toast from './components/Toast'
import { AuthProvider, useAuth } from './lib/auth'
import type { PaperDraft } from './lib/biblio'
import { parsePublicPath } from './lib/publicView'
import { RecordsProvider, useRecords } from './lib/RecordsContext'
import { supabase } from './lib/supabase'
import { useOnline } from './lib/useOnline'

/** 通信の状態に応じた、上のお知らせ */
function Banner() {
  const online = useOnline()
  const { status, reload } = useRecords()
  if (!online) {
    return (
      <div className="banner" role="status">
        オフラインです。通信が戻ると、使えるようになります。
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="banner" role="alert">
        記録を読み込めませんでした。
        <button type="button" onClick={() => void reload()}>
          もう一度読み込む
        </button>
      </div>
    )
  }
  return null
}

/** 記録の入力シート。entryId があれば、その記録を直す。draft があれば、その論文を記録する(さがすから) */
type Sheet = { entryId?: string; draft?: PaperDraft } | null

function Main({ signedIn }: { signedIn: boolean }) {
  const [tab, setTab] = useState<TabId>('home')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const record = () => setSheet({})
  const open = (entryId: string) => setSheet({ entryId })
  const recordPaper = (draft: PaperDraft) => setSheet({ draft })

  return (
    <div className="app with-nav">
      <Banner />
      {tab === 'home' && <HomeScreen onRecord={record} onOpen={open} />}
      {tab === 'search' && <SearchScreen onRecord={recordPaper} onOpen={open} onToast={setToast} />}
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
      {sheet && (
        <RecordSheet
          key={sheet.entryId ?? sheet.draft?.title ?? 'new'}
          entryId={sheet.entryId}
          draft={sheet.draft}
          onClose={() => setSheet(null)} onDone={setToast} />
      )}
      {toast && <Toast key={toast} message={toast} onDone={clearToast} />}
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
    case 'error':
      return <LoadErrorScreen />
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
