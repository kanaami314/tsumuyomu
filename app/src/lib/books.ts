import { authorLabel, shortTitle } from './biblio'

export type Field = 'ml' | 'ls' | 'ps' | 'li' | 'ne' | 'ed' | 'st' | 'ma'

export const FIELDS: Field[] = ['ml', 'ls', 'ps', 'li', 'ne', 'ed', 'st', 'ma']

export const FIELD_COLORS: Record<Field, string> = {
  ml: '#5F86A3',
  ls: '#7FA88B',
  ps: '#D2A64D',
  li: '#A57FA4',
  ne: '#CC8268',
  ed: '#D49A9A',
  st: '#5E9A98',
  ma: '#7C8FA0',
}

/** 背表紙・表紙に出す本の情報 */
export interface Book {
  id: string
  title: string
  shortTitle: string
  authors: string
  year: number | null
  field: Field
  face?: boolean
}

export interface BookSource {
  id: string
  rating: number | null
  paper: { title: string; authors: string[]; year: number | null; field: Field | null }
}

function hashField(text: string): Field {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return FIELDS[h % FIELDS.length]
}

/** 刺さった度が 5 のものは、表紙を見せて飾る */
export function toBook({ id, rating, paper }: BookSource): Book {
  return {
    id,
    title: paper.title,
    shortTitle: shortTitle(paper.title),
    authors: authorLabel(paper.authors),
    year: paper.year,
    field: paper.field ?? hashField(paper.title),
    face: rating === 5,
  }
}
