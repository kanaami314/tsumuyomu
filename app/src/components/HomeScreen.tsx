import Bookmarks from './Bookmarks'
import { FIELD_COLORS, toBook } from '../lib/books'
import { useRecords } from '../lib/RecordsContext'
import { buildSpine } from '../lib/spine'
import { countEntries, formatDay } from '../lib/stats'

interface Props {
  onRecord: () => void
  onOpen: (entryId: string) => void
}

export default function HomeScreen({ onRecord, onOpen }: Props) {
  const { entries, status } = useRecords()
  const latest = entries.find((e) => e.status === 'done')
  const book = latest ? toBook({ id: latest.id, rating: latest.rating, paper: latest.paper }) : null
  const lines = latest?.comment?.split('\n').filter(Boolean) ?? []

  return (
    <section className="screen home" aria-label="ホーム">
      <div className="photo full" />
      <div className="veil" />
      <header className="top">
        <span className="logo">
          <i className="ti ti-leaf" aria-hidden="true" /> つむよむ
        </span>
        <span className="av glass">
          <i className="ti ti-user" aria-hidden="true" />
        </span>
      </header>
      {latest && book ? (
        <div className="latest">
          <div className="lk">
            <span>最近読んだ論文</span>
            <span>
              {countEntries(entries).total}本目　{formatDay(latest.read_on)}
            </span>
          </div>
          <button type="button" className="lcover" style={{ background: FIELD_COLORS[book.field] }} onClick={() => onOpen(latest.id)}>
            <span className="rb" style={{ background: buildSpine(book, 0).ribbon }} />
            <span className="lt">{book.title}</span>
            <span className="la">
              {book.authors}　{book.year}
            </span>
          </button>
          <p className="quote">
            {lines.length > 0 ? (
              lines.map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))
            ) : (
              <span className="quiet">ひとことは、まだありません。</span>
            )}
          </p>
          <Bookmarks value={latest.rating ?? 0} className="hs" />
        </div>
      ) : (
        <div className="latest empty">
          <p className="quote">{status === 'loading' ? '読み込み中…' : 'まだ、1本も記録がありません。'}</p>
          {status !== 'loading' && (
            <button type="button" className="gate-button" onClick={onRecord}>
              最初の1本を記録する
            </button>
          )}
        </div>
      )}
    </section>
  )
}
