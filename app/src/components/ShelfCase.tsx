import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Book } from '../lib/books'
import { buildSpine, layoutRows } from '../lib/spine'

export interface ShelfItem {
  book: Book
  /** 色の揺らぎを決める番号。絞り込んでも、同じ本は同じ色になるよう、呼び出し側で決める */
  seed: number
}

interface Props {
  items: ShelfItem[]
  emptyText: string
  onOpen: (bookId: string) => void
}

// 棚(木の枠と、並んだ背表紙・表紙)。書棚と、公開ページで共有する
export default function ShelfCase({ items, emptyText, onOpen }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(0)

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

  const rows = useMemo(
    () =>
      layoutRows(
        items.map((i) => buildSpine(i.book, i.seed)),
        available,
      ),
    [items, available],
  )
  const empty = rows.length === 0
  // 本が上から順に落ちて並ぶよう、並び順(--i)を渡す
  let order = 0
  const orderStyle = () => ({ '--i': order++ }) as CSSProperties

  return (
    <div className="case">
      <div className="back" ref={boxRef}>
        {empty && <p className="shelf-empty">{emptyText}</p>}
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
                      style={{ ...orderStyle(), background: s.background, color: s.color }}
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
                      style={{ ...orderStyle(), width: s.width, height: s.height, background: s.background, color: s.color }}
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
        {empty && (
          <div>
            <div className="tier">
              <div className="row" />
            </div>
            <div className="plank p0" />
          </div>
        )}
      </div>
    </div>
  )
}
