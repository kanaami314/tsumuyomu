import type { Field } from '../books'
import { isField } from './fields'
import type { PaperResult, SearchPaper } from './types'

// 探索の経路(検索 → 論文 → 類似 → …)、あとで読む、関心分野を、このブラウザーに保存する。
// 候補の順序と論文の情報をそのまま残し、戻るときに検索し直して入れ替えない。

export interface ExploreNode {
  id: string
  kind: 'search' | 'similar'
  /** 検索語。類似のときは、たどってきた検索語(おすすめからなら「おすすめからの探索」) */
  query: string
  parent: string | null
  /** 類似のとき、もとにした論文 */
  anchor?: SearchPaper
  papers: SearchPaper[]
  notice: string
  translated?: string
  created: number
}

export interface Picks extends PaperResult {
  fields: Field[]
  offset: number
  fetched: number
}

export interface Visit {
  id: string
  topic: string
  date: number
}

export interface ExploreState {
  nodes: Record<string, ExploreNode>
  /** いま開いている経路。null なら、さがすの最初の画面 */
  current: string | null
  saved: SearchPaper[]
  visits: Visit[]
  /** null なら、記録から決める */
  fields: Field[] | null
  picks: Picks | null
}

export const EMPTY_STATE: ExploreState = { nodes: {}, current: null, saved: [], visits: [], fields: null, picks: null }

// localStorage の容量(5MB ほど)を超えないよう、古い経路から捨てる
const MAX_NODES = 40
const MAX_VISITS = 100

/** 利用者ごとに分ける(同じブラウザーで、別のアカウントを使ったときに混ざらないように) */
const storageKey = (scope: string) => `tsumuyomu:search:${scope}`

export function loadState(scope: string): ExploreState {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(scope)) ?? 'null') as Partial<ExploreState> | null
    if (!raw || typeof raw !== 'object') return EMPTY_STATE
    const nodes = raw.nodes && typeof raw.nodes === 'object' ? raw.nodes : {}
    return {
      nodes,
      current: typeof raw.current === 'string' && nodes[raw.current] ? raw.current : null,
      saved: Array.isArray(raw.saved) ? raw.saved : [],
      visits: Array.isArray(raw.visits) ? raw.visits : [],
      fields: Array.isArray(raw.fields) ? raw.fields.filter(isField) : null,
      picks: raw.picks && Array.isArray(raw.picks.papers) ? raw.picks : null,
    }
  } catch {
    return EMPTY_STATE
  }
}

/** 保存できなかったら false(容量不足など) */
export function saveState(scope: string, state: ExploreState): boolean {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

function prune(nodes: Record<string, ExploreNode>, keep: string): Record<string, ExploreNode> {
  const list = Object.values(nodes)
  if (list.length <= MAX_NODES) return nodes
  const kept = new Set(pathOf(nodes, keep).map((n) => n.id))
  const newest = list.sort((a, b) => b.created - a.created)
  for (const n of newest) if (kept.size < MAX_NODES) kept.add(n.id)
  return Object.fromEntries(list.filter((n) => kept.has(n.id)).map((n) => [n.id, n]))
}

export function addNode(state: ExploreState, data: Omit<ExploreNode, 'id' | 'created'>, now = Date.now()): ExploreState {
  const id = crypto.randomUUID()
  const nodes = prune({ ...state.nodes, [id]: { ...data, id, created: now } }, id)
  return { ...state, nodes, current: id }
}

/** 最初の検索から、その経路までの道のり(古い順) */
export function pathOf(nodes: Record<string, ExploreNode>, id: string | null): ExploreNode[] {
  const chain: ExploreNode[] = []
  const seen = new Set<string>()
  let n = id ? nodes[id] : undefined
  while (n && !seen.has(n.id)) {
    seen.add(n.id)
    chain.unshift(n)
    n = n.parent ? nodes[n.parent] : undefined
  }
  return chain
}

/** 類似を探すときに除く、経路にある論文 */
export function anchorsOf(nodes: Record<string, ExploreNode>, id: string | null): string[] {
  return pathOf(nodes, id)
    .map((n) => n.anchor?.id)
    .filter((x): x is string => !!x)
}

export function recordVisit(state: ExploreState, paper: SearchPaper, now = Date.now()): ExploreState {
  return { ...state, visits: [...state.visits, { id: paper.id, topic: paper.topic ?? '', date: now }].slice(-MAX_VISITS) }
}

export function toggleSaved(state: ExploreState, paper: SearchPaper): ExploreState {
  const saved = state.saved.some((p) => p.id === paper.id) ? state.saved.filter((p) => p.id !== paper.id) : [...state.saved, paper]
  return { ...state, saved }
}

/** 訳を取り直した論文で、経路・あとで読む・おすすめを更新する。関連の理由と並び順は変えない */
export function mergeTranslations(state: ExploreState, updates: SearchPaper[]): ExploreState {
  if (updates.length === 0) return state
  const byId = new Map(updates.map((p) => [p.id, p]))
  const merge = <T extends SearchPaper | undefined>(p: T): T => {
    const u = p && byId.get(p.id)
    return (u ? { ...p, ...u, relation: p.relation, reason: p.reason, discovery: p.discovery } : p) as T
  }
  const nodes = Object.fromEntries(
    Object.entries(state.nodes).map(([id, n]) => [id, { ...n, anchor: merge(n.anchor), papers: n.papers.map(merge) }]),
  )
  return {
    ...state,
    nodes,
    saved: state.saved.map(merge),
    picks: state.picks ? { ...state.picks, papers: state.picks.papers.map(merge) } : null,
  }
}

export function clearHistory(state: ExploreState): ExploreState {
  return { ...state, nodes: {}, current: null, visits: [] }
}
