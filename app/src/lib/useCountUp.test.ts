import { describe, expect, it } from 'vitest'
import { easeOutCubic, interpolate } from './useCountUp'

describe('interpolate', () => {
  it('始まりは元の値、終わりは目標の値になる', () => {
    expect(interpolate(0, 87, 0)).toBe(0)
    expect(interpolate(0, 87, 1)).toBe(87)
    expect(interpolate(10, 3, 1)).toBe(3)
  })

  it('途中は、始まりと終わりの間で、単調に変わる', () => {
    const values = [0, 0.2, 0.4, 0.6, 0.8, 1].map((p) => interpolate(0, 100, p))
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(values[1]).toBeGreaterThan(0)
    expect(values[4]).toBeLessThan(100)
  })

  it('進み具合が範囲の外でも、はみ出さない', () => {
    expect(interpolate(0, 50, -1)).toBe(0)
    expect(interpolate(0, 50, 2)).toBe(50)
  })

  it('最初は速く、終わりに向けて、ゆっくりになる', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })
})
