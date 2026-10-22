import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntryRow, ShelfLink, ShelfRow } from './records'

export interface PublicProfile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
}

export interface PublicView {
  profile: PublicProfile
  entries: EntryRow[]
  shelves: ShelfRow[]
  links: ShelfLink[]
}

/** 公開ページのアドレス(/u/ユーザー名)から、ユーザー名を取り出す。公開ページでなければ null */
export function parsePublicPath(pathname: string): string | null {
  return pathname.match(/^\/u\/([a-z0-9_]{3,20})\/?$/)?.[1] ?? null
}

export const publicPath = (username: string) => `/u/${username}`

/**
 * 公開してよいものだけを残す。
 * データベースの権限(RLS)でも絞られるが、本人が自分の公開ページを開いたときは、
 * 本人には非公開の記録も読めてしまうので、ここでも、公開のものだけに絞る。
 */
export function selectPublic(entries: EntryRow[], shelves: ShelfRow[], links: ShelfLink[]) {
  const publicEntries = entries.filter((e) => e.visibility === 'public' && e.status === 'done')
  const publicShelves = shelves.filter((s) => s.visibility === 'public')
  const entryIds = new Set(publicEntries.map((e) => e.id))
  const shelfIds = new Set(publicShelves.map((s) => s.id))
  return {
    entries: publicEntries,
    shelves: publicShelves,
    links: links.filter((l) => entryIds.has(l.entry_id) && shelfIds.has(l.shelf_id)),
  }
}

const PAPER_COLUMNS = 'id, doi, arxiv_id, title, authors, year, venue, url, field'

/** ユーザー名から、公開ページに出すものを取る。ユーザーがいなければ null */
export async function fetchPublicView(db: SupabaseClient, username: string): Promise<PublicView | null> {
  const profile = await db
    .from('profiles')
    .select('id, username, display_name, bio')
    .eq('username', username)
    .maybeSingle<PublicProfile>()
  if (profile.error) throw profile.error
  if (!profile.data) return null
  const userId = profile.data.id

  const [entries, shelves] = await Promise.all([
    db
      .from('entries')
      .select(`id, paper_id, status, read_on, depth, comment, rating, visibility, created_at, paper:papers(${PAPER_COLUMNS})`)
      .eq('user_id', userId)
      .eq('visibility', 'public')
      .order('read_on', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .returns<EntryRow[]>(),
    db
      .from('shelves')
      .select('id, name, visibility, position')
      .eq('user_id', userId)
      .eq('visibility', 'public')
      .order('position')
      .order('created_at')
      .returns<ShelfRow[]>(),
  ])
  if (entries.error) throw entries.error
  if (shelves.error) throw shelves.error

  let links: ShelfLink[] = []
  if (shelves.data.length > 0) {
    const res = await db
      .from('shelf_entries')
      .select('shelf_id, entry_id')
      .in(
        'shelf_id',
        shelves.data.map((s) => s.id),
      )
      .returns<ShelfLink[]>()
    if (res.error) throw res.error
    links = res.data
  }
  return { profile: profile.data, ...selectPublic(entries.data, shelves.data, links) }
}
