import { useState } from 'react'
import HomeScreen from './components/HomeScreen'
import Placeholder from './components/Placeholder'
import RecordSheet from './components/RecordSheet'
import ShelfScreen from './components/ShelfScreen'
import TabBar, { type TabId } from './components/TabBar'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [recording, setRecording] = useState(false)

  return (
    <div className="app">
      {tab === 'home' && <HomeScreen />}
      {tab === 'shelf' && <ShelfScreen />}
      {tab === 'review' && <Placeholder title="ふりかえり" note="通算や月ごとの推移は、あとで作ります。" />}
      {tab === 'mypage' && <Placeholder title="マイページ" note="ログインや公開の設定は、あとで作ります。" />}
      <TabBar current={tab} onSelect={setTab} onRecord={() => setRecording(true)} />
      {recording && <RecordSheet onClose={() => setRecording(false)} />}
    </div>
  )
}
