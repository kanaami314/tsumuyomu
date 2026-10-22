import { useMemo, useState } from 'react'
import { toBook } from '../lib/books'
import { useRecords } from '../lib/RecordsContext'
import { countEntries } from '../lib/stats'
import NewShelfChip from './NewShelfChip'
import ShelfCase from './ShelfCase'

interface Props {
  onOpen: (entryId: string) => void
}

const ALL = 'all'

export default function ShelfScreen({ onOpen }: Props) {
  const { entries, shelves, shelfIdsOf, addShelf, status } = useRecords()
  const [filter, setFilter] = useState(ALL)

  // 消された棚を選んだままにしない
  const activeFilter = filter === ALL || shelves.some((s) => s.id === filter) ? filter : ALL
  const counts = countEntries(entries)

  const items = useMemo(
    () =>
      // 色の揺らぎは、絞り込む前の並び順で決める(棚を切り替えても、同じ本は同じ色)
      entries
        .filter((e) => e.status === 'done')
        .map((e, seed) => ({ id: e.id, seed, book: toBook({ id: e.id, rating: e.rating, paper: e.paper }) }))
        .filter((i) => activeFilter === ALL || shelfIdsOf(i.id).includes(activeFilter)),
    [entries, activeFilter, shelfIdsOf],
  )

  const emptyText =
    status === 'loading'
      ? '読み込み中…'
      : activeFilter === ALL
        ? 'まだ、棚は空です。まん中の「記録」から、1本目を迎えましょう。'
        : 'この棚には、まだ何もありません。'

  return (
    <section className="screen shelf" aria-label="書棚">
      <div className="photo sh-photo" />
      <div className="glow" />
      <div className="sh-head">
        <h1>わたしの書棚</h1>
        <p>毎日1本、ゆっくり読んでいます。</p>
        <dl className="cnt">
          <div>
            <dd>{counts.total}</dd>
            <dt>通算</dt>
          </div>
          <div>
            <dd>{counts.month}</dd>
            <dt>今月</dt>
          </div>
          <div>
            <dd>{counts.days}</dd>
            <dt>読んだ日</dt>
          </div>
        </dl>
      </div>
      <div className="chips">
        <button type="button" className={`chip${activeFilter === ALL ? ' on' : ''}`} onClick={() => setFilter(ALL)}>
          すべて
        </button>
        {shelves.map((s) => (
          <button key={s.id} type="button" className={`chip${activeFilter === s.id ? ' on' : ''}`} onClick={() => setFilter(s.id)}>
            {s.name}
            {s.visibility === 'public' && <i className="ti ti-world" aria-label="公開中" />}
          </button>
        ))}
        <NewShelfChip onCreate={async (name) => (await addShelf(name)) !== null} />
      </div>
      <ShelfCase items={items} emptyText={emptyText} onOpen={onOpen} />
    </section>
  )
}
