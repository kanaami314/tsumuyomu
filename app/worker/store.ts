// キャッシュと、日ごとの呼び出し回数の保存先。公開先は Cloudflare D1(SQLite)、テストはメモリ。

export interface CacheEntry {
  key: string
  value: unknown
  /** 有効期間(ミリ秒) */
  ttl: number
}

export interface Store {
  /** 期限内のものだけを返す */
  getMany(keys: string[]): Promise<Map<string, unknown>>
  putMany(entries: CacheEntry[]): Promise<void>
  delete(key: string): Promise<void>
  usage(day: string): Promise<Record<string, number>>
  /** 上限に達していなければ 1 回分を数えて true。達していたら、数えずに false */
  reserve(day: string, service: string, limit: number): Promise<boolean>
  /** 期限切れを消す */
  prune(): Promise<void>
}

// D1 の型のうち、使うものだけ(@cloudflare/workers-types を入れずに済ませる)
export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

export interface D1Like {
  prepare(sql: string): D1Statement
  batch(statements: D1Statement[]): Promise<unknown[]>
}

// D1 は、1 つの文で使える値が 100 個まで
const CHUNK = 50

/** 同じキーは、あとのものを残す */
const lastByKey = (entries: CacheEntry[]) => [...new Map(entries.map((e) => [e.key, e])).values()]

export class D1Store implements Store {
  private db: D1Like
  private now: () => number

  constructor(db: D1Like, now: () => number = Date.now) {
    this.db = db
    this.now = now
  }

  async getMany(keys: string[]): Promise<Map<string, unknown>> {
    const out = new Map<string, unknown>()
    const unique = [...new Set(keys)]
    for (let i = 0; i < unique.length; i += CHUNK) {
      const part = unique.slice(i, i + CHUNK)
      const { results } = await this.db
        .prepare(`SELECT key, value FROM cache WHERE expires > ? AND key IN (${part.map(() => '?').join(',')})`)
        .bind(this.now(), ...part)
        .all<{ key: string; value: string }>()
      for (const row of results) out.set(row.key, JSON.parse(row.value))
    }
    return out
  }

  async putMany(entries: CacheEntry[]): Promise<void> {
    if (entries.length === 0) return
    const now = this.now()
    const statement = this.db.prepare('INSERT OR REPLACE INTO cache (key, value, expires) VALUES (?, ?, ?)')
    await this.db.batch(lastByKey(entries).map((e) => statement.bind(e.key, JSON.stringify(e.value), now + e.ttl)))
  }

  async delete(key: string): Promise<void> {
    await this.db.prepare('DELETE FROM cache WHERE key = ?').bind(key).run()
  }

  async usage(day: string): Promise<Record<string, number>> {
    const { results } = await this.db
      .prepare('SELECT service, count FROM usage WHERE day = ?')
      .bind(day)
      .all<{ service: string; count: number }>()
    return Object.fromEntries(results.map((r) => [r.service, r.count]))
  }

  async reserve(day: string, service: string, limit: number): Promise<boolean> {
    if (limit <= 0) return false
    // 数えるのと、上限の確認を 1 つの文で行う(同時に呼ばれても、上限を超えない)
    const row = await this.db
      .prepare(
        'INSERT INTO usage (day, service, count) VALUES (?, ?, 1) ON CONFLICT (day, service) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count',
      )
      .bind(day, service, limit)
      .first<{ count: number }>()
    return row !== null
  }

  async prune(): Promise<void> {
    await this.db.prepare('DELETE FROM cache WHERE expires <= ?').bind(this.now()).run()
  }
}

export class MemoryStore implements Store {
  cache = new Map<string, { value: string; expires: number }>()
  counts = new Map<string, number>()
  private now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  async getMany(keys: string[]) {
    const out = new Map<string, unknown>()
    for (const key of keys) {
      const hit = this.cache.get(key)
      if (hit && hit.expires > this.now()) out.set(key, JSON.parse(hit.value))
    }
    return out
  }

  async putMany(entries: CacheEntry[]) {
    for (const e of entries) this.cache.set(e.key, { value: JSON.stringify(e.value), expires: this.now() + e.ttl })
  }

  async delete(key: string) {
    this.cache.delete(key)
  }

  async usage(day: string) {
    const out: Record<string, number> = {}
    for (const [k, n] of this.counts) {
      const [d, service] = k.split('|')
      if (d === day) out[service] = n
    }
    return out
  }

  async reserve(day: string, service: string, limit: number) {
    const k = `${day}|${service}`
    const n = this.counts.get(k) ?? 0
    if (n >= limit) return false
    this.counts.set(k, n + 1)
    return true
  }

  async prune() {
    for (const [k, v] of this.cache) if (v.expires <= this.now()) this.cache.delete(k)
  }
}
