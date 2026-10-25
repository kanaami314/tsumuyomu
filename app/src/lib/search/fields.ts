import { FIELDS, type Field } from '../books'

// おすすめで使う、分野ごとの英語の検索語(OpenAlex に渡す)。分野は、つむよむの分野に合わせる
export const FIELD_QUERIES: Record<Field, string> = {
  ml: 'machine learning',
  ls: 'learning sciences',
  ps: 'psychology',
  li: 'linguistics',
  ne: 'neuroscience',
  ed: 'education',
  st: 'statistics',
  ma: 'mathematics',
}

export const isField = (value: unknown): value is Field => typeof value === 'string' && (FIELDS as string[]).includes(value)

/** 記録の多い分野から、上位 2 つ。記録がなければ、機械学習 */
export function defaultInterests(fields: (Field | null)[]): Field[] {
  const counts = new Map<Field, number>()
  for (const f of fields) if (f) counts.set(f, (counts.get(f) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f)
  return top.length > 0 ? top.slice(0, 2) : ['ml']
}
