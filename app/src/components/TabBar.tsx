import Icon, { type IconName } from './Icon'

export type TabId = 'home' | 'shelf' | 'review' | 'mypage'

interface Props {
  current: TabId
  onSelect: (tab: TabId) => void
  onRecord: () => void
}

interface TabDef {
  id: TabId
  icon: IconName
  label: string
}

const LEFT: TabDef[] = [
  { id: 'home', icon: 'home', label: 'ホーム' },
  { id: 'shelf', icon: 'books', label: '書棚' },
]
const RIGHT: TabDef[] = [
  { id: 'review', icon: 'history', label: 'ふりかえり' },
  { id: 'mypage', icon: 'user', label: 'マイページ' },
]

export default function TabBar({ current, onSelect, onRecord }: Props) {
  const tab = (t: TabDef) => (
    <button
      key={t.id}
      type="button"
      className={`tab${current === t.id ? ' on' : ''}`}
      aria-current={current === t.id ? 'page' : undefined}
      onClick={() => onSelect(t.id)}
    >
      <Icon name={t.icon} />
      {t.label}
    </button>
  )
  return (
    <nav className="tabbar" aria-label="メイン">
      {/* PC では、左の縦の帯になり、上にロゴを出す(スマホでは隠す) */}
      <span className="logo side-logo">
        <Icon name="leaf" /> つむよむ
      </span>
      {LEFT.map(tab)}
      <button type="button" className="tab add" aria-label="記録する" onClick={onRecord}>
        <Icon name="plus" />
        <span>記録</span>
      </button>
      {RIGHT.map(tab)}
    </nav>
  )
}
