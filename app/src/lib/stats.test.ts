import { describe, expect, it } from 'vitest'
import type { EntryRow } from './records'
import { countEntries, formatDay, todayString } from './stats'

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
