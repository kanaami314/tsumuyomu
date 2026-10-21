import type { EntryRow } from './records'

export interface Counts {
  /** 通算で読んだ本数 */
  total: number
  /** 今月読んだ本数 */
  month: number
  /** 読んだ日の数(同じ日に何本読んでも 1) */
  days: number
}

/** 今日の日付を、YYYY-MM-DD(端末の時刻)で返す */
export function todayString(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function formatDay(date: string | null): string {
  const m = date?.match(/^\d{4}-(\d{2})-(\d{2})/)
  return m ? `${Number(m[1])}月${Number(m[2])}日` : ''
}

export function countEntries(entries: EntryRow[], today = todayString()): Counts {
  const done = entries.filter((e) => e.status === 'done')
  const thisMonth = today.slice(0, 7)
  return {
    total: done.length,
    month: done.filter((e) => e.read_on?.startsWith(thisMonth)).length,
    days: new Set(done.map((e) => e.read_on).filter(Boolean)).size,
  }
}
