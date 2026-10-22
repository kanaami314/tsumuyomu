import type { Field } from './books'

export interface PaperDraft {
  doi: string | null
  arxivId: string | null
  title: string
  /** 「姓, 名」の形。団体名などは、そのまま */
  authors: string[]
  year: number | null
  venue: string | null
  url: string | null
  field: Field | null
}

export interface Identifier {
  doi: string
  arxivId: string | null
}

const ARXIV_NEW = /^\d{4}\.\d{4,5}$/
const ARXIV_OLD = /^[a-z-]+(\.[a-z]{2})?\/\d{7}$/i

function arxivIdentifier(id: string): Identifier | null {
  const bare = id.replace(/v\d+$/i, '')
  if (!ARXIV_NEW.test(bare) && !ARXIV_OLD.test(bare)) return null
  return { doi: `10.48550/arxiv.${bare.toLowerCase()}`, arxivId: bare }
}

/** DOI、doi.org の URL、arXiv の ID や URL から、DOI(小文字)を取り出す */
export function normalizeIdentifier(input: string): Identifier | null {
  let s = input.trim()
  if (!s) return null

  const arxivUrl = s.match(/^(?:https?:\/\/)?(?:www\.)?arxiv\.org\/(?:abs|pdf)\/([^\s?#]+?)(?:\.pdf)?(?:[?#].*)?$/i)
  if (arxivUrl) return arxivIdentifier(arxivUrl[1])

  s = s.replace(/^arxiv:\s*/i, '')
  const arxiv = arxivIdentifier(s)
  if (arxiv) return arxiv

  s = s
    .replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/[.,;)\]]+$/, '')
  if (!/^10\.\d{4,9}\/\S+$/.test(s)) return null

  const doi = s.toLowerCase()
  const fromArxivDoi = doi.match(/^10\.48550\/arxiv\.(.+)$/)
  return { doi, arxivId: fromArxivDoi ? fromArxivDoi[1] : null }
}

interface CslName {
  family?: string
  given?: string
  literal?: string
  name?: string
}

export interface Csl {
  title?: string | string[]
  author?: CslName[]
  issued?: { 'date-parts'?: (number | string | null)[][] }
  'container-title'?: string | string[]
  publisher?: string
  URL?: string
  categories?: string[]
  subject?: string[]
}

const first = (v: string | string[] | undefined): string | null => {
  const s = Array.isArray(v) ? v[0] : v
  return s && s.trim() ? s.trim() : null
}

const RULES: [Field, RegExp][] = [
  ['ml', /machine learning|neural|deep learning|artificial intelligence|computer|computation|language model|reinforcement/],
  ['ne', /neuro|brain|cortex|synap|sleep/],
  ['ps', /psycholog|behavio|cognit|habit|motivation|emotion/],
  ['ed', /educat|teaching|pedagog|student|curricul|classroom/],
  ['ls', /learning|memory|vocabulary/],
  ['li', /linguist|syntax|semantic|phonolog|language/],
  ['st', /statistic|probabilit|bayes|regression/],
  ['ma', /mathemat|algebra|topolog|geometry|theorem/],
]

/** 件名・題名・掲載誌から、分野をおおまかに決める。決まらなければ null */
export function classifyField(text: string): Field | null {
  const t = text.toLowerCase()
  return RULES.find(([, re]) => re.test(t))?.[0] ?? null
}

export function fromCsl(csl: Csl, doi: string): PaperDraft {
  const arxivId = doi.match(/^10\.48550\/arxiv\.(.+)$/i)?.[1] ?? null
  const title = first(csl.title) ?? ''
  const venue = first(csl['container-title']) ?? (arxivId ? 'arXiv' : first(csl.publisher))
  const authors = (csl.author ?? [])
    .map((a) => {
      if (a.family) return a.given ? `${a.family}, ${a.given}` : a.family
      return a.literal ?? a.name ?? a.given ?? ''
    })
    .filter(Boolean)
  const rawYear = csl.issued?.['date-parts']?.[0]?.[0]
  const year = Number.isInteger(Number(rawYear)) && Number(rawYear) > 0 ? Number(rawYear) : null
  const subjects = [...(csl.categories ?? []), ...(csl.subject ?? [])].join(' ')
  return {
    doi,
    arxivId,
    title,
    authors,
    year,
    venue,
    url: csl.URL ?? `https://doi.org/${doi}`,
    field: classifyField(`${subjects} ${title} ${venue ?? ''}`),
  }
}

export type LookupFailure = 'not_found' | 'unavailable'

export class LookupError extends Error {
  reason: LookupFailure

  constructor(reason: LookupFailure) {
    super(reason)
    this.reason = reason
  }
}

/**
 * DOI から書誌情報を取る。doi.org に CSL JSON を頼むと、Crossref と DataCite(arXiv など)の両方が引ける。
 * JaLC など、ブラウザから直接引けないもの(CORS)は 'unavailable' になる。呼び出し側は手入力に切り替える。
 */
export async function lookupPaper(id: Identifier, fetchImpl: typeof fetch = fetch): Promise<PaperDraft> {
  let res: Response
  try {
    res = await fetchImpl(`https://doi.org/${id.doi}`, {
      headers: { Accept: 'application/vnd.citationstyles.csl+json' },
    })
  } catch {
    throw new LookupError('unavailable')
  }
  if (res.status === 404) throw new LookupError('not_found')
  if (!res.ok) throw new LookupError('unavailable')
  let csl: Csl
  try {
    csl = await res.json()
  } catch {
    throw new LookupError('unavailable')
  }
  const draft = fromCsl(csl, id.doi)
  if (!draft.title) throw new LookupError('unavailable')
  return draft
}

const isWide = (ch: string) => /[　-ヿ㐀-鿿＀-￯]/.test(ch)

/**
 * 背表紙に出す短い題名。副題(: や — のあと)を落とし、長ければ省略する。
 * 縦書きでは、全角の文字は半角の約 2 倍の長さを取るので、全角は 2 と数える(上限は半角 20 文字ぶん)。
 */
export function shortTitle(title: string, budget = 20): string {
  const main = title.split(/\s*[:：—–]\s+|\s*[:：]\s*/)[0].trim() || title
  const width = (text: string) => [...text].reduce((sum, ch) => sum + (isWide(ch) ? 2 : 1), 0)
  if (width(main) <= budget) return main
  let used = 0
  let out = ''
  for (const ch of main) {
    const w = isWide(ch) ? 2 : 1
    if (used + w > budget - 1) return `${out}…`
    out += ch
    used += w
  }
  return out
}

/** 「LeCun, Yann」の列から、「LeCun ほか」のような表示を作る */
export function authorLabel(authors: string[]): string {
  if (authors.length === 0) return ''
  const first = authors[0].split(',')[0].trim()
  return authors.length > 1 ? `${first} ほか` : first
}

/**
 * リンクに使ってよい URL だけを返す。http(s) 以外(javascript: など)は null。
 * 論文の URL は、利用者が自由に書き込める列なので、公開ページに出すときは、必ずここを通す。
 * doi.org は https に揃える。
 */
export function webUrl(url: string | null | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (parsed.hostname === 'doi.org' || parsed.hostname === 'dx.doi.org') {
    parsed.protocol = 'https:'
    parsed.hostname = 'doi.org'
  }
  return parsed.toString()
}
