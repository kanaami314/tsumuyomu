import { webUrl } from '../lib/biblio'
import { DEMO_FIELD_NAMES } from '../lib/search/demo'
import { needsTranslation } from '../lib/search/translation'
import type { SearchPaper } from '../lib/search/types'
import Icon from './Icon'

// 論文さがしの、カードと詳細

export interface PaperActions {
  isSaved: (p: SearchPaper) => boolean
  /** 棚にある記録の ID(なければ null) */
  recordedId: (p: SearchPaper) => string | null
  translating: (p: SearchPaper) => boolean
  open: (p: SearchPaper) => void
  toggleSave: (p: SearchPaper) => void
  retranslate: (p: SearchPaper) => void
  record: (p: SearchPaper) => void
  /** 記録シートの準備中(書誌を取っている)の論文 */
  preparing: string | null
  busy: boolean
}

const sourceOf = (p: SearchPaper) => (p.demo ? 'arXiv' : p.source?.slice(0, 40) || 'OpenAlex')

function TranslationState({ paper, actions }: { paper: SearchPaper; actions: PaperActions }) {
  if (paper.demo) return null
  if (actions.translating(paper))
    return (
      <p className="sr-trans" role="status">
        日本語訳を準備しています…
      </p>
    )
  if (needsTranslation(paper))
    return (
      <div className="sr-trans">
        <span>日本語訳が未完了です</span>
        <button type="button" className="gate-link" onClick={() => actions.retranslate(paper)}>
          日本語訳を再取得
        </button>
      </div>
    )
  if (!paper.abstract) return <p className="sr-trans">タイトルのみ翻訳しています(抄録がないため、要約はありません)</p>
  return null
}

function SaveButton({ paper, actions, text = false }: { paper: SearchPaper; actions: PaperActions; text?: boolean }) {
  const saved = actions.isSaved(paper)
  return (
    <button
      type="button"
      className={text ? 'sr-save-text' : 'sr-save'}
      aria-pressed={saved}
      aria-label={text ? undefined : saved ? 'あとで読むから外す' : 'あとで読むに入れる'}
      onClick={() => actions.toggleSave(paper)}
    >
      <Icon name={saved ? 'bookmark-filled' : 'bookmark'} />
      {text && (saved ? 'あとで読むに入っています' : 'あとで読む')}
    </button>
  )
}

export function PaperCard({ paper, actions }: { paper: SearchPaper; actions: PaperActions }) {
  const recorded = actions.recordedId(paper)
  const summary =
    paper.summary ||
    (paper.abstract ? '日本語の説明は、まだありません。' : '抄録が収録されていません。原文で内容をご確認ください。')
  return (
    <article className={`sr-card glass${paper.discovery ? ' discovery' : ''}`}>
      <div className="sr-card-top">
        <span className="sr-rel">
          {paper.discovery && <Icon name="sparkles" />}
          {paper.relation || '検索に関連'}
        </span>
        <SaveButton paper={paper} actions={actions} />
      </div>
      <button type="button" className="sr-open" disabled={actions.busy} onClick={() => actions.open(paper)}>
        <h3>{paper.ja || paper.title}</h3>
        {paper.ja && paper.ja !== paper.title && <span className="sr-orig">{paper.title}</span>}
        <p>{summary}</p>
      </button>
      <div className="sr-meta">
        {[paper.year, sourceOf(paper)].filter(Boolean).join(' · ')}
        {recorded && <span className="sr-shelved">棚にあります</span>}
      </div>
      {paper.reason && <p className="sr-reason">{paper.reason}</p>}
      <TranslationState paper={paper} actions={actions} />
    </article>
  )
}

const UNKNOWN = '抄録からは確認できません。'

export function PaperDetail({ paper, actions }: { paper: SearchPaper; actions: PaperActions }) {
  const recorded = actions.recordedId(paper)
  const href = webUrl(paper.url)
  const field = paper.demo ? DEMO_FIELD_NAMES[paper.field ?? ''] : paper.field
  return (
    <article className="sr-detail glass">
      <span className="sr-scope">{paper.demo ? 'デモ用の編集済み紹介' : paper.scope || '日本語訳が未完了'}</span>
      <h2>{paper.ja || paper.title}</h2>
      {paper.ja && paper.ja !== paper.title && <p className="sr-orig">{paper.title}</p>}
      <p className="sr-meta">{[paper.authors, paper.date || paper.year, sourceOf(paper), field].filter(Boolean).join(' · ')}</p>
      <div className="sr-point">
        <span>この論文のポイント</span>
        <p>{paper.summary || '日本語の説明は、まだありません。下の抄録か、原論文をご確認ください。'}</p>
      </div>
      <dl className="sr-cols">
        <div>
          <dt>何を扱う研究?</dt>
          <dd>{paper.question || (paper.demo ? paper.topic : '') || UNKNOWN}</dd>
        </div>
        <div>
          <dt>手法・アプローチ</dt>
          <dd>{paper.methodExplanation || paper.method || UNKNOWN}</dd>
        </div>
      </dl>
      <details>
        <summary>限界と、読むときの注意</summary>
        <p>
          {paper.limitations ||
            'この短い紹介だけでは、実験条件や限界までは確認できません。結論を使うときは、原論文を確かめてください。'}
        </p>
        <p>査読状況は、この画面では確かめていません。</p>
      </details>
      {paper.abstract && (
        <details>
          <summary>原文の抄録を読む</summary>
          <p className="sr-abstract">{paper.abstract}</p>
        </details>
      )}
      <TranslationState paper={paper} actions={actions} />
      <div className="sr-actions">
        <button type="button" className="gate-button small" disabled={actions.preparing === paper.id} onClick={() => actions.record(paper)}>
          <Icon name={recorded ? 'books' : 'plus'} />
          {actions.preparing === paper.id ? '準備しています…' : recorded ? '棚の記録を見る' : 'この論文を記録する'}
        </button>
        {href && (
          <a className="gate-button ghost small" href={href} target="_blank" rel="noopener noreferrer">
            原論文を開く <Icon name="external-link" />
          </a>
        )}
        <SaveButton paper={paper} actions={actions} text />
      </div>
    </article>
  )
}

export function Skeleton({ count }: { count: number }) {
  return (
    <div className="sr-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sr-card glass sr-skeleton">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}
