import { classifyField, lookupPaper, normalizeIdentifier, type Identifier, type PaperDraft } from '../biblio'
import type { SearchPaper } from './types'

// 見つけた論文を、記録の入力シートに渡す形(PaperDraft)にする

/** DOI(なければ、デモの arXiv ID)から、記録と照らし合わせる識別子 */
export function identifierOf(p: SearchPaper): Identifier | null {
  return normalizeIdentifier(p.doi ?? '') ?? (p.demo ? normalizeIdentifier(p.id) : null)
}

/** 「Ada Lovelace」を、つむよむの著者の形「Lovelace, Ada」にする。1 語なら、そのまま */
export function familyFirst(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name.trim()
  const family = parts.pop()!
  return `${family}, ${parts.join(' ')}`
}

/** 手元の情報だけで作る(doi.org から取れないときの代わり) */
export function localDraft(p: SearchPaper): PaperDraft {
  const id = identifierOf(p)
  const names = p.demo ? [] : (p.authorList ?? (p.authors ? p.authors.split(/,\s*/) : []))
  const year = Number(p.year)
  const venue = p.source && p.source !== 'OpenAlex' ? p.source : id?.arxivId ? 'arXiv' : null
  return {
    doi: id?.doi ?? null,
    arxivId: id?.arxivId ?? null,
    title: p.title,
    authors: names.filter(Boolean).map(familyFirst),
    year: Number.isInteger(year) && year > 0 ? year : null,
    venue,
    url: p.url || (id ? `https://doi.org/${id.doi}` : null),
    field: classifyField(`${p.field ?? ''} ${p.topic ?? ''} ${p.title} ${venue ?? ''}`),
  }
}

/** DOI があれば、記録シートと同じく doi.org から書誌を取る。取れなければ、手元の情報で作る */
export async function resolveDraft(p: SearchPaper, fetchImpl: typeof fetch = fetch): Promise<PaperDraft> {
  const local = localDraft(p)
  const id = identifierOf(p)
  if (!id) return local
  try {
    const draft = await lookupPaper(id, fetchImpl)
    return { ...draft, field: draft.field ?? local.field }
  } catch {
    return local
  }
}
