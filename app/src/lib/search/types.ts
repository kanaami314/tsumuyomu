// 論文さがし(元は「論文サーチャー / Paper Compass」)で、画面と Worker が共有する型

export type AnalysisStatus = 'ready' | 'title-only' | 'failed'

/** 検索・おすすめ・類似で返す論文。項目の欠けを許す(古い保存データ、デモ、AI なしなど) */
export interface SearchPaper {
  /** 実論文は OpenAlex の ID(https://openalex.org/W...)、デモは arXiv の ID。書き換えずに使う */
  id: string
  /** 原題。日本語訳と並べて、原典を確かめられるようにする */
  title: string
  ja?: string
  /** 抄録がないときは空文字(内容を推測して要約しない) */
  summary?: string
  abstract?: string
  question?: string
  methodExplanation?: string
  limitations?: string
  /** どこまでを根拠にした説明か(例: 抄録に基づくAI説明) */
  scope?: string
  analysisStatus?: AnalysisStatus
  demo: boolean
  year?: string
  date?: string
  /** 表示用(先頭の 4 人まで) */
  authors?: string
  /** 記録に写すための、著者の一覧(「名 姓」の形) */
  authorList?: string[]
  source?: string
  url?: string
  doi?: string | null
  /** デモは内部の分野、実論文は OpenAlex の分野名 */
  field?: string
  topic?: string
  topics?: string[]
  citations?: number
  method?: string
  challenge?: string
  /** この候補に付けた、類似・おすすめのラベル */
  relation?: string
  reason?: string
  discovery?: boolean
}

export interface PaperResult {
  papers: SearchPaper[]
  /** 利用者に、そのまま見せるお知らせ(空なら出さない) */
  notice: string
  /** 実検索で、実際に使った英語の検索語 */
  translated?: string
}

export interface SearchStatus {
  /** 設定で AI が有効か(残りの枠や接続の成否は表さない) */
  ai: boolean
  usage: Partial<Record<'openalex' | 'ai', number>>
  limits: { openalex: number; ai: number }
}

/** 同じ DOI(なければ ID)のものを、1 つにまとめる */
export function unique<T extends { id: string; doi?: string | null }>(items: T[]): T[] {
  return [...new Map(items.map((p) => [p.doi || p.id, p])).values()]
}
