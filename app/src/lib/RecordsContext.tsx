import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PaperDraft } from './biblio'
import { useOptionalAuth } from './auth'
import { demoSnapshot } from './demo'
import * as api from './records'
import type { EntryInput, EntryRow, ShelfRow, Snapshot } from './records'
import { supabase } from './supabase'

interface RecordsContextValue {
  status: 'loading' | 'ready' | 'error'
  /** 接続情報がなく、見た目確認用のデータを出しているとき */
  demo: boolean
  entries: EntryRow[]
  shelves: ShelfRow[]
  shelfIdsOf: (entryId: string) => string[]
  /** 失敗したら、画面に出す文言を返す。成功したら null */
  addEntry: (draft: PaperDraft, input: EntryInput) => Promise<string | null>
  editEntry: (entryId: string, input: EntryInput) => Promise<string | null>
  removeEntry: (entryId: string) => Promise<string | null>
  addShelf: (name: string) => Promise<ShelfRow | null>
  reload: () => Promise<void>
}

const RecordsContext = createContext<RecordsContextValue | null>(null)

const EMPTY: Snapshot = { entries: [], shelves: [], links: [] }
const DEMO_MESSAGE = 'いまは見た目の確認用の画面なので、保存できません。'

export function RecordsProvider({ children }: { children: ReactNode }) {
  const state = useOptionalAuth()?.state
  const userId = state?.status === 'ready' ? state.profile.id : null
  const demo = !supabase
  const [snapshot, setSnapshot] = useState<Snapshot>(demo ? demoSnapshot() : EMPTY)
  const [status, setStatus] = useState<RecordsContextValue['status']>(demo ? 'ready' : 'loading')

  const reload = useCallback(async () => {
    if (!supabase || !userId) return
    try {
      setSnapshot(await api.fetchSnapshot(supabase, userId))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo<RecordsContextValue>(() => {
    const run = async (task: (db: NonNullable<typeof supabase>, uid: string) => Promise<void>, failure: string) => {
      if (!supabase || !userId) return DEMO_MESSAGE
      try {
        await task(supabase, userId)
        await reload()
        return null
      } catch {
        return failure
      }
    }
    return {
      status,
      demo,
      entries: snapshot.entries,
      shelves: snapshot.shelves,
      shelfIdsOf: (entryId) => snapshot.links.filter((l) => l.entry_id === entryId).map((l) => l.shelf_id),
      addEntry: (draft, input) => run((db, uid) => api.createEntry(db, uid, draft, input), '保存できませんでした。通信を確かめて、もう一度お試しください。'),
      editEntry: (entryId, input) =>
        run(
          (db) => api.updateEntry(db, entryId, input, snapshot.links.filter((l) => l.entry_id === entryId).map((l) => l.shelf_id)),
          '更新できませんでした。通信を確かめて、もう一度お試しください。',
        ),
      removeEntry: (entryId) => run((db) => api.deleteEntry(db, entryId), '削除できませんでした。通信を確かめて、もう一度お試しください。'),
      addShelf: async (name) => {
        if (!supabase || !userId) return null
        try {
          const shelf = await api.createShelf(supabase, userId, name, snapshot.shelves.length)
          setSnapshot((s) => ({ ...s, shelves: [...s.shelves, shelf] }))
          return shelf
        } catch {
          return null
        }
      },
      reload,
    }
  }, [status, demo, snapshot, userId, reload])

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>
}

export function useRecords(): RecordsContextValue {
  const ctx = useContext(RecordsContext)
  if (!ctx) throw new Error('RecordsProvider の中で使ってください')
  return ctx
}
