import { authorize, type AuthEnv } from './auth'
import { configFromEnv, PaperService, ServiceError } from './service'
import { D1Store, type D1Like, type Store } from './store'

// つむよむの Worker。画面(dist)はそのまま配信し、/api/ だけをここで扱う(wrangler.jsonc の run_worker_first)。

export interface Env extends AuthEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
  DB: D1Like
  AI_ENABLED?: string
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  OPENALEX_API_KEY?: string
  AI_DAILY_LIMIT?: string
  OPENALEX_DAILY_LIMIT?: string
}

interface Context {
  waitUntil(promise: Promise<unknown>): void
}

const PREFIX = '/api/papers/'
const MAX_BODY = 64_000

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })

export interface Deps {
  fetchImpl?: typeof fetch
  store?: Store
}

export async function handleApi(request: Request, env: Env, ctx: Context, deps: Deps = {}): Promise<Response> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith(PREFIX)) return json(404, { error: '操作が見つかりません。' })

  // 別のサイトからの呼び出しは断る(画面と同じオリジンだけ)
  const origin = request.headers.get('Origin')
  if (origin && origin !== url.origin) return json(403, { error: '許可されていない接続です。' })

  const fetchImpl = deps.fetchImpl ?? fetch
  const auth = await authorize(request, env, fetchImpl)
  if ('error' in auth)
    return auth.error === 401
      ? json(401, { error: 'ログインし直してください。' })
      : json(503, { error: 'ログインを確かめられませんでした。時間をおいて、もう一度お試しください。' })

  const store = deps.store ?? new D1Store(env.DB)
  const service = new PaperService(store, configFromEnv(env as unknown as Record<string, string | undefined>), fetchImpl)
  // ときどき、期限切れのキャッシュを片付ける
  if (Math.random() < 0.02) ctx.waitUntil(store.prune().catch(() => undefined))

  const route = url.pathname.slice(PREFIX.length)
  try {
    if (route === 'status') return json(200, await service.status())
    if (request.method !== 'POST') return json(405, { error: 'この操作は利用できません。' })

    const text = await request.text()
    if (text.length > MAX_BODY) return json(413, { error: '入力が大きすぎます。' })
    let body: Record<string, unknown>
    try {
      body = JSON.parse(text || '{}')
    } catch {
      return json(400, { error: '入力の形式を確認してください。' })
    }

    switch (route) {
      case 'search':
        return json(200, await service.search(body.query))
      case 'recommendations':
        return json(200, await service.recommendations(body.fields, body.offset))
      case 'similar':
        return json(200, await service.similar(body.id, body.exclude))
      case 'translate':
        return json(200, await service.translate(body.ids, body.retry))
      default:
        return json(404, { error: '操作が見つかりません。' })
    }
  } catch (e) {
    if (e instanceof ServiceError) return json(e.status, { error: e.message })
    if (e instanceof Error && e.name === 'TimeoutError') return json(504, { error: '接続に時間がかかっています。再度お試しください。' })
    console.error(e)
    return json(500, { error: '処理に失敗しました。時間をおいて、もう一度お試しください。' })
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, ctx)
    return env.ASSETS.fetch(request)
  },
}
