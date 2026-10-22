/**
 * ログインの途中で失敗すると、Supabase が、戻り先のアドレスに error と error_description を付ける。
 * それを、画面に出す文言に直す。
 */
export function authErrorMessage(search: string, hash: string): string | null {
  const params = new URLSearchParams(`${search.replace(/^\?/, '')}&${hash.replace(/^#/, '')}`)
  const error = params.get('error')
  if (!error) return null
  if (error === 'access_denied') return 'ログインを取りやめました。もう一度、お試しください。'
  return 'ログインできませんでした。時間をおいて、もう一度お試しください。続くときは、招待した人に知らせてください。'
}

/** 起動したときに 1 回だけ読み、アドレスから error の部分を消す(再読み込みで、また出ないように) */
export function takeAuthError(): string | null {
  const message = authErrorMessage(window.location.search, window.location.hash)
  if (message) window.history.replaceState(null, '', window.location.pathname)
  return message
}
