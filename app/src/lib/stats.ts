import { fieldOf, type Field } from './books'
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

/** 読んだ(読了した)記録のうち、日付のあるもの */
const datedDone = (entries: EntryRow[]) =>
  entries.filter((e): e is EntryRow & { read_on: string } => e.status === 'done' && e.read_on !== null)

export interface MonthBucket {
  /** 'YYYY-MM' */
  key: string
  year: number
  month: number
  count: number
  /** その月に読んだ論文の分野(積み上げの色に使う) */
  fields: Field[]
  /** その月の終わりまでの通算 */
  cumulative: number
}

/** 今月までの直近 months か月ぶん。月ごとに、読んだ本数と、そこまでの通算を出す */
export function monthlyBuckets(entries: EntryRow[], today = todayString(), months = 12): MonthBucket[] {
  const done = datedDone(entries)
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const buckets: MonthBucket[] = []
  for (let i = months - 1; i >= 0; i--) {
    const index = year * 12 + (month - 1) - i
    const y = Math.floor(index / 12)
    const m = (index % 12) + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    const inMonth = done.filter((e) => e.read_on.startsWith(key))
    buckets.push({
      key,
      year: y,
      month: m,
      count: inMonth.length,
      fields: inMonth.map((e) => fieldOf(e.paper)),
      cumulative: done.filter((e) => e.read_on.slice(0, 7) <= key).length,
    })
  }
  return buckets
}

export function fieldBreakdown(entries: EntryRow[]): { field: Field; count: number }[] {
  const counts = new Map<Field, number>()
  for (const e of entries.filter((e) => e.status === 'done')) {
    const f = fieldOf(e.paper)
    counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  return [...counts].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count)
}

export function depthBreakdown(entries: EntryRow[]): { light: number; deep: number; unset: number } {
  const done = entries.filter((e) => e.status === 'done')
  return {
    light: done.filter((e) => e.depth === 'light').length,
    deep: done.filter((e) => e.depth === 'deep').length,
    unset: done.filter((e) => e.depth === null).length,
  }
}

/** 読んだ日が空の記録の数。通算には入るが、月ごとの推移には出ない */
export function undatedCount(entries: EntryRow[]): number {
  return entries.filter((e) => e.status === 'done' && e.read_on === null).length
}

/** 指定の月('YYYY-MM')に読んだ記録を、新しい順に */
export function entriesOfMonth(entries: EntryRow[], key: string): EntryRow[] {
  return datedDone(entries)
    .filter((e) => e.read_on.startsWith(key))
    .sort((a, b) => b.read_on.localeCompare(a.read_on) || b.created_at.localeCompare(a.created_at))
}
