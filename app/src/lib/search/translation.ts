import type { SearchPaper } from './types'

// AI の日本語説明を確かめる。論文サーチャーで直した点を保つ:
// - 抄録がない論文は、タイトルだけを訳し、要約は作らない
// - ID が違うもの、日本語を含まないものは捨てる
// - 補助の項目が欠けただけで、正しいタイトル・要約を捨てない

export const hasJapanese = (value: unknown): value is string =>
  typeof value === 'string' && /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value)

const validText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length < 6000 && hasJapanese(value)

export const UNKNOWN = '抄録からは確認できません。'

export type Explanation = Required<
  Pick<SearchPaper, 'ja' | 'summary' | 'question' | 'methodExplanation' | 'limitations' | 'scope' | 'analysisStatus'>
>

type Candidate = Partial<Record<keyof Explanation | 'id', unknown>> | null | undefined

export function validateExplanation(paper: Pick<SearchPaper, 'id' | 'abstract'>, value: Candidate): Explanation | null {
  if (!value || value.id !== paper.id || !validText(value.ja)) return null
  if (!paper.abstract) {
    return {
      ja: value.ja.trim(),
      summary: '',
      question: UNKNOWN,
      methodExplanation: UNKNOWN,
      limitations: UNKNOWN,
      scope: 'タイトルのみ日本語訳・抄録未取得',
      analysisStatus: 'title-only',
    }
  }
  if (!validText(value.summary)) return null
  const pick = (v: unknown) => (validText(v) ? v.trim() : UNKNOWN)
  return {
    ja: value.ja.trim(),
    summary: value.summary.trim(),
    question: pick(value.question),
    methodExplanation: pick(value.methodExplanation),
    limitations: pick(value.limitations),
    scope: '抄録に基づくAI説明',
    analysisStatus: 'ready',
  }
}

/** 日本語説明が、そろっているか */
export function complete(p: SearchPaper): boolean {
  return validateExplanation(p, p as Candidate) !== null
}

/** 画面で「日本語訳が未完了」と出すか。デモは編集済みなので、対象にしない */
export function needsTranslation(p: SearchPaper): boolean {
  return !p.demo && (!hasJapanese(p.ja) || (!!p.abstract && !hasJapanese(p.summary)))
}
