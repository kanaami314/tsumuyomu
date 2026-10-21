import { createClient } from '@supabase/supabase-js'

// 画面に入れてよいのは、公開用のキー(anon / publishable)だけ。service_role キーは、ここにも .env にも置かない。
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key ? createClient(url, key) : null
