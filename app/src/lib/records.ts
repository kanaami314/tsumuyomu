import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaperDraft } from './biblio'
import type { Field } from './books'

export type Depth = 'light' | 'deep'

export interface PaperRow {
  id: string
  doi: string | null
  arxiv_id: string | null
  title: string
  authors: string[]
  year: number | null
  venue: string | null
  url: string | null
  field: Field | null
}

export interface EntryRow {
  id: string
  paper_id: string
  status: 'want' | 'reading' | 'done'
  read_on: string | null
  depth: Depth | null
  comment: string | null
  rating: number | null
  visibility: 'private' | 'public'
  created_at: string
  paper: PaperRow
}

export interface ShelfRow {
  id: string
  name: string
  visibility: 'private' | 'public'
  position: number
}

export interface ShelfLink {
  shelf_id: string
  entry_id: string
}

export interface EntryInput {
  readOn: string
  depth: Depth | null
  comment: string
  rating: number
  isPublic: boolean
  shelfIds: string[]
}

export interface Snapshot {
  entries: EntryRow[]
  shelves: ShelfRow[]
  links: ShelfLink[]
}

const PAPER_COLUMNS = 'id, doi, arxiv_id, title, authors, year, venue, url, field'
const UNIQUE_VIOLATION = '23505'

export async function fetchSnapshot(db: SupabaseClient, userId: string): Promise<Snapshot> {
  const [entries, shelves] = await Promise.all([
    db
      .from('entries')
      .select(`id, paper_id, status, read_on, depth, comment, rating, visibility, created_at, paper:papers(${PAPER_COLUMNS})`)
      .eq('user_id', userId)
      .order('read_on', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .returns<EntryRow[]>(),
    db
      .from('shelves')
      .select('id, name, visibility, position')
      .eq('user_id', userId)
      .order('position')
      .order('created_at')
      .returns<ShelfRow[]>(),
  ])
  if (entries.error) throw entries.error
  if (shelves.error) throw shelves.error

  const shelfIds = shelves.data.map((s) => s.id)
  let links: ShelfLink[] = []
  if (shelfIds.length > 0) {
    const res = await db.from('shelf_entries').select('shelf_id, entry_id').in('shelf_id', shelfIds).returns<ShelfLink[]>()
    if (res.error) throw res.error
    links = res.data
  }
  return { entries: entries.data, shelves: shelves.data, links }
}

/** 同じ DOI の論文があればそれを使い、なければ作る。DOI がなければ、そのつど作る */
async function ensurePaper(db: SupabaseClient, draft: PaperDraft): Promise<string> {
  const find = async () => {
    const res = await db.from('papers').select('id').eq('doi', draft.doi!).maybeSingle()
    if (res.error) throw res.error
    return res.data?.id as string | undefined
  }
  if (draft.doi) {
    const existing = await find()
    if (existing) return existing
  }
  const row = {
    doi: draft.doi,
    arxiv_id: draft.arxivId,
    title: draft.title,
    authors: draft.authors,
    year: draft.year,
    venue: draft.venue,
    url: draft.url,
    field: draft.field,
  }
  const res = await db.from('papers').insert(row).select('id').single()
  if (res.error) {
    // 同時に同じ論文を作った人がいたとき
    if (res.error.code === UNIQUE_VIOLATION && draft.doi) {
      const existing = await find()
      if (existing) return existing
    }
    throw res.error
  }
  return res.data.id as string
}

async function replaceShelves(db: SupabaseClient, entryId: string, want: string[], current: string[]) {
  const toAdd = want.filter((id) => !current.includes(id))
  const toRemove = current.filter((id) => !want.includes(id))
  if (toAdd.length > 0) {
    const res = await db.from('shelf_entries').insert(toAdd.map((shelf_id) => ({ shelf_id, entry_id: entryId })))
    if (res.error) throw res.error
  }
  if (toRemove.length > 0) {
    const res = await db.from('shelf_entries').delete().eq('entry_id', entryId).in('shelf_id', toRemove)
    if (res.error) throw res.error
  }
}

const entryColumns = (input: EntryInput) => ({
  read_on: input.readOn || null,
  depth: input.depth,
  comment: input.comment.trim() || null,
  rating: input.rating,
  visibility: input.isPublic ? 'public' : 'private',
})

export async function createEntry(db: SupabaseClient, userId: string, draft: PaperDraft, input: EntryInput): Promise<void> {
  const paperId = await ensurePaper(db, draft)
  const res = await db
    .from('entries')
    .insert({ user_id: userId, paper_id: paperId, status: 'done', ...entryColumns(input) })
    .select('id')
    .single()
  if (res.error) throw res.error
  try {
    await replaceShelves(db, res.data.id as string, input.shelfIds, [])
  } catch (e) {
    // 棚に入れられなかったときに、中途半端な記録を残さない
    await db.from('entries').delete().eq('id', res.data.id)
    throw e
  }
}

export async function updateEntry(db: SupabaseClient, entryId: string, input: EntryInput, currentShelfIds: string[]): Promise<void> {
  const res = await db.from('entries').update(entryColumns(input)).eq('id', entryId).select('id')
  if (res.error) throw res.error
  if (res.data.length === 0) throw new Error('記録が見つかりません')
  await replaceShelves(db, entryId, input.shelfIds, currentShelfIds)
}

export async function deleteEntry(db: SupabaseClient, entryId: string): Promise<void> {
  const res = await db.from('entries').delete().eq('id', entryId).select('id')
  if (res.error) throw res.error
  if (res.data.length === 0) throw new Error('記録が見つかりません')
}

export async function createShelf(db: SupabaseClient, userId: string, name: string, position: number): Promise<ShelfRow> {
  const res = await db
    .from('shelves')
    .insert({ user_id: userId, name, position })
    .select('id, name, visibility, position')
    .single<ShelfRow>()
  if (res.error) throw res.error
  return res.data
}

export async function setShelfVisibility(db: SupabaseClient, shelfId: string, visibility: ShelfRow['visibility']): Promise<void> {
  const res = await db.from('shelves').update({ visibility }).eq('id', shelfId).select('id')
  if (res.error) throw res.error
  if (res.data.length === 0) throw new Error('棚が見つかりません')
}

export async function deleteShelf(db: SupabaseClient, shelfId: string): Promise<void> {
  const res = await db.from('shelves').delete().eq('id', shelfId).select('id')
  if (res.error) throw res.error
  if (res.data.length === 0) throw new Error('棚が見つかりません')
}
