import type { Book } from './books'
import { FIELD_COLORS } from './books'

export interface Spine {
  kind: 'spine' | 'face'
  width: number
  /** 隣との隙間を含めた、棚の上で使う幅 */
  slot: number
  height: number
  background: string
  color: string
  ribbon: string
  book: Book
}

// 同じ並びなら同じ見た目になるよう、番号から決まる値を使う
function hash(i: number): number {
  return ((i * 2654435761) >>> 0) % 1000
}

function shade(hex: string, p: number): string {
  const n = parseInt(hex.slice(1), 16)
  const channel = (c: number) =>
    Math.max(0, Math.min(255, Math.round(p > 0 ? c + (255 - c) * p : c * (1 + p))))
  const part = (c: number) => channel(c).toString(16).padStart(2, '0')
  return `#${part(n >> 16)}${part((n >> 8) & 255)}${part(n & 255)}`
}

function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const luma = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return luma > 150 ? '#2A2418' : '#fff'
}

export function buildSpine(book: Book, i: number): Spine {
  const base = FIELD_COLORS[book.field]
  const h = hash(i)
  const background = shade(base, ((h % 9) - 4) * 0.03)
  const common = { background, color: inkFor(background), ribbon: shade(base, -0.38), book }
  if (book.face) {
    return { kind: 'face', width: 98, slot: 108, height: 148, ...common }
  }
  const width = 24 + (h % 13)
  return { kind: 'spine', width, slot: width + 2, height: 124 + (h % 5) * 8, ...common }
}

// 棚の幅に収まるように、段へ分ける
export function layoutRows(spines: Spine[], available: number): Spine[][] {
  const rows: Spine[][] = []
  let current: Spine[] = []
  let used = 0
  for (const s of spines) {
    if (used + s.slot > available && current.length) {
      rows.push(current)
      current = []
      used = 0
    }
    current.push(s)
    used += s.slot
  }
  if (current.length) rows.push(current)
  return rows
}
