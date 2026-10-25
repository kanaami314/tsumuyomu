import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { handleApi, type Env } from './index'
import { normalizeWork, PaperService, reconstruct, type ServiceConfig } from './service'
import { D1Store, MemoryStore, type D1Like, type D1Statement } from './store'

// 論文サーチャーの tests/server.test.mjs・translation.test.mjs と、tests/fixtures/mock-provider.mjs を移したもの

const config = (over: Partial<ServiceConfig> = {}): ServiceConfig => ({
  aiEnabled: true,
  geminiKey: 'test-only-fake-key',
  model: 'gemini-test',
  limits: { openalex: 50, ai: 20 },
  ...over,
})

/** OpenAlex と Gemini の代わり。呼ばれた回数を数える */
function mockProvider() {
  const calls = { openalex: 0, ai: 0 }
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const u = new URL(String(input instanceof Request ? input.url : input))
    if (u.hostname === 'api.openalex.org') {
      calls.openalex++
      const search = u.searchParams.get('search') ?? ''
      const partial = search.includes('partial-')
      const base = partial ? 900 : search === 'missing-abstract' ? 500 : 100
      const results = Array.from({ length: partial ? 3 : 15 }, (_, i) => ({
        id: `https://openalex.org/W${base + i}`,
        display_name: `Autonomous driving study ${i}`,
        publication_year: 2025,
        publication_date: '2025-01-01',
        authorships: [{ author: { display_name: 'Ada Lovelace' } }],
        doi: `https://doi.org/10.1234/test.${base + i}`,
        primary_location: { source: { display_name: 'Test Journal' } },
        abstract_inverted_index: search === 'missing-abstract' ? null : { Cameras: [0], help: [1] },
        primary_topic: { display_name: 'Autonomous Vehicle Technology', field: { display_name: 'Engineering' } },
        topics: [{ display_name: 'Autonomous Vehicle Technology' }, { display_name: 'Computer Vision' }],
        cited_by_count: 3,
      }))
      return new Response(JSON.stringify({ results }), { status: 200 })
    }
    if (u.hostname === 'generativelanguage.googleapis.com') {
      calls.ai++
      const request = JSON.parse(String(init.body))
      const input = JSON.parse(request.contents[0].parts[0].text)
      const instruction: string = request.systemInstruction.parts[0].text
      let result: unknown
      if (typeof input === 'string') result = { query: input }
      else if (Array.isArray(input)) {
        let papers = input.map((p: { id: string }) => ({
          id: p.id,
          ja: 'カメラを使った研究',
          summary: '抄録に基づくテスト要約です。',
          question: '何を比較するか',
          methodExplanation: 'カメラを比較',
          limitations: '抄録からは確認できません',
        }))
        // 1 回目は、W900 を落とし、W901 を英語にする(部分的な失敗)
        if (input.some((p: { id: string }) => p.id.endsWith('W900')) && !instruction.includes('Repair attempt')) {
          papers = papers.filter((p) => !p.id.endsWith('W900'))
          const english = papers.find((p) => p.id.endsWith('W901'))
          if (english) english.summary = 'English only'
        }
        const optional = papers.find((p) => p.id.endsWith('W902'))
        if (optional) delete (optional as Partial<typeof optional>).methodExplanation
        result = papers
      } else result = { axes: [] }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }), { status: 200 })
    }
    if (u.hostname === 'supabase.test') {
      const token = new Headers(init.headers).get('Authorization')
      if (token !== 'Bearer good' && token !== 'Bearer uninvited') return new Response('{}', { status: 401 })
      if (u.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: token === 'Bearer good' ? 'u1' : 'u2' }))
      return new Response(JSON.stringify(token === 'Bearer good' ? [{ id: 'u1' }] : []))
    }
    throw new Error(`unexpected fetch ${u}`)
  }) as typeof fetch
  return { calls, fetchImpl }
}

describe('PaperService', () => {
  test('AI の説明を確かめてキャッシュし、日次の上限で止まる', async () => {
    const { calls, fetchImpl } = mockProvider()
    const service = new PaperService(new MemoryStore(), config({ limits: { openalex: 50, ai: 2 } }), fetchImpl)
    const first = await service.search('自動運転 画像認識')
    expect(first.papers).toHaveLength(10)
    expect(first.papers.every((p) => p.ja === 'カメラを使った研究' && p.scope === '抄録に基づくAI説明')).toBe(true)

    await service.search('自動運転 画像認識')
    const status = await service.status()
    expect(status.usage).toEqual({ ai: 2, openalex: 1 })
    expect(calls.ai).toBe(2)

    await expect(service.search('別の検索')).rejects.toThrow(/上限/)
  })

  test('抄録のない論文は、タイトルだけを訳し、要約を作らない', async () => {
    const { fetchImpl } = mockProvider()
    const { papers } = await new PaperService(new MemoryStore(), config(), fetchImpl).search('missing-abstract')
    expect(papers[0].analysisStatus).toBe('title-only')
    expect(papers[0].ja).toBe('カメラを使った研究')
    expect(papers[0].summary).toBe('')
    expect(papers[0].scope).toMatch(/タイトルのみ/)
  })

  test('欠けた訳だけを再試行し、補助の項目の欠けでは捨てない。書誌を取り直しても説明を保つ', async () => {
    const { calls, fetchImpl } = mockProvider()
    const service = new PaperService(new MemoryStore(), config(), fetchImpl)
    const result = await service.search('partial-repair')
    expect(result.papers).toHaveLength(3)
    expect(result.papers.every((p) => p.summary === '抄録に基づくテスト要約です。')).toBe(true)
    expect(result.papers[2].methodExplanation).toBe('抄録からは確認できません。')
    expect(result.notice).toBe('')
    expect(calls.ai).toBe(3) // 検索語 1 回 + 説明 1 回 + 再試行 1 回

    const count = calls.ai
    await service.translate(result.papers.map((p) => p.id), true)
    expect(calls.ai).toBe(count) // 完成した訳は、作り直さない

    const refreshed = await service.search('partial-refresh')
    expect(refreshed.papers.every((p) => p.ja)).toBe(true)
    expect(calls.ai).toBe(count + 1) // 検索語の変換だけ
  })

  test('AI なしでは、辞書で検索語を変え、未完了を知らせる', async () => {
    const { calls, fetchImpl } = mockProvider()
    const result = await new PaperService(new MemoryStore(), config({ aiEnabled: false }), fetchImpl).search('学習 記憶')
    expect(result.translated).toBe('learning memory')
    expect(result.notice).toMatch(/AI未接続/)
    expect(calls.ai).toBe(0)
  })

  test('おすすめは、関心分野の 4 件と、視野を広げる 1 件', async () => {
    const { fetchImpl } = mockProvider()
    const result = await new PaperService(new MemoryStore(), config(), fetchImpl).recommendations(['ml'], 0)
    // モックは分野にかかわらず同じ論文を返すので、重複を除いた 4 件になる。分け方だけを確かめる
    expect(result.papers.filter((p) => !p.discovery)).toHaveLength(4)
    expect(result.papers.every((p) => p.relation)).toBe(true)
    expect(result.notice).toMatch(/過去1年/)
  })

  test('類似は、キャッシュ済みの論文から、経路にあるものを除いて探す', async () => {
    const { fetchImpl } = mockProvider()
    const service = new PaperService(new MemoryStore(), config({ aiEnabled: false }), fetchImpl)
    const { papers } = await service.search('autonomous')
    const result = await service.similar(papers[0].id, [papers[1].id])
    expect(result.papers.length).toBeGreaterThan(0)
    expect(result.papers.length).toBeLessThanOrEqual(10)
    expect(result.papers.some((p) => p.id === papers[0].id || p.id === papers[1].id)).toBe(false)
    await expect(service.similar('https://openalex.org/W0', [])).rejects.toThrow(/見つかりません/)
  })

  test('fetch を、Worker と同じく this なしで呼ぶ(Illegal invocation にならない)', async () => {
    const { fetchImpl } = mockProvider()
    // Worker の fetch は、別のオブジェクトのメソッドとして呼ぶと TypeError になる。それをまねる
    const strictFetch = function (this: unknown, input: string | URL | Request, init?: RequestInit) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation')
      return fetchImpl(input, init)
    } as typeof fetch
    const service = new PaperService(new MemoryStore(), config(), strictFetch)
    await expect(service.search('autonomous')).resolves.toMatchObject({ papers: expect.any(Array) })
  })

  test('入力を確かめる', async () => {
    const service = new PaperService(new MemoryStore(), config(), mockProvider().fetchImpl)
    await expect(service.search('')).rejects.toThrow(/1〜300文字/)
    await expect(service.translate([], false)).rejects.toThrow(/1〜11件/)
  })
})

test('抄録の索引を、順に戻し、おかしな位置を捨てる', () => {
  expect(reconstruct({ world: [1], Hello: [0], bad: [-1, 999999] })).toBe('Hello world')
  expect(reconstruct(null)).toBe('')
})

test('OpenAlex の論文を、表示と記録に使う形にする', () => {
  const p = normalizeWork({ id: 'https://openalex.org/W1', display_name: 'T', doi: 'javascript:alert(1)', authorships: [{ author: { display_name: 'A B' } }] })
  expect(p.url).toBe('')
  expect(p.authorList).toEqual(['A B'])
  expect(p.demo).toBe(false)
})

describe('handleApi', () => {
  const env = { SUPABASE_URL: 'https://supabase.test', SUPABASE_ANON_KEY: 'anon', AI_ENABLED: 'false' } as unknown as Env
  const ctx = { waitUntil: () => undefined }
  const call = (path: string, init: RequestInit = {}, token = 'good') => {
    const { fetchImpl } = mockProvider()
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return handleApi(new Request(`https://tsumuyomu.test${path}`, { ...init, headers }), env, ctx, { fetchImpl, store: new MemoryStore() })
  }

  test('ログインして招待を済ませた人だけが使える', async () => {
    expect((await call('/api/papers/status', {}, '')).status).toBe(401)
    expect((await call('/api/papers/status', {}, 'bad')).status).toBe(401)
    expect((await call('/api/papers/status', {}, 'uninvited')).status).toBe(401)
    const ok = await call('/api/papers/status')
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ ai: false, limits: { openalex: 50, ai: 20 } })
  })

  test('別のサイトからの書き込みと、空の検索語を断る。キーを返さない', async () => {
    const post = (body: unknown, origin?: string) =>
      call('/api/papers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
        body: JSON.stringify(body),
      })
    expect((await post({ query: 'x' }, 'https://untrusted.example')).status).toBe(403)
    const empty = await post({ query: '' })
    expect(empty.status).toBe(400)
    expect(await empty.text()).not.toMatch(/anon|test-only/)
    expect((await post({ query: 'autonomous' }, 'https://tsumuyomu.test')).status).toBe(200)
  })
})

/** node:sqlite を、D1 と同じ呼び方で包む(D1Store の SQL を、本物の SQLite で確かめる) */
function sqliteD1(): D1Like {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('./migrations/0001_init.sql', import.meta.url), 'utf8'))
  const statement = (sql: string, values: unknown[] = []): D1Statement => ({
    bind: (...v) => statement(sql, v),
    first: async <T,>() => (db.prepare(sql).get(...(values as never[])) as T) ?? null,
    all: async <T,>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[] }),
    run: async () => db.prepare(sql).run(...(values as never[])),
  })
  return { prepare: (sql) => statement(sql), batch: async (list) => Promise.all(list.map((s) => s.run())) }
}

test('D1Store: 期限、上書き、上限の数え方', async () => {
  let now = 1_000
  const store = new D1Store(sqliteD1(), () => now)
  await store.putMany([
    { key: 'a', value: { n: 1 }, ttl: 100 },
    { key: 'a', value: { n: 2 }, ttl: 100 },
    { key: 'b', value: [1], ttl: 10 },
  ])
  expect(await store.getMany(['a', 'b', 'c'])).toEqual(new Map<string, unknown>([['a', { n: 2 }], ['b', [1]]]))
  now = 1_050
  expect([...(await store.getMany(['a', 'b'])).keys()]).toEqual(['a'])
  await store.prune()
  await store.delete('a')
  expect((await store.getMany(['a'])).size).toBe(0)

  const keys = Array.from({ length: 120 }, (_, i) => `k${i}`)
  await store.putMany(keys.map((key) => ({ key, value: key, ttl: 100 })))
  expect((await store.getMany(keys)).size).toBe(120)

  expect(await store.reserve('2026-10-25', 'ai', 2)).toBe(true)
  expect(await store.reserve('2026-10-25', 'ai', 2)).toBe(true)
  expect(await store.reserve('2026-10-25', 'ai', 2)).toBe(false)
  expect(await store.reserve('2026-10-25', 'openalex', 0)).toBe(false)
  expect(await store.usage('2026-10-25')).toEqual({ ai: 2 })
})
