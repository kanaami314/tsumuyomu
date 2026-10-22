import { useEffect, useMemo, useState } from 'react'
import { authorLabel, webUrl } from '../lib/biblio'
import { toBook } from '../lib/books'
import { fetchPublicView, type PublicView } from '../lib/publicView'
import type { EntryRow } from '../lib/records'
import { formatDay } from '../lib/stats'
import { supabase } from '../lib/supabase'
import Bookmarks from './Bookmarks'
import ShelfCase from './ShelfCase'

interface Props {
  username: string
}

type State = { status: 'loading' } | { status: 'not_found' } | { status: 'error' } | { status: 'ready'; view: PublicView }

const ALL = 'all'

// 公開ページは、検索結果には出さない(招待した人に、リンクで見せるためのもの)
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}

function PublicEntrySheet({ entry, onClose }: { entry: EntryRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const p = entry.paper
  const link = webUrl(p.url)
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="public-entry-title">
        <div className="grab2" />
        <div className="scroll">
          <div className="shead">
            <div id="public-entry-title" className="st">
              {p.title}
            </div>
            <div className="ss">
              {[authorLabel(p.authors), p.venue, p.year].filter(Boolean).join('　')}
            </div>
            <button type="button" className="x" aria-label="閉じる" onClick={onClose}>
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
          <p className="public-meta">
            {formatDay(entry.read_on) && `${formatDay(entry.read_on)}に読みました`}
            {entry.depth === 'light' && '(さらっと)'}
            {entry.depth === 'deep' && '(じっくり)'}
          </p>
          <Bookmarks value={entry.rating ?? 0} className="hs left" />
          {entry.comment && <p className="public-comment">{entry.comment}</p>}
          {link && (
            <a className="public-link" href={link} target="_blank" rel="noopener noreferrer">
              論文のページを開く
            </a>
          )}
        </div>
      </div>
    </>
  )
}

export default function PublicPage({ username }: Props) {
  useNoIndex()
  const [state, setState] = useState<State>(supabase ? { status: 'loading' } : { status: 'error' })
  const [filter, setFilter] = useState(ALL)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    fetchPublicView(supabase, username)
      .then((view) => !cancelled && setState(view ? { status: 'ready', view } : { status: 'not_found' }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [username])

  const view = state.status === 'ready' ? state.view : null
  const name = view ? view.profile.display_name || view.profile.username : username

  useEffect(() => {
    document.title = `${name} の書棚 | つむよむ`
  }, [name])

  const activeFilter = view && (filter === ALL || view.shelves.some((s) => s.id === filter)) ? filter : ALL
  const items = useMemo(() => {
    if (!view) return []
    const inShelf = (entryId: string) => view.links.some((l) => l.entry_id === entryId && l.shelf_id === activeFilter)
    return view.entries
      .map((e, seed) => ({ id: e.id, seed, book: toBook({ id: e.id, rating: e.rating, paper: e.paper }) }))
      .filter((i) => activeFilter === ALL || inShelf(i.id))
  }, [view, activeFilter])

  const opened = view?.entries.find((e) => e.id === openId)

  return (
    <div className="app">
      <section className="screen shelf public" aria-label={`${name} の書棚`}>
        <div className="photo sh-photo" />
        <div className="glow" />
        <div className="sh-head">
          {state.status === 'ready' ? (
            <>
              <h1>{name} の書棚</h1>
              <p className="handle">@{state.view.profile.username}</p>
              {state.view.profile.bio && <p className="bio">{state.view.profile.bio}</p>}
              <dl className="cnt">
                <div>
                  <dd>{state.view.entries.length}</dd>
                  <dt>公開中の本</dt>
                </div>
              </dl>
            </>
          ) : (
            <h1>{state.status === 'loading' ? '読み込み中…' : state.status === 'not_found' ? 'ページが見つかりません' : '表示できません'}</h1>
          )}
        </div>

        {state.status === 'not_found' && <p className="public-note">@{username} という人は、いません。アドレスを確かめてください。</p>}
        {state.status === 'error' && <p className="public-note">読み込めませんでした。時間をおいて、もう一度お試しください。</p>}

        {view && (
          <>
            {view.shelves.length > 0 && (
              <div className="chips">
                <button type="button" className={`chip${activeFilter === ALL ? ' on' : ''}`} onClick={() => setFilter(ALL)}>
                  すべて
                </button>
                {view.shelves.map((s) => (
                  <button key={s.id} type="button" className={`chip${activeFilter === s.id ? ' on' : ''}`} onClick={() => setFilter(s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <ShelfCase
              items={items}
              emptyText={activeFilter === ALL ? 'まだ、公開している本はありません。' : 'この棚には、公開している本がありません。'}
              onOpen={setOpenId}
            />
          </>
        )}

        <p className="public-foot">
          <a href="/">
            <i className="ti ti-leaf" aria-hidden="true" /> つむよむ
          </a>
          　論文を読んだ日々を、積み上げていく。
        </p>
      </section>
      {opened && <PublicEntrySheet entry={opened} onClose={() => setOpenId(null)} />}
    </div>
  )
}
