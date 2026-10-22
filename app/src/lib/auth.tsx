import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { takeAuthError } from './authError'
import { supabase } from './supabase'

export interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
}

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  /** ログインはしているが、プロフィールを確かめられなかった(通信の失敗など) */
  | { status: 'error' }
  | { status: 'needs-invite'; session: Session }
  | { status: 'ready'; session: Session; profile: Profile }

interface AuthContextValue {
  state: AuthState
  /** ログイン前の画面に出す知らせ(ログインの途中で失敗したときなど) */
  notice: string | null
  /** 失敗したら、画面に出す文言を返す(成功すると、Google の画面に移る) */
  signInWithGoogle: () => Promise<string | null>
  retry: () => Promise<void>
  signOut: () => Promise<void>
  /** 招待コードとユーザー名でプロフィールを作る。失敗したら、画面に出す文言を返す */
  claimInvite: (code: string, username: string) => Promise<string | null>
  /** 表示名と自己紹介を直す。失敗したら、画面に出す文言を返す */
  updateProfile: (displayName: string, bio: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const INVITE_ERRORS: Record<string, string> = {
  invalid_invite: '招待コードが正しくないか、使えなくなっています。',
  invalid_username: 'ユーザー名は、英小文字・数字・_ の 3〜20 文字にしてください。',
  username_taken: 'そのユーザー名はすでに使われています。',
  already_registered: 'すでに登録されています。',
  not_signed_in: 'ログインし直してください。',
}

export function toInviteMessage(error: { message: string }): string {
  const key = Object.keys(INVITE_ERRORS).find((k) => error.message.includes(k))
  return key ? INVITE_ERRORS[key] : '登録できませんでした。時間をおいて、もう一度お試しください。'
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [notice] = useState(takeAuthError)

  const resolve = useCallback(async (session: Session | null) => {
    if (!session) {
      setState({ status: 'signed-out' })
      return
    }
    try {
      const profile = await fetchProfile(session.user.id)
      setState(profile ? { status: 'ready', session, profile } : { status: 'needs-invite', session })
    } catch {
      // 登録済みの人を、誤って招待の画面に送らないよう、確かめられなかったことを、そのまま伝える
      setState({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    client.auth
      .getSession()
      .then(({ data }) => resolve(data.session))
      .catch(() => setState({ status: 'error' }))
    // コールバックの中で、すぐに別の問い合わせをしないよう、setTimeout で逃がす(supabase-js の注意点)
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => resolve(session), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [resolve])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      notice,
      signInWithGoogle: async () => {
        const result = await supabase?.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
            // 前に選んだアカウントで、自動的に入らない(複数のアカウントを使い分けられるように)
            queryParams: { prompt: 'select_account' },
          },
        })
        return result?.error ? 'ログインを始められませんでした。通信を確かめて、もう一度お試しください。' : null
      },
      retry: async () => {
        if (!supabase) return
        setState({ status: 'loading' })
        try {
          const { data } = await supabase.auth.getSession()
          await resolve(data.session)
        } catch {
          setState({ status: 'error' })
        }
      },
      signOut: async () => {
        await supabase?.auth.signOut()
      },
      claimInvite: async (code, username) => {
        if (!supabase || state.status !== 'needs-invite') return 'ログインし直してください。'
        const { error } = await supabase.rpc('claim_invite', { p_code: code, p_username: username })
        if (error) return toInviteMessage(error)
        await resolve(state.session)
        return null
      },
      updateProfile: async (displayName, bio) => {
        if (!supabase || state.status !== 'ready') return 'ログインし直してください。'
        const { data, error } = await supabase
          .from('profiles')
          .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
          .eq('id', state.profile.id)
          .select('id, username, display_name, bio')
          .single<Profile>()
        if (error) return '保存できませんでした。通信を確かめて、もう一度お試しください。'
        setState({ status: 'ready', session: state.session, profile: data })
        return null
      },
    }),
    [state, notice, resolve],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** ログインの仕組みがない(見た目確認用の)画面でも使えるよう、なければ null を返す */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider の中で使ってください')
  return ctx
}
