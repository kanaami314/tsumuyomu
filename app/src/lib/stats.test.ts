import { describe, expect, it } from 'vitest'
import type { EntryRow } from './records'
import { countEntries, depthBreakdown, entriesOfMonth, fieldBreakdown, formatDay, monthlyBuckets, todayString, undatedCount } from './stats'

const entry = (id: string, readOn: string | null, status: EntryRow['status'] = 'done'): EntryRow => ({
  id,
  paper_id: id,
  status,
  read_on: readOn,
  depth: null,
  comment: null,
  rating: null,
  visibility: 'private',
  created_at: '2026-10-22T00:00:00Z',
  paper: { id, doi: null, arxiv_id: null, title: id, authors: [], year: null, venue: null, url: null, field: null },
})

describe('countEntries', () => {
  const entries = [
    entry('a', '2026-10-22'),
    entry('b', '2026-10-22'),
    entry('c', '2026-10-03'),
    entry('d', '2026-09-30'),
    entry('e', null),
    entry('f', '2026-10-20', 'want'),
  ]

  it('通算・今月・読んだ日を数える(読みたいものは数えない)', () => {
    expect(countEntries(entries, '2026-10-22')).toEqual({ total: 5, month: 3, days: 3 })
  })

  it('空なら 0', () => {
    expect(countEntries([], '2026-10-22')).toEqual({ total: 0, month: 0, days: 0 })
  })
})

describe('日付', () => {
  it('端末の日付を YYYY-MM-DD にする', () => {
    expect(todayString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('「10月20日」の形にする', () => {
    expect(formatDay('2026-10-20')).toBe('10月20日')
    expect(formatDay(null)).toBe('')
  })
})

const detailed = (id: string, readOn: string | null, field: EntryRow['paper']['field'], depth: EntryRow['depth'] = null): EntryRow => {
  const e = entry(id, readOn)
  return { ...e, depth, paper: { ...e.paper, field } }
}

describe('monthlyBuckets', () => {
  const entries = [
    detailed('a', '2026-10-22', 'ml'),
    detailed('b', '2026-10-03', 'ps'),
    detailed('c', '2026-09-30', 'ml'),
    detailed('d', '2025-12-31', 'ne'),
    detailed('e', '2024-01-15', 'ed'),
    detailed('f', null, 'ml'),
    { ...detailed('g', '2026-10-10', 'ml'), status: 'want' as const },
  ]

  it('今月までの 12 か月ぶん、古い順に並ぶ', () => {
    const b = monthlyBuckets(entries, '2026-10-22')
    expect(b).toHaveLength(12)
    expect(b[0].key).toBe('2025-11')
    expect(b[11].key).toBe('2026-10')
  })

  it('年をまたいでも月が正しい', () => {
    const b = monthlyBuckets(entries, '2026-02-10')
    expect(b.map((x) => x.key).slice(0, 3)).toEqual(['2025-03', '2025-04', '2025-05'])
    expect(b[9]).toMatchObject({ key: '2025-12', year: 2025, month: 12, count: 1 })
  })

  it('月ごとの本数と分野を数える(読みたいものは数えない)', () => {
    const oct = monthlyBuckets(entries, '2026-10-22').at(-1)!
    expect(oct.count).toBe(2)
    expect(oct.fields.sort()).toEqual(['ml', 'ps'])
  })

  it('通算は、窓より前の記録も含めて積み上がる', () => {
    const b = monthlyBuckets(entries, '2026-10-22')
    expect(b[0].cumulative).toBe(1)
    expect(b.find((x) => x.key === '2026-09')!.cumulative).toBe(3)
    expect(b.at(-1)!.cumulative).toBe(5)
  })

  it('最後の月の通算 + 日付のない記録 = 統計の通算', () => {
    const total = countEntries(entries, '2026-10-22').total
    expect(monthlyBuckets(entries, '2026-10-22').at(-1)!.cumulative + undatedCount(entries)).toBe(total)
  })
})

describe('内訳と月の一覧', () => {
  const entries = [
    detailed('a', '2026-10-22', 'ml', 'deep'),
    detailed('b', '2026-10-03', 'ml', 'light'),
    detailed('c', '2026-10-03', 'ps'),
    detailed('d', '2026-09-30', 'ml', 'deep'),
  ]

  it('分野を多い順に数える', () => {
    expect(fieldBreakdown(entries)).toEqual([
      { field: 'ml', count: 3 },
      { field: 'ps', count: 1 },
    ])
  })

  it('読み方を数える', () => {
    expect(depthBreakdown(entries)).toEqual({ light: 1, deep: 2, unset: 1 })
  })

  it('月の記録を新しい順に返す', () => {
    expect(entriesOfMonth(entries, '2026-10').map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(entriesOfMonth(entries, '2026-08')).toEqual([])
  })
})

describe('記録がないとき', () => {
  it('どの集計も落ちず、0 や空になる', () => {
    const buckets = monthlyBuckets([], '2026-10-22')
    expect(buckets).toHaveLength(12)
    expect(buckets.every((b) => b.count === 0 && b.cumulative === 0 && b.fields.length === 0)).toBe(true)
    expect(fieldBreakdown([])).toEqual([])
    expect(depthBreakdown([])).toEqual({ light: 0, deep: 0, unset: 0 })
    expect(entriesOfMonth([], '2026-10')).toEqual([])
    expect(undatedCount([])).toBe(0)
  })
})
