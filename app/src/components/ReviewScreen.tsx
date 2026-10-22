import { useState } from 'react'
import { FIELD_COLORS, FIELD_LABELS } from '../lib/books'
import { useRecords } from '../lib/RecordsContext'
import {
  countEntries,
  depthBreakdown,
  entriesOfMonth,
  fieldBreakdown,
  formatDay,
  monthlyBuckets,
  undatedCount,
} from '../lib/stats'
import { authorLabel } from '../lib/biblio'
import Bookmarks from './Bookmarks'

interface Props {
  onOpen: (entryId: string) => void
}

const CHART_HEIGHT = 130

export default function ReviewScreen({ onOpen }: Props) {
  const { entries, status } = useRecords()
  const [selected, setSelected] = useState<string | null>(null)

  const counts = countEntries(entries)
  const buckets = monthlyBuckets(entries)
  const key = selected ?? buckets[buckets.length - 1].key
  const max = Math.max(1, ...buckets.map((b) => b.count))
  const blockHeight = Math.max(4, Math.min(14, Math.floor(CHART_HEIGHT / max) - 2))
  const fields = fieldBreakdown(entries)
  const depth = depthBreakdown(entries)
  const undated = undatedCount(entries)
  const shown = entriesOfMonth(entries, key)
  const selectedBucket = buckets.find((b) => b.key === key)

  return (
    <section className="screen review" aria-label="ふりかえり">
      <div className="photo sh-photo" />
      <div className="glow" />
      <div className="sh-head">
        <h1>ふりかえり</h1>
        <p>積み上げた日々を、ゆっくり眺めます。</p>
      </div>

      <div className="stats">
        <div className="stat glass">
          <small>通算</small>
          <span>
            {counts.total}
            <em>本</em>
          </span>
        </div>
        <div className="stat glass">
          <small>今月</small>
          <span>
            {counts.month}
            <em>本</em>
          </span>
        </div>
        <div className="stat glass">
          <small>読んだ日</small>
          <span>
            {counts.days}
            <em>日</em>
          </span>
        </div>
      </div>

      <div className="card glass">
        <h2>月ごとの積み上げ</h2>
        {status === 'loading' ? (
          <p className="hint">読み込み中…</p>
        ) : (
          <>
            <div className="chart" role="group" aria-label="月ごとに読んだ本数">
              {buckets.map((b, i) => (
                <button
                  key={b.key}
                  type="button"
                  className={`col${b.key === key ? ' on' : ''}`}
                  aria-pressed={b.key === key}
                  aria-label={`${b.year}年${b.month}月 ${b.count}本、通算 ${b.cumulative}本`}
                  onClick={() => setSelected(b.key)}
                >
                  <span className="n">{b.count > 0 ? b.count : ''}</span>
                  <span className="stack" style={{ height: CHART_HEIGHT }}>
                    {b.fields.map((f, j) => (
                      <span key={j} className="blk" style={{ background: FIELD_COLORS[f], height: blockHeight }} />
                    ))}
                  </span>
                  <span className="m">{b.month}</span>
                  <span className="y">{i === 0 || b.month === 1 ? `'${String(b.year).slice(2)}` : ''}</span>
                  <span className="cum">{b.cumulative}</span>
                </button>
              ))}
            </div>
            <p className="legend">下の数字は、そこまでの通算です。ブロックの色は、論文の分野です。</p>
            {undated > 0 && <p className="legend">読んだ日のない記録が {undated} 本あります(通算には入っています)。</p>}
          </>
        )}
      </div>

      {fields.length > 0 && (
        <div className="card glass">
          <h2>分野の内訳</h2>
          <div className="split" role="img" aria-label={fields.map((f) => `${FIELD_LABELS[f.field]} ${f.count}本`).join('、')}>
            {fields.map((f) => (
              <span key={f.field} style={{ flex: f.count, background: FIELD_COLORS[f.field] }} />
            ))}
          </div>
          <ul className="fields">
            {fields.map((f) => (
              <li key={f.field}>
                <i style={{ background: FIELD_COLORS[f.field] }} aria-hidden="true" />
                {FIELD_LABELS[f.field]}
                <b>{f.count}</b>
              </li>
            ))}
          </ul>
          <p className="legend">
            読み方: さらっと {depth.light}本 / じっくり {depth.deep}本
            {depth.unset > 0 ? ` / 未設定 ${depth.unset}本` : ''}
          </p>
        </div>
      )}

      <div className="card glass">
        <h2>
          {selectedBucket ? `${selectedBucket.year}年${selectedBucket.month}月` : ''}に読んだもの
          <small>{shown.length}本</small>
        </h2>
        {shown.length === 0 ? (
          <p className="hint">{status === 'loading' ? '読み込み中…' : 'この月は、まだ記録がありません。'}</p>
        ) : (
          <ul className="month-list">
            {shown.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onOpen(e.id)}>
                  <span className="t">{e.paper.title}</span>
                  <span className="m">
                    {[authorLabel(e.paper.authors), formatDay(e.read_on)].filter(Boolean).join('　')}
                  </span>
                  {e.comment && <span className="c">{e.comment}</span>}
                  <Bookmarks value={e.rating ?? 0} className="r" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
