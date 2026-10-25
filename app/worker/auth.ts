// API を使えるのは、つむよむにログインして、招待コードで登録を済ませた人だけ(外部 API の無料枠を守るため)。
// 画面から受け取った Supabase のアクセストークンを、Supabase に問い合わせて確かめる。

export interface AuthEnv {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
}

export type AuthResult = { userId: string } | { error: 401 | 503 }

const TTL = 5 * 60_000
// 同じトークンで続けて呼ばれたときに、毎回 Supabase へ問い合わせない(Worker の中だけの、短い覚え)
const verified = new Map<string, { userId: string; until: number }>()

export async function authorize(
  request: Request,
  env: AuthEnv,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<AuthResult> {
  const token = (request.headers.get('Authorization') ?? '').match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token) return { error: 401 }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return { error: 503 }

  const hit = verified.get(token)
  if (hit && hit.until > now()) return { userId: hit.userId }

  const base = env.SUPABASE_URL.replace(/\/+$/, '')
  const headers = { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  try {
    const user = await fetchImpl(`${base}/auth/v1/user`, { headers })
    if (user.status >= 500) return { error: 503 }
    if (!user.ok) return { error: 401 }
    const { id } = (await user.json()) as { id?: unknown }
    if (typeof id !== 'string') return { error: 401 }

    // プロフィールがない人は、まだ招待コードを入れていない
    const profile = await fetchImpl(`${base}/rest/v1/profiles?select=id&id=eq.${encodeURIComponent(id)}`, { headers })
    if (profile.status >= 500) return { error: 503 }
    if (!profile.ok) return { error: 401 }
    const rows = (await profile.json()) as unknown
    if (!Array.isArray(rows) || rows.length === 0) return { error: 401 }

    if (verified.size > 500) verified.clear()
    verified.set(token, { userId: id, until: now() + TTL })
    return { userId: id }
  } catch (e) {
    console.error('auth check failed', e)
    return { error: 503 }
  }
}
