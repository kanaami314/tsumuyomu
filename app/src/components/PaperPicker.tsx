import { useCallback, useEffect, useRef, useState } from 'react'
import { classifyField, LookupError, lookupPaper, normalizeIdentifier, authorLabel, type PaperDraft } from '../lib/biblio'
import { FIELD_COLORS } from '../lib/books'

interface Props {
  onChange: (draft: PaperDraft | null) => void
}

type Phase = 'idle' | 'loading' | 'found' | 'failed' | 'manual'

const MESSAGES = {
  invalid: 'DOI か arXiv の ID(または URL)を入れてください。',
  not_found: 'この DOI は見つかりませんでした。入力を確かめるか、手入力してください。',
  unavailable: '書誌情報を取得できませんでした(日本の論文などは、ここでは取得できないことがあります)。手入力できます。',
}

export function PaperCard({ draft }: { draft: PaperDraft }) {
  const color = FIELD_COLORS[draft.field ?? 'ml']
  return (
    <div className="found">
      <div className="mini" style={{ background: color }} />
      <div>
        <div className="t">{draft.title}</div>
        <div className="m">
          {authorLabel(draft.authors)}
          {draft.authors.length > 0 && <br />}
          {[draft.venue, draft.year].filter(Boolean).join('　')}
        </div>
      </div>
    </div>
  )
}

export default function PaperPicker({ onChange }: Props) {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [found, setFound] = useState<PaperDraft | null>(null)
  const [manual, setManual] = useState({ title: '', authors: '', year: '', venue: '' })
  const [manualDoi, setManualDoi] = useState<string | null>(null)
  const runId = useRef(0)
  const manualMode = useRef(false)

  const lookup = useCallback(
    async (value: string) => {
      if (manualMode.current) return
      const run = ++runId.current
      const id = normalizeIdentifier(value)
      if (!id) {
        setFound(null)
        onChange(null)
        setPhase('idle')
        setMessage(value.trim() ? MESSAGES.invalid : null)
        return
      }
      setPhase('loading')
      setMessage(null)
      try {
        const draft = await lookupPaper(id)
        if (run !== runId.current) return
        setFound(draft)
        onChange(draft)
        setPhase('found')
      } catch (e) {
        if (run !== runId.current) return
        const reason = e instanceof LookupError ? e.reason : 'unavailable'
        setFound(null)
        onChange(null)
        setManualDoi(reason === 'unavailable' ? id.doi : null)
        setPhase('failed')
        setMessage(MESSAGES[reason])
      }
    },
    [onChange],
  )

  const changeQuery = (value: string) => {
    setQuery(value)
    if (!value.trim()) {
      runId.current++
      setFound(null)
      onChange(null)
      setPhase('idle')
      setMessage(null)
    }
  }

  // 入力が止まってから、書誌情報を取りに行く
  useEffect(() => {
    if (!query.trim()) return
    const timer = setTimeout(() => void lookup(query), 600)
    return () => clearTimeout(timer)
  }, [query, lookup])

  const updateManual = (next: typeof manual) => {
    setManual(next)
    const title = next.title.trim()
    if (!title) {
      onChange(null)
      return
    }
    const year = Number(next.year)
    const venue = next.venue.trim() || null
    onChange({
      doi: manualDoi,
      arxivId: null,
      title,
      authors: next.authors
        .split(/[;；、\n]/)
        .map((a) => a.trim())
        .filter(Boolean),
      year: Number.isInteger(year) && year > 0 ? year : null,
      venue,
      url: manualDoi ? `https://doi.org/${manualDoi}` : null,
      field: classifyField(`${title} ${venue ?? ''}`),
    })
  }

  const paste = async () => {
    try {
      changeQuery(await navigator.clipboard.readText())
    } catch {
      setMessage('貼り付けできませんでした。入力欄に直接貼り付けてください。')
    }
  }

  const startManual = () => {
    manualMode.current = true
    runId.current++
    onChange(null)
    setFound(null)
    setPhase('manual')
    setMessage(null)
  }

  return (
    <>
      <label className="fld">
        <i className="ti ti-link" style={{ color: '#8FA593' }} aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          placeholder="DOI か arXiv の ID・URL"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-label="DOI または arXiv"
          disabled={phase === 'manual'}
        />
        <button type="button" className="paste" onClick={paste} disabled={phase === 'manual'}>
          貼り付け
        </button>
      </label>

      {phase === 'loading' && <p className="hint">書誌情報を取得しています…</p>}
      {phase === 'found' && found && (
        <>
          <PaperCard draft={found} />
          <p className="ok">
            <i className="ti ti-circle-check" aria-hidden="true" /> 書誌情報を取得しました
          </p>
        </>
      )}
      {message && (
        <p className={phase === 'failed' ? 'hint warn' : 'hint'} role="status">
          {message}
        </p>
      )}

      {phase === 'manual' ? (
        <div className="manual">
          <label>
            題名(必須)
            <input value={manual.title} onChange={(e) => updateManual({ ...manual, title: e.target.value })} />
          </label>
          <label>
            著者(「;」や「、」で区切る。「姓, 名」の形だと、姓が背表紙に出ます)
            <input value={manual.authors} onChange={(e) => updateManual({ ...manual, authors: e.target.value })} />
          </label>
          <div className="manual-row">
            <label>
              年
              <input
                value={manual.year}
                inputMode="numeric"
                maxLength={4}
                onChange={(e) => updateManual({ ...manual, year: e.target.value })}
              />
            </label>
            <label>
              掲載誌・出版元
              <input value={manual.venue} onChange={(e) => updateManual({ ...manual, venue: e.target.value })} />
            </label>
          </div>
        </div>
      ) : (
        <button type="button" className="gate-link manual-link" onClick={startManual}>
          {phase === 'failed' ? '手入力する' : 'DOI がないときは、手入力する'}
        </button>
      )}
    </>
  )
}
