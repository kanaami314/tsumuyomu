export type TabId = 'home' | 'shelf' | 'review' | 'mypage'

interface Props {
  current: TabId
  onSelect: (tab: TabId) => void
  onRecord: () => void
}

interface TabDef {
  id: TabId
  icon: string
  label: string
}

const LEFT: TabDef[] = [
  { id: 'home', icon: 'ti-home', label: 'ホーム' },
  { id: 'shelf', icon: 'ti-books', label: '書棚' },
]
const RIGHT: TabDef[] = [
  { id: 'review', icon: 'ti-history', label: 'ふりかえり' },
  { id: 'mypage', icon: 'ti-user', label: 'マイページ' },
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
      <i className={`ti ${t.icon}`} aria-hidden="true" />
      {t.label}
    </button>
  )
  return (
    <nav className="tabbar" aria-label="メイン">
      {LEFT.map(tab)}
      <button type="button" className="tab add" aria-label="記録する" onClick={onRecord}>
        <i className="ti ti-plus" aria-hidden="true" />
        <span>記録</span>
      </button>
      {RIGHT.map(tab)}
    </nav>
  )
}
