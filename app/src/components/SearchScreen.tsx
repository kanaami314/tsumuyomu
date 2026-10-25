import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { PaperDraft } from '../lib/biblio'
import { FIELD_LABELS, FIELDS, type Field } from '../lib/books'
import { useOptionalAuth } from '../lib/auth'
import { useRecords } from '../lib/RecordsContext'
import { paperSource } from '../lib/search/client'
import { identifierOf, resolveDraft } from '../lib/search/draft'
import {
  addNode,
  anchorsOf,
  clearHistory,
  loadState,
  mergeTranslations,
  pathOf,
  recordVisit,
  saveState,
  toggleSaved,
  type ExploreNode,
  type ExploreState,
} from '../lib/search/explore'
import { defaultInterests } from '../lib/search/fields'
import { needsTranslation } from '../lib/search/translation'
import type { SearchPaper, SearchStatus } from '../lib/search/types'
import Icon from './Icon'
import { PaperCard, PaperDetail, Skeleton, type PaperActions } from './SearchParts'

// 論文さがし(元は「論文サーチャー / Paper Compass」)。日本語で検索 → 論文を選ぶ → 類似の候補から、さらに選ぶ。
// 経路は、戻ったり、別の候補から分かれたりでき、再読み込みしても残る。

interface Props {
  /** 見つけた論文を、記録の入力シートで開く */
  onRecord: (draft: PaperDraft) => void
  /** 棚にある記録を開く */
  onOpen: (entryId: string) => void
  onToast: (message: string) => void
}

type Busy = null | 'search' | 'picks' | 'similar'

// 検索語の例は、AI なしでも英語に変えられる語(Worker の辞書にある語)にする
const EXAMPLES: Record<Field, string> = {
  ml: '機械学習 言語モデル',
  ls: '学習 記憶',
  ps: '習慣 動機づけ',
  li: '第二言語 語彙',
  ne: '睡眠 記憶',
  ed: '教育 学習',
  st: '統計 教育',
  ma: '数学 学習',
}

// おすすめは、半日たったら取り直す(新着のため)
const PICKS_TTL = 12 * 3_600_000

const sameFields = (a: Field[], b: Field[]) => a.length === b.length && a.every((f) => b.includes(f))

export default function SearchScreen({ onRecord, onOpen, onToast }: Props) {
  const auth = useOptionalAuth()
  const scope = auth?.state.status === 'ready' ? auth.state.profile.id : 'demo'
  const records = useRecords()
  const [state, setState] = useState<ExploreState>(() => loadState(scope))
  const [view, setView] = useState<'find' | 'saved'>('find')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [status, setStatus] = useState<SearchStatus | null>(null)
  const [translating, setTranslating] = useState<string[]>([])
  const [preparing, setPreparing] = useState<string | null>(null)
  // 古い操作の結果で、新しい画面を上書きしない
  const epoch = useRef(0)
  // 自動で訳を取りに行くのは、1 つの論文につき 1 回まで(失敗が続いても、繰り返さない)
  const autoTried = useRef(new Set<string>())
  const storageWarned = useRef(false)
  // おすすめが古いかは、画面を開いた時刻で決める
  const [openedAt] = useState(() => Date.now())

  useEffect(() => {
    if (!saveState(scope, state) && !storageWarned.current) {
      storageWarned.current = true
      onToast('保存容量が足りません。探索の履歴を消すと、空きます。')
    }
  }, [scope, state, onToast])

  const refreshStatus = useCallback(() => {
    paperSource
      .status()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])
  useEffect(refreshStatus, [refreshStatus])

  const interests = useMemo(
    () => state.fields ?? defaultInterests(records.entries.map((e) => e.paper.field)),
    [state.fields, records.entries],
  )

  const node = state.current ? state.nodes[state.current] : undefined
  const chain = pathOf(state.nodes, state.current)

  const loadPicks = useCallback(
    async (fields: Field[], offset: number) => {
      const e = ++epoch.current
      setBusy('picks')
      setError(null)
      try {
        const history = state.visits.map((v) => v.topic).slice(-12)
        const result = await paperSource.recommendations(fields, offset, history)
        if (e !== epoch.current) return
        setState((s) => ({ ...s, picks: { ...result, fields, offset, fetched: Date.now() } }))
      } catch (x) {
        if (e === epoch.current) setError((x as Error).message)
      } finally {
        if (e === epoch.current) {
          setBusy(null)
          refreshStatus()
        }
      }
    },
    [state.visits, refreshStatus],
  )

  // さがすの最初の画面では、おすすめを用意する(分野が変わったとき、古くなったときだけ取り直す)
  const picks = state.picks
  const current = state.current
  const picksStale = !picks || !sameFields(picks.fields, interests) || openedAt - picks.fetched > PICKS_TTL
  const waitingRecords = state.fields === null && records.status === 'loading'
  useEffect(() => {
    if (view === 'find' && !current && picksStale && !waitingRecords && busy === null && !error)
      void loadPicks(interests, picks && sameFields(picks.fields, interests) ? picks.offset : 0)
  }, [view, current, picksStale, waitingRecords, busy, error, interests, picks, loadPicks])

  const visible = useMemo<SearchPaper[]>(
    () =>
      view === 'saved'
        ? state.saved
        : node
          ? [node.anchor, ...node.papers].filter((p): p is SearchPaper => !!p)
          : (picks?.papers ?? []),
    [view, state.saved, node, picks],
  )

  const translate = useCallback(
    async (papers: SearchPaper[], retry: boolean) => {
      const ids = [...new Set(papers.filter((p) => !p.demo).map((p) => p.id))].slice(0, 11)
      if (ids.length === 0) return
      setTranslating((cur) => [...cur, ...ids])
      try {
        const result = await paperSource.translate(ids, retry)
        setState((s) => mergeTranslations(s, result.papers))
        if (result.notice) onToast(result.notice)
      } catch (x) {
        onToast((x as Error).message)
      } finally {
        setTranslating((cur) => cur.filter((id) => !ids.includes(id)))
        refreshStatus()
      }
    },
    [onToast, refreshStatus],
  )

  // 過去の経路や、あとで読むを開いたときにも、未完了の訳を埋める
  useEffect(() => {
    if (!status?.ai || busy !== null) return
    const missing = visible.filter((p) => needsTranslation(p) && !autoTried.current.has(p.id) && !translating.includes(p.id))
    if (missing.length === 0) return
    missing.forEach((p) => autoTried.current.add(p.id))
    void translate(missing, false)
  }, [visible, status, busy, translating, translate])

  const show = (current: string | null) => {
    epoch.current++
    setBusy(null)
    setError(null)
    setFilter('all')
    setView('find')
    setState((s) => ({ ...s, current }))
    window.scrollTo(0, 0)
  }

  const search = async (e?: FormEvent) => {
    e?.preventDefault()
    const q = query.trim()
    if (!q || busy) return
    const n = ++epoch.current
    setBusy('search')
    setError(null)
    setView('find')
    try {
      const result = await paperSource.search(q)
      if (n !== epoch.current) return
      setFilter('all')
      setState((s) =>
        addNode(s, { kind: 'search', query: q, parent: null, papers: result.papers, notice: result.notice, translated: result.translated }),
      )
      window.scrollTo(0, 0)
    } catch (x) {
      if (n === epoch.current) setError((x as Error).message)
    } finally {
      if (n === epoch.current) {
        setBusy(null)
        refreshStatus()
      }
    }
  }

  const open = async (paper: SearchPaper) => {
    if (busy) return
    const parent = view === 'saved' ? null : state.current
    const from = parent ? state.nodes[parent].query : view === 'saved' ? 'あとで読むから' : 'おすすめからの探索'
    const n = ++epoch.current
    setBusy('similar')
    setError(null)
    try {
      const result = await paperSource.similar(paper, anchorsOf(state.nodes, parent))
      if (n !== epoch.current) return
      setFilter('all')
      setView('find')
      setState((s) =>
        addNode(recordVisit(s, paper), { kind: 'similar', query: from, parent, anchor: paper, papers: result.papers, notice: result.notice }),
      )
      window.scrollTo(0, 0)
    } catch (x) {
      if (n === epoch.current) setError((x as Error).message)
    } finally {
      if (n === epoch.current) {
        setBusy(null)
        refreshStatus()
      }
    }
  }

  const recordedId = useCallback(
    (p: SearchPaper) => {
      const doi = identifierOf(p)?.doi
      return (doi && records.entries.find((e) => e.paper.doi === doi)?.id) || null
    },
    [records.entries],
  )

  const record = async (p: SearchPaper) => {
    const existing = recordedId(p)
    if (existing) return onOpen(existing)
    setPreparing(p.id)
    try {
      onRecord(await resolveDraft(p))
    } finally {
      setPreparing(null)
    }
  }

  const actions: PaperActions = {
    isSaved: (p) => state.saved.some((s) => s.id === p.id),
    recordedId,
    translating: (p) => translating.includes(p.id),
    open: (p) => void open(p),
    toggleSave: (p) => setState((s) => toggleSaved(s, p)),
    retranslate: (p) => void translate([p], true),
    record: (p) => void record(p),
    preparing,
    busy: busy !== null,
  }

  const toggleField = (f: Field) => {
    const next = interests.includes(f) ? interests.filter((x) => x !== f) : [...interests, f]
    if (next.length === 0) return
    setState((s) => ({ ...s, fields: next }))
  }

  const roots = Object.values(state.nodes)
    .filter((n) => n.kind === 'search')
    .sort((a, b) => b.created - a.created)
    .slice(0, 5)

  const example = paperSource.live ? EXAMPLES[interests[0] ?? 'ml'] : '自動運転 画像認識'

  return (
    <section className="screen search" aria-label="さがす">
      <div className="photo sh-photo" />
      <div className="glow" />
      <div className="sh-head">
        <h1>さがす</h1>
        <p>気になることを、ふだんの言葉で。読みたい論文に出会えます。</p>
      </div>

      <form className="sr-form glass" role="search" onSubmit={search}>
        <Icon name="search" />
        <input
          type="search"
          aria-label="論文を検索"
          placeholder="気になる技術や疑問を、日本語で"
          maxLength={300}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={busy !== null || !query.trim()}>
          検索
        </button>
      </form>

      <div className="sr-views" role="group" aria-label="表示">
        <button type="button" aria-pressed={view === 'find'} className={view === 'find' ? 'on' : ''} onClick={() => setView('find')}>
          見つける
        </button>
        <button type="button" aria-pressed={view === 'saved'} className={view === 'saved' ? 'on' : ''} onClick={() => setView('saved')}>
          あとで読む{state.saved.length > 0 && <small>{state.saved.length}</small>}
        </button>
      </div>

      {error && (
        <div className="sr-error" role="alert">
          <span>{error}</span>
          <button type="button" className="gate-link" onClick={() => setError(null)}>
            閉じる
          </button>
        </div>
      )}

      {view === 'saved' ? (
        <div className="sr-sec">
          <h2>
            あとで読む<small>{state.saved.length}</small>
          </h2>
          <p className="sr-sub">気になった論文を、ここに。読んだら「記録する」で棚へ。</p>
          {state.saved.length > 0 ? (
            <div className="sr-list">
              {state.saved.map((p) => (
                <PaperCard key={p.id} paper={p} actions={actions} />
              ))}
            </div>
          ) : (
            <p className="sr-empty">まだありません。論文のしおりを押すと、ここに入ります。</p>
          )}
        </div>
      ) : busy === 'search' ? (
        <div className="sr-sec">
          <h2>論文を探しています…</h2>
          <Skeleton count={4} />
        </div>
      ) : node ? (
        <>
          <nav className="sr-crumbs" aria-label="探索の経路">
            <button type="button" onClick={() => show(null)}>
              さがす
            </button>
            {chain.map((c) => (
              <span key={c.id}>
                <span aria-hidden="true">›</span>
                <button type="button" aria-current={c.id === node.id ? 'page' : undefined} onClick={() => show(c.id)}>
                  {c.anchor ? (c.anchor.ja || c.anchor.title).slice(0, 18) : `「${c.query.slice(0, 14)}」`}
                </button>
              </span>
            ))}
          </nav>
          {node.parent && state.nodes[node.parent] && (
            <button type="button" className="sr-back" onClick={() => show(node.parent)}>
              <Icon name="arrow-left" /> 前の候補に戻る
            </button>
          )}
          {node.anchor ? (
            <PaperDetail paper={node.anchor} actions={actions} />
          ) : (
            <header className="sr-sec sr-results-head">
              <h2>「{node.query}」の論文</h2>
              <p className="sr-sub">気になる論文を選ぶと、つながりのある論文が出てきます。</p>
              {node.translated && <small>検索語:{node.translated}</small>}
            </header>
          )}
          <NodeResults node={node} filter={filter} setFilter={setFilter} busy={busy === 'similar'} actions={actions} />
        </>
      ) : (
        <>
          <div className="sr-sec">
            <div className="sr-sec-head">
              <h2>
                今日の、知的な寄り道<small>{picks?.papers.length ?? 5}</small>
              </h2>
              <button
                type="button"
                className="sr-more"
                disabled={busy !== null}
                onClick={() => void loadPicks(interests, (picks?.offset ?? 0) + 1)}
              >
                <Icon name="refresh" /> ほかの論文
              </button>
            </div>
            <p className="sr-sub">関心に近い論文を4つ。新しい視点を、ひとつ。</p>
            <div className="sr-fields" role="group" aria-label="関心のある分野">
              {FIELDS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`chip${interests.includes(f) ? ' on' : ''}`}
                  aria-pressed={interests.includes(f)}
                  onClick={() => toggleField(f)}
                >
                  {FIELD_LABELS[f]}
                </button>
              ))}
            </div>
            {busy === 'picks' || (!picks && busy === null && !error) ? (
              <Skeleton count={5} />
            ) : picks && picks.papers.length > 0 ? (
              <div className="sr-list">
                {picks.papers.map((p) => (
                  <PaperCard key={p.id} paper={p} actions={actions} />
                ))}
              </div>
            ) : (
              <p className="sr-empty">おすすめを用意できませんでした。「ほかの論文」で、もう一度試せます。</p>
            )}
            {busy === 'similar' && (
              <p className="sr-working" role="status">
                次の論文へのつながりを探しています…
              </p>
            )}
            {picks?.notice && <p className="sr-notice">{picks.notice}</p>}
          </div>

          <div className="sr-sec">
            <div className="sr-invite glass">
              <Icon name="search" />
              <div>
                <strong>もう、気になることがありますか?</strong>
                <p>「{example}」のように、ふだんの言葉で探せます。</p>
              </div>
              <button type="button" className="gate-link" onClick={() => setQuery(example)}>
                入れてみる
              </button>
            </div>
          </div>

          {roots.length > 0 && (
            <div className="sr-sec">
              <h2>最近の探索</h2>
              <ul className="sr-history">
                {roots.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => show(r.id)}>
                      「{r.query}」<small>{r.papers.length}件</small>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="gate-link"
                onClick={() => {
                  setState(clearHistory)
                  onToast('探索の履歴を消しました')
                }}
              >
                探索の履歴を消す(あとで読むは残ります)
              </button>
            </div>
          )}
        </>
      )}

      <SourceNote status={status} />
    </section>
  )
}

function NodeResults({
  node,
  filter,
  setFilter,
  busy,
  actions,
}: {
  node: ExploreNode
  filter: string
  setFilter: (f: string) => void
  busy: boolean
  actions: PaperActions
}) {
  const labels = [...new Set(node.papers.map((p) => p.relation).filter((x): x is string => !!x))]
  const papers = filter === 'all' ? node.papers : node.papers.filter((p) => p.relation === filter)
  return (
    <div className="sr-sec">
      <h2>
        {node.anchor ? 'つながりから、次の論文へ' : '見つかった論文'}
        <small>{node.papers.length}</small>
      </h2>
      {node.anchor && <p className="sr-sub">同じ手法、似た課題、別の応用。気になる方向へ進んでみましょう。</p>}
      {labels.length > 1 && (
        <div className="sr-fields" role="group" aria-label="観点で絞り込む">
          <button type="button" className={`chip${filter === 'all' ? ' on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            すべて
          </button>
          {labels.map((l) => (
            <button key={l} type="button" className={`chip${filter === l ? ' on' : ''}`} aria-pressed={filter === l} onClick={() => setFilter(l)}>
              {l}
            </button>
          ))}
        </div>
      )}
      {busy && (
        <p className="sr-working" role="status">
          次の論文へのつながりを探しています…
        </p>
      )}
      {papers.length > 0 ? (
        <div className="sr-list">
          {papers.map((p) => (
            <PaperCard key={p.id} paper={p} actions={actions} />
          ))}
        </div>
      ) : (
        <p className="sr-empty">関連する論文が見つかりませんでした。検索語を短くするか、前の候補から別の方向へ進んでください。</p>
      )}
      {node.papers.length > 0 && node.papers.length < 10 && <p className="sr-sub">関連の強さを優先し、取れた候補だけを出しています。</p>}
      {node.notice && <p className="sr-notice">{node.notice}</p>}
    </div>
  )
}

function SourceNote({ status }: { status: SearchStatus | null }) {
  if (!paperSource.live)
    return <p className="sr-source">見た目の確認用のデモです。同梱した論文の中から探し、外部とは通信しません。</p>
  return (
    <div className="sr-source">
      <p>
        論文の情報は OpenAlex から取っています。日本語の説明:{status?.ai ? 'AI(Gemini)で作成' : 'AI 未接続'}
        {status && (
          <>
            。今日の呼び出し 論文 {status.usage.openalex ?? 0}/{status.limits.openalex}・AI {status.usage.ai ?? 0}/{status.limits.ai}
            (みんなで共通の上限、UTC の日付)
          </>
        )}
      </p>
      {status?.ai && <p>AI を使うとき、検索語と、公開されている抄録を Gemini に送ります。未公開の研究の情報は入れないでください。</p>}
    </div>
  )
}
