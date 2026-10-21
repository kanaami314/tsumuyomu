import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toBook } from '../lib/books'
import { useRecords } from '../lib/RecordsContext'
import { buildSpine, layoutRows } from '../lib/spine'
import { countEntries } from '../lib/stats'
import NewShelfChip from './NewShelfChip'

interface Props {
  onOpen: (entryId: string) => void
}

const ALL = 'all'

export default function ShelfScreen({ onOpen }: Props) {
  const { entries, shelves, shelfIdsOf, addShelf, status } = useRecords()
  const boxRef = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(0)
  const [filter, setFilter] = useState(ALL)

  // 棚の幅に応じて、段の分け方を変える
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => setAvailable(el.clientWidth - 16)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 消された棚を選んだままにしない
  const activeFilter = filter === ALL || shelves.some((s) => s.id === filter) ? filter : ALL
  const counts = countEntries(entries)

  const rows = useMemo(() => {
    // 色の揺らぎは、絞り込む前の並び順で決める(棚を切り替えても、同じ本は同じ色)
    const spines = entries
      .filter((e) => e.status === 'done')
      .map((e, i) => ({ id: e.id, spine: buildSpine(toBook({ id: e.id, rating: e.rating, paper: e.paper }), i) }))
    const shown = spines.filter((s) => activeFilter === ALL || shelfIdsOf(s.id).includes(activeFilter))
    return layoutRows(
      shown.map((s) => s.spine),
      available,
    )
  }, [entries, activeFilter, shelfIdsOf, available])

  const empty = rows.length === 0

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
          </button>
        ))}
        <NewShelfChip onCreate={async (name) => (await addShelf(name)) !== null} />
      </div>
      <div className="case">
        <div className="back" ref={boxRef}>
          {empty && (
            <p className="shelf-empty">
              {status === 'loading'
                ? '読み込み中…'
                : activeFilter === ALL
                  ? 'まだ、棚は空です。まん中の「記録」から、1本目を迎えましょう。'
                  : 'この棚には、まだ何もありません。'}
            </p>
          )}
          {rows.map((row, k) => (
            <div key={k}>
              <div className="tier">
                <div className="row">
                  {row.map((s) =>
                    s.kind === 'face' ? (
                      <button
                        key={s.book.id}
                        type="button"
                        className="face"
                        style={{ background: s.background, color: s.color }}
                        onClick={() => onOpen(s.book.id)}
                        aria-label={s.book.title}
                      >
                        <span className="rb" style={{ background: s.ribbon }} />
                        <span className="bt">{s.book.title}</span>
                        <span className="ln" />
                        <span className="au">
                          {s.book.authors}　{s.book.year}
                        </span>
                      </button>
                    ) : (
                      <button
                        key={s.book.id}
                        type="button"
                        className="sp"
                        style={{ width: s.width, height: s.height, background: s.background, color: s.color }}
                        title={s.book.title}
                        aria-label={s.book.title}
                        onClick={() => onOpen(s.book.id)}
                      >
                        <span className="t">{s.book.shortTitle}</span>
                        <span className="y">{s.book.year}</span>
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className={`plank p${k % 3}`} />
            </div>
          ))}
          {!empty ? null : (
            <div>
              <div className="tier">
                <div className="row" />
              </div>
              <div className="plank p0" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
