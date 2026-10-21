import { useEffect, useState } from 'react'

interface Props {
  onClose: () => void
}

const SHELVES = ['じっくり読んだ', '人に勧めたい']
const DEPTHS = ['さらっと', 'じっくり'] as const

export default function RecordSheet({ onClose }: Props) {
  const [doi, setDoi] = useState('10.1038/nature14539')
  const [depth, setDepth] = useState<(typeof DEPTHS)[number]>('じっくり')
  const [comment, setComment] = useState('')
  const [rating, setRating] = useState(4)
  const [shelves, setShelves] = useState<string[]>([SHELVES[0]])
  const [isPublic, setIsPublic] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggleShelf = (name: string) =>
    setShelves((cur) => (cur.includes(name) ? cur.filter((s) => s !== name) : [...cur, name]))

  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="grab2" />
        <div className="scroll">
          <div className="shead">
            <div id="sheet-title" className="st">
              1本記録する
            </div>
            <div className="ss">今日読んだ論文を、棚へ。</div>
            <button type="button" className="x" aria-label="閉じる" onClick={onClose}>
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>

          <label className="fld">
            <i className="ti ti-link" style={{ color: '#8FA593' }} aria-hidden="true" />
            <input
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="DOI か arXiv の URL"
              inputMode="url"
              aria-label="DOI または URL"
            />
            <b>貼り付け</b>
          </label>

          <div className="found">
            <div className="mini" />
            <div>
              <div className="t">Deep learning</div>
              <div className="m">
                LeCun, Bengio, Hinton
                <br />
                Nature　2015
              </div>
              <div className="ok">
                <i className="ti ti-circle-check" aria-hidden="true" /> 書誌情報を取得しました
              </div>
            </div>
          </div>

          <div className="lb">読み方</div>
          <div className="seg" role="group" aria-label="読み方">
            {DEPTHS.map((d) => (
              <button key={d} type="button" className={depth === d ? 'on' : ''} onClick={() => setDepth(d)}>
                {d}
              </button>
            ))}
          </div>

          <label className="lb" htmlFor="comment">
            ひとこと(任意)
          </label>
          <textarea
            id="comment"
            className="ta"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="図1の整理が分かりやすかった。"
          />

          <div className="lb">刺さった度</div>
          <div className="hearts" role="group" aria-label="刺さった度">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n}`} onClick={() => setRating(n === rating ? 0 : n)}>
                <i className={`ti ${n <= rating ? 'ti-bookmark-filled f' : 'ti-bookmark'}`} aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="lb">棚</div>
          <div className="row2">
            {SHELVES.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip${shelves.includes(s) ? ' on' : ''}`}
                onClick={() => toggleShelf(s)}
              >
                {s}
              </button>
            ))}
            <button type="button" className="chip">
              + 棚
            </button>
          </div>

          <div className="vis">
            <div>
              この記録を公開する
              <small>既定は非公開です。</small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              aria-label="この記録を公開する"
              className={`tog${isPublic ? ' on' : ''}`}
              onClick={() => setIsPublic((v) => !v)}
            />
          </div>
        </div>
        <button type="button" className="save" onClick={onClose}>
          棚に迎える
        </button>
      </div>
    </>
  )
}
