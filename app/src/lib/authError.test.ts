import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './authError'

describe('authErrorMessage', () => {
  it('エラーがなければ null', () => {
    expect(authErrorMessage('', '')).toBeNull()
    expect(authErrorMessage('?foo=1', '#bar=2')).toBeNull()
  })

  it('取りやめた(access_denied)ときは、そう伝える', () => {
    expect(authErrorMessage('?error=access_denied&error_description=x', '')).toContain('取りやめ')
  })

  it('アドレスの ? の側にも、# の側にも対応する', () => {
    expect(authErrorMessage('?error=server_error', '')).toContain('ログインできませんでした')
    expect(authErrorMessage('', '#error=server_error&error_description=Database+error')).toContain('ログインできませんでした')
  })
})
