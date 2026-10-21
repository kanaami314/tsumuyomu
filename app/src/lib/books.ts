export type Field = 'ml' | 'ls' | 'ps' | 'li' | 'ne' | 'ed' | 'st' | 'ma'

export interface Book {
  title: string
  shortTitle: string
  authors: string
  year: number
  field: Field
  face?: boolean
}

export const FIELD_COLORS: Record<Field, string> = {
  ml: '#5F86A3',
  ls: '#7FA88B',
  ps: '#D2A64D',
  li: '#A57FA4',
  ne: '#CC8268',
  ed: '#D49A9A',
  st: '#5E9A98',
  ma: '#7C8FA0',
}

// M3 で本物の記録に置き換えるまでの、表示確認用の仮データ
export const SAMPLE_BOOKS: Book[] = [
  { title: 'Attention Is All You Need', shortTitle: 'Attention Is All You Need', authors: 'Vaswani ほか', year: 2017, field: 'ml', face: true },
  { title: 'The Spacing Effect in Learning', shortTitle: 'The Spacing Effect', authors: 'Cepeda ほか', year: 2006, field: 'ls' },
  { title: 'Habit formation in everyday life', shortTitle: 'Habit formation', authors: 'Lally ほか', year: 2010, field: 'ps', face: true },
  { title: 'Statistical learning by infants', shortTitle: 'Statistical learning', authors: 'Saffran ほか', year: 1996, field: 'li' },
  { title: 'Sleep and memory consolidation', shortTitle: 'Sleep and memory', authors: 'Diekelmann ほか', year: 2013, field: 'ne' },
  { title: 'Deep residual learning', shortTitle: 'Deep residual learning', authors: 'He ほか', year: 2016, field: 'ml' },
  { title: 'The Magical Number Seven', shortTitle: 'Magical Number Seven', authors: 'Miller', year: 1956, field: 'ps' },
  { title: 'Grit', shortTitle: 'Grit', authors: 'Duckworth ほか', year: 2007, field: 'ps' },
  { title: 'BERT', shortTitle: 'BERT', authors: 'Devlin ほか', year: 2019, field: 'ml' },
  { title: 'Testing effect and retention', shortTitle: 'Testing effect', authors: 'Roediger ほか', year: 2006, field: 'ed', face: true },
  { title: 'Flow', shortTitle: 'Flow', authors: 'Csikszentmihalyi', year: 1990, field: 'ps' },
  { title: 'Dropout', shortTitle: 'Dropout', authors: 'Srivastava ほか', year: 2014, field: 'ml' },
  { title: 'Adam', shortTitle: 'Adam', authors: 'Kingma ほか', year: 2015, field: 'ml' },
  { title: 'GAN', shortTitle: 'GAN', authors: 'Goodfellow ほか', year: 2014, field: 'ml' },
  { title: 'Prospect theory', shortTitle: 'Prospect theory', authors: 'Kahneman ほか', year: 1979, field: 'ps', face: true },
  { title: 'Self-determination theory', shortTitle: 'Self-determination', authors: 'Deci ほか', year: 2000, field: 'ed' },
  { title: 'Mastering the game of Go', shortTitle: 'Mastering Go', authors: 'Silver ほか', year: 2016, field: 'ml' },
  { title: 'Mirror neurons', shortTitle: 'Mirror neurons', authors: 'Rizzolatti ほか', year: 2004, field: 'ne' },
]

export interface Latest {
  count: number
  date: string
  book: Book
  comment: string[]
  rating: number
}

export const SAMPLE_LATEST: Latest = {
  count: 87,
  date: '10月20日',
  book: SAMPLE_BOOKS[0],
  comment: ['これが全部の始まりか、と思った。', '図が親切。'],
  rating: 5,
}

export const SAMPLE_COUNTS = { total: 87, month: 5, days: 52 }
