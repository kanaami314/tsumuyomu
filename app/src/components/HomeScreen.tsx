import Bookmarks from './Bookmarks'
import { FIELD_COLORS, SAMPLE_LATEST } from '../lib/books'
import { buildSpine } from '../lib/spine'

export default function HomeScreen() {
  const { count, date, book, comment, rating } = SAMPLE_LATEST
  const { ribbon } = buildSpine(book, 0)
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
      <div className="latest">
        <div className="lk">
          <span>最近読んだ論文</span>
          <span>
            {count}本目　{date}
          </span>
        </div>
        <div className="lcover" style={{ background: FIELD_COLORS[book.field] }}>
          <span className="rb" style={{ background: ribbon }} />
          <div className="lt">{book.title}</div>
          <div className="la">
            {book.authors}　{book.year}
          </div>
        </div>
        <p className="quote">
          {comment.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
        <Bookmarks value={rating} className="hs" />
      </div>
    </section>
  )
}
