import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SAMPLE_BOOKS, SAMPLE_COUNTS } from '../lib/books'
import { buildSpine, layoutRows } from '../lib/spine'

const CHIPS = ['すべて', 'じっくり読んだ', '人に勧めたい', '読みたい']

export default function ShelfScreen() {
  const boxRef = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(0)
  const [chip, setChip] = useState(CHIPS[0])

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

  const rows = useMemo(() => layoutRows(SAMPLE_BOOKS.map(buildSpine), available), [available])

  return (
    <section className="screen shelf" aria-label="書棚">
      <div className="photo sh-photo" />
      <div className="glow" />
      <div className="sh-head">
        <h1>わたしの書棚</h1>
        <p>毎日1本、ゆっくり読んでいます。</p>
        <dl className="cnt">
          <div>
            <dd>{SAMPLE_COUNTS.total}</dd>
            <dt>通算</dt>
          </div>
          <div>
            <dd>{SAMPLE_COUNTS.month}</dd>
            <dt>今月</dt>
          </div>
          <div>
            <dd>{SAMPLE_COUNTS.days}</dd>
            <dt>読んだ日</dt>
          </div>
        </dl>
      </div>
      <div className="chips">
        {CHIPS.map((c) => (
          <button key={c} type="button" className={`chip${chip === c ? ' on' : ''}`} onClick={() => setChip(c)}>
            {c}
          </button>
        ))}
        <button type="button" className="chip add">
          + 棚
        </button>
      </div>
      <div className="case">
        <div className="back" ref={boxRef}>
          {rows.map((row, k) => (
            <div key={k}>
              <div className="tier">
                <div className="row">
                  {row.map((s, i) =>
                    s.kind === 'face' ? (
                      <div key={i} className="face" style={{ background: s.background, color: s.color }}>
                        <span className="rb" style={{ background: s.ribbon }} />
                        <div className="bt">{s.book.title}</div>
                        <div className="ln" />
                        <div className="au">
                          {s.book.authors}　{s.book.year}
                        </div>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="sp"
                        style={{ width: s.width, height: s.height, background: s.background, color: s.color }}
                        title={s.book.title}
                      >
                        <span className="t">{s.book.shortTitle}</span>
                        <span className="y">{s.book.year}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
              <div className={`plank p${k % 3}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
