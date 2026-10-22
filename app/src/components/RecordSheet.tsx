import { useEffect, useState } from 'react'
import type { PaperDraft } from '../lib/biblio'
import { useRecords } from '../lib/RecordsContext'
import type { Depth, EntryRow } from '../lib/records'
import { todayString } from '../lib/stats'
import NewShelfChip from './NewShelfChip'
import Icon from './Icon'
import PaperPicker, { PaperCard } from './PaperPicker'

interface Props {
  /** 渡すと、その記録を編集する。なければ新しく記録する */
  entryId?: string
  onClose: () => void
}

const DEPTHS: { value: Depth; label: string }[] = [
  { value: 'light', label: 'さらっと' },
  { value: 'deep', label: 'じっくり' },
]

function draftOf(entry: EntryRow): PaperDraft {
  const p = entry.paper
  return {
    doi: p.doi,
    arxivId: p.arxiv_id,
    title: p.title,
    authors: p.authors,
    year: p.year,
    venue: p.venue,
    url: p.url,
    field: p.field,
  }
}

export default function RecordSheet({ entryId, onClose }: Props) {
  const records = useRecords()
  const entry = entryId ? records.entries.find((e) => e.id === entryId) : undefined

  const [draft, setDraft] = useState<PaperDraft | null>(null)
  const [depth, setDepth] = useState<Depth>(entry?.depth ?? 'deep')
  const [readOn, setReadOn] = useState(entry?.read_on ?? todayString())
  const [comment, setComment] = useState(entry?.comment ?? '')
  const [rating, setRating] = useState(entry?.rating ?? 0)
  const [shelfIds, setShelfIds] = useState<string[]>(entry ? records.shelfIdsOf(entry.id) : [])
  const [isPublic, setIsPublic] = useState(entry?.visibility === 'public')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggleShelf = (id: string) =>
    setShelfIds((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]))

  const canSave = !busy && (entry ? true : draft !== null)

  const save = async () => {
    setBusy(true)
    setError(null)
    const input = { readOn, depth, comment, rating, isPublic, shelfIds }
    const failure = entry ? await records.editEntry(entry.id, input) : draft ? await records.addEntry(draft, input) : '論文を選んでください。'
    setBusy(false)
    if (failure) setError(failure)
    else onClose()
  }

  const remove = async () => {
    if (!entry) return
    setBusy(true)
    const failure = await records.removeEntry(entry.id)
    setBusy(false)
    if (failure) setError(failure)
    else onClose()
  }

  const createShelf = async (name: string) => {
    const shelf = await records.addShelf(name)
    if (shelf) setShelfIds((cur) => [...cur, shelf.id])
    return shelf !== null
  }

  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="grab2" />
        <div className="scroll">
          <div className="shead">
            <div id="sheet-title" className="st">
              {entry ? '記録を見る・直す' : '1本記録する'}
            </div>
            <div className="ss">{entry ? '内容を直したり、消したりできます。' : '今日読んだ論文を、棚へ。'}</div>
            <button type="button" className="x" aria-label="閉じる" onClick={onClose}>
              <Icon name="x" />
            </button>
          </div>

          {entry ? <PaperCard draft={draftOf(entry)} /> : <PaperPicker onChange={setDraft} />}

          <div className="lb">読み方</div>
          <div className="seg" role="group" aria-label="読み方">
            {DEPTHS.map((d) => (
              <button
                key={d.value}
                type="button"
                className={depth === d.value ? 'on' : ''}
                aria-pressed={depth === d.value}
                onClick={() => setDepth(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <label className="lb" htmlFor="read-on">
            読んだ日
          </label>
          <input
            id="read-on"
            type="date"
            className="date"
            value={readOn}
            max={todayString()}
            onChange={(e) => setReadOn(e.target.value)}
          />

          <label className="lb" htmlFor="comment">
            ひとこと(任意)
          </label>
          <textarea
            id="comment"
            className="ta"
            value={comment}
            maxLength={2000}
            onChange={(e) => setComment(e.target.value)}
            placeholder="図1の整理が分かりやすかった。"
          />

          <div className="lb">刺さった度</div>
          <div className="hearts" role="group" aria-label="刺さった度">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n}`}
                aria-pressed={n <= rating}
                onClick={() => setRating(n === rating ? 0 : n)}
              >
                <Icon name={n <= rating ? 'bookmark-filled' : 'bookmark'} className={n <= rating ? 'f' : undefined} />
              </button>
            ))}
          </div>

          <div className="lb">棚</div>
          <div className="row2">
            {records.shelves.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip${shelfIds.includes(s.id) ? ' on' : ''}`}
                aria-pressed={shelfIds.includes(s.id)}
                onClick={() => toggleShelf(s.id)}
              >
                {s.name}
              </button>
            ))}
            <NewShelfChip className="chip" onCreate={createShelf} />
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

          {error && (
            <p className="gate-error" role="alert">
              {error}
            </p>
          )}

          {entry && (
            <div className="danger">
              {confirmDelete ? (
                <>
                  <span>この記録を消します。元に戻せません。</span>
                  <button type="button" className="danger-yes" disabled={busy} onClick={remove}>
                    消す
                  </button>
                  <button type="button" className="gate-link" onClick={() => setConfirmDelete(false)}>
                    やめる
                  </button>
                </>
              ) : (
                <button type="button" className="gate-link" onClick={() => setConfirmDelete(true)}>
                  この記録を削除する
                </button>
              )}
            </div>
          )}
        </div>
        <button type="button" className="save" disabled={!canSave} onClick={save}>
          {busy ? '保存しています…' : entry ? '保存する' : '棚に迎える'}
        </button>
      </div>
    </>
  )
}
