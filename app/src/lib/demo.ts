import type { Field } from './books'
import type { EntryRow, Snapshot } from './records'

// 接続情報(Supabase)がない間の、見た目確認用のデータ。保存はできない。
const SAMPLES: [string, string, number, Field, boolean][] = [
  ['Attention Is All You Need', 'Vaswani', 2017, 'ml', true],
  ['The Spacing Effect in Learning', 'Cepeda', 2006, 'ls', false],
  ['Habit formation in everyday life', 'Lally', 2010, 'ps', true],
  ['Statistical learning by infants', 'Saffran', 1996, 'li', false],
  ['Sleep and memory consolidation', 'Diekelmann', 2013, 'ne', false],
  ['Deep residual learning', 'He', 2016, 'ml', false],
  ['The Magical Number Seven', 'Miller', 1956, 'ps', false],
  ['Grit', 'Duckworth', 2007, 'ps', false],
  ['BERT', 'Devlin', 2019, 'ml', false],
  ['Testing effect and retention', 'Roediger', 2006, 'ed', true],
  ['Flow', 'Csikszentmihalyi', 1990, 'ps', false],
  ['Dropout', 'Srivastava', 2014, 'ml', false],
  ['Adam', 'Kingma', 2015, 'ml', false],
  ['GAN', 'Goodfellow', 2014, 'ml', false],
  ['Prospect theory', 'Kahneman', 1979, 'ps', true],
  ['Self-determination theory', 'Deci', 2000, 'ed', false],
  ['Mastering the game of Go', 'Silver', 2016, 'ml', false],
  ['Mirror neurons', 'Rizzolatti', 2004, 'ne', false],
]

export function demoSnapshot(): Snapshot {
  const entries: EntryRow[] = SAMPLES.map(([title, family, year, field, cover], i) => ({
    id: `demo-${i}`,
    paper_id: `demo-paper-${i}`,
    status: 'done',
    read_on: `2026-10-${String(20 - Math.floor(i / 2)).padStart(2, '0')}`,
    depth: 'deep',
    comment: i === 0 ? 'これが全部の始まりか、と思った。\n図が親切。' : null,
    rating: cover ? 5 : 3,
    visibility: 'private',
    created_at: `2026-10-20T00:${String(59 - i).padStart(2, '0')}:00Z`,
    paper: {
      id: `demo-paper-${i}`,
      doi: null,
      arxiv_id: null,
      title,
      authors: [`${family}, A.`, 'Others, B.'],
      year,
      venue: null,
      url: null,
      field,
    },
  }))
  return { entries, shelves: [], links: [] }
}
