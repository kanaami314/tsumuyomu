import { describe, expect, it } from 'vitest'
import { parsePublicPath, selectPublic } from './publicView'
import type { EntryRow, ShelfLink, ShelfRow } from './records'

describe('parsePublicPath', () => {
  it('/u/ユーザー名 から、ユーザー名を取り出す', () => {
    expect(parsePublicPath('/u/kanaami')).toBe('kanaami')
    expect(parsePublicPath('/u/kanaami/')).toBe('kanaami')
    expect(parsePublicPath('/u/a_b_1')).toBe('a_b_1')
  })

  it('それ以外は null', () => {
    expect(parsePublicPath('/')).toBeNull()
    expect(parsePublicPath('/u/')).toBeNull()
    expect(parsePublicPath('/u/ab')).toBeNull()
    expect(parsePublicPath('/u/UPPER')).toBeNull()
    expect(parsePublicPath('/u/kanaami/extra')).toBeNull()
    expect(parsePublicPath('/user/kanaami')).toBeNull()
  })
})

const entry = (id: string, visibility: EntryRow['visibility'], status: EntryRow['status'] = 'done'): EntryRow => ({
  id,
  paper_id: id,
  status,
  read_on: '2026-10-20',
  depth: null,
  comment: `コメント ${id}`,
  rating: 3,
  visibility,
  created_at: '2026-10-20T00:00:00Z',
  paper: { id, doi: null, arxiv_id: null, title: id, authors: [], year: null, venue: null, url: null, field: null },
})

const shelf = (id: string, visibility: ShelfRow['visibility']): ShelfRow => ({ id, name: id, visibility, position: 0 })

describe('selectPublic', () => {
  const entries = [entry('pub', 'public'), entry('priv', 'private'), entry('want', 'public', 'want')]
  const shelves = [shelf('s-pub', 'public'), shelf('s-priv', 'private')]
  const links: ShelfLink[] = [
    { shelf_id: 's-pub', entry_id: 'pub' },
    { shelf_id: 's-pub', entry_id: 'priv' },
    { shelf_id: 's-priv', entry_id: 'pub' },
  ]

  it('公開の記録(読了)だけを残す', () => {
    expect(selectPublic(entries, shelves, links).entries.map((e) => e.id)).toEqual(['pub'])
  })

  it('公開の棚だけを残す', () => {
    expect(selectPublic(entries, shelves, links).shelves.map((s) => s.id)).toEqual(['s-pub'])
  })

  it('公開の棚の中の非公開の記録は、出さない。非公開の棚への紐づけも、出さない', () => {
    expect(selectPublic(entries, shelves, links).links).toEqual([{ shelf_id: 's-pub', entry_id: 'pub' }])
  })

  it('何も公開していなければ、空', () => {
    expect(selectPublic([entry('a', 'private')], [shelf('s', 'private')], [{ shelf_id: 's', entry_id: 'a' }])).toEqual({
      entries: [],
      shelves: [],
      links: [],
    })
  })
})
