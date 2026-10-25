import { describe, expect, test } from 'vitest'
import { FIELDS } from '../books'
import { DEMO_PAPERS, demoRecommendations, demoSearch, diversify } from './demo'
import { defaultInterests } from './fields'
import { needsTranslation, validateExplanation } from './translation'
import { unique } from './types'

// 論文サーチャーの tests/core.test.mjs を移したもの

describe('デモ', () => {
  test('おすすめは、関心の 4 件と、発見の 1 件', () => {
    for (const fields of [['ml'], ['ps'], ['st'], ['ma'], ['ml', 'ne']] as const)
      for (let offset = 0; offset < 4; offset++) {
        const p = demoRecommendations([...fields], offset)
        expect(p).toHaveLength(5)
        expect(p.filter((x) => x.discovery)).toHaveLength(1)
        expect(new Set(p.map((x) => x.id)).size).toBe(5)
      }
    for (const field of FIELDS) expect(demoRecommendations([field])).toHaveLength(5)
    expect(demoRecommendations([...FIELDS])).toHaveLength(5)
  })

  test('「自動運転 画像認識」で、重ならない 10 件', () => {
    const r = demoSearch('自動運転 画像認識')
    expect(r).toHaveLength(10)
    expect(r.some((x) => x.topic === '自動運転')).toBe(true)
    expect(new Set(r.map((x) => x.id)).size).toBe(10)
  })

  test('当てはまらなければ、無関係な論文で埋めない', () => {
    expect(demoSearch('zzzzzznotfound')).toHaveLength(0)
  })

  test('類似は、複数の観点を混ぜ、元の論文と経路を除く', () => {
    const a = DEMO_PAPERS.find((p) => p.id === '2203.17270')!
    const r = diversify(a, DEMO_PAPERS, ['1706.03762'])
    expect(r.length).toBeGreaterThanOrEqual(6)
    expect(r.length).toBeLessThanOrEqual(10)
    expect(new Set(r.map((x) => x.relation)).size).toBeGreaterThanOrEqual(3)
    expect(r.some((x) => x.id === a.id || x.id === '1706.03762')).toBe(false)
  })
})

test('DOI が同じものは、1 つにまとめる', () => {
  expect(unique([{ id: '1', doi: 'x' }, { id: '2', doi: 'x' }])).toHaveLength(1)
})

test('日本語説明: ID の違い・英語だけのものを捨て、欠けた補助項目は「確認できません」にする', () => {
  const p = { id: 'x', abstract: 'A real abstract' }
  expect(validateExplanation(p, { id: 'wrong', ja: '日本語', summary: '説明です' })).toBeNull()
  expect(validateExplanation(p, { id: 'x', ja: '日本語', summary: 'English only' })).toBeNull()
  expect(validateExplanation(p, { id: 'x', ja: '日本語', summary: '説明です' })?.methodExplanation).toBe('抄録からは確認できません。')
  expect(needsTranslation({ id: 'y', title: 'T', demo: false })).toBe(true)
  expect(needsTranslation({ id: 'y', title: 'T', demo: true })).toBe(false)
})

test('関心分野の初期値は、記録の多い分野から', () => {
  expect(defaultInterests([])).toEqual(['ml'])
  expect(defaultInterests(['ps', 'ed', 'ps', null, 'ne', 'ed', 'ps'])).toEqual(['ps', 'ed'])
})
