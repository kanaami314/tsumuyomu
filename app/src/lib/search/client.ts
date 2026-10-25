import type { Field } from '../books'
import { supabase } from '../supabase'
import { DEMO_PAPERS, demoRecommendations, demoSearch, diversify } from './demo'
import type { PaperResult, SearchPaper, SearchStatus } from './types'

// 論文さがしの取得元。ログインして使うときは Worker の API(/api/papers/)、
// 接続情報がない見た目確認用の画面では、外部と通信しないデモ。

export interface PaperSource {
  live: boolean
  status(): Promise<SearchStatus | null>
  search(query: string): Promise<PaperResult>
  recommendations(fields: Field[], offset: number, history: string[]): Promise<PaperResult>
  similar(paper: SearchPaper, exclude: string[]): Promise<PaperResult>
  translate(ids: string[], retry: boolean): Promise<PaperResult>
}

export const demoSource: PaperSource = {
  live: false,
  status: async () => null,
  search: async (query) => ({
    papers: demoSearch(query),
    notice: '見た目の確認用のデモです。同梱した29本の中から探しています。',
  }),
  recommendations: async (fields, offset, history) => ({
    papers: demoRecommendations(fields, offset, history),
    notice: '見た目の確認用に選んだ、実在の論文です。最新・流行のランキングではありません。',
  }),
  similar: async (paper, exclude) => ({
    papers: diversify(paper, DEMO_PAPERS, exclude),
    notice: 'デモのタグ(対象・手法・課題・分野)に基づく類似候補です。',
  }),
  translate: async () => ({ papers: [], notice: '' }),
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const session = (await supabase?.auth.getSession())?.data.session
  if (!session) throw new Error('ログインし直してください。')
  let res: Response
  try {
    res = await fetch(`/api/papers/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('通信できませんでした。通信を確かめて、もう一度お試しください。')
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok || !data) throw new Error(data?.error ?? '取得できませんでした。時間をおいて、もう一度お試しください。')
  return data
}

export const liveSource: PaperSource = {
  live: true,
  status: () => call<SearchStatus>('status'),
  search: (query) => call('search', { query }),
  // 実検索のおすすめは、選んだ分野だけを使う(閲覧履歴は、デモだけで使う)
  recommendations: (fields, offset) => call('recommendations', { fields, offset }),
  similar: (paper, exclude) => call('similar', { id: paper.id, exclude }),
  translate: (ids, retry) => call('translate', { ids, retry }),
}

export const paperSource: PaperSource = supabase ? liveSource : demoSource
