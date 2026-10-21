import { describe, expect, it } from 'vitest'
import { authorLabel, classifyField, fromCsl, lookupPaper, normalizeIdentifier, shortTitle } from './biblio'

describe('normalizeIdentifier', () => {
  it('DOI をそのまま受け取り、小文字にする', () => {
    expect(normalizeIdentifier('10.1038/NATURE14539')).toEqual({ doi: '10.1038/nature14539', arxivId: null })
  })

  it('doi.org の URL や doi: の接頭辞、末尾の句読点を取り除く', () => {
    const want = { doi: '10.1038/nature14539', arxivId: null }
    expect(normalizeIdentifier('https://doi.org/10.1038/nature14539')).toEqual(want)
    expect(normalizeIdentifier('http://dx.doi.org/10.1038/nature14539')).toEqual(want)
    expect(normalizeIdentifier('doi: 10.1038/nature14539.')).toEqual(want)
    expect(normalizeIdentifier('  10.1038/nature14539  ')).toEqual(want)
  })

  it('arXiv の ID と URL を、arXiv の DOI にする(版の番号は落とす)', () => {
    const want = { doi: '10.48550/arxiv.1706.03762', arxivId: '1706.03762' }
    expect(normalizeIdentifier('1706.03762')).toEqual(want)
    expect(normalizeIdentifier('arXiv:1706.03762v5')).toEqual(want)
    expect(normalizeIdentifier('https://arxiv.org/abs/1706.03762v7')).toEqual(want)
    expect(normalizeIdentifier('https://arxiv.org/pdf/1706.03762.pdf')).toEqual(want)
  })

  it('旧形式の arXiv ID も扱う', () => {
    expect(normalizeIdentifier('hep-th/9901001')).toEqual({ doi: '10.48550/arxiv.hep-th/9901001', arxivId: 'hep-th/9901001' })
  })

  it('arXiv の DOI からも arXiv の ID を取り出す', () => {
    expect(normalizeIdentifier('10.48550/arXiv.1706.03762')?.arxivId).toBe('1706.03762')
  })

  it('DOI でも arXiv でもないものは null', () => {
    expect(normalizeIdentifier('')).toBeNull()
    expect(normalizeIdentifier('hello')).toBeNull()
    expect(normalizeIdentifier('https://example.com/paper')).toBeNull()
    expect(normalizeIdentifier('10.1/short')).toBeNull()
  })
})

describe('fromCsl', () => {
  it('Crossref の形を読む', () => {
    const draft = fromCsl(
      {
        title: 'Deep learning',
        author: [
          { family: 'LeCun', given: 'Yann' },
          { family: 'Bengio', given: 'Yoshua' },
        ],
        issued: { 'date-parts': [[2015, 5, 27]] },
        'container-title': 'Nature',
        URL: 'https://doi.org/10.1038/nature14539',
      },
      '10.1038/nature14539',
    )
    expect(draft).toMatchObject({
      title: 'Deep learning',
      authors: ['LeCun, Yann', 'Bengio, Yoshua'],
      year: 2015,
      venue: 'Nature',
      arxivId: null,
      field: 'ml',
    })
  })

  it('DataCite(arXiv)の形を読み、掲載誌がなければ arXiv にする', () => {
    const draft = fromCsl(
      {
        title: 'Attention Is All You Need',
        author: [{ family: 'Vaswani', given: 'Ashish' }],
        issued: { 'date-parts': [[2017]] },
        categories: ['Machine Learning (cs.LG)'],
      },
      '10.48550/arxiv.1706.03762',
    )
    expect(draft.venue).toBe('arXiv')
    expect(draft.arxivId).toBe('1706.03762')
    expect(draft.year).toBe(2017)
    expect(draft.field).toBe('ml')
  })

  it('団体名や、年のないものも落ちない', () => {
    const draft = fromCsl({ title: ['憲法調査会総会議事録'], author: [{ given: '憲法調査会' }] }, '10.11501/3048327')
    expect(draft.authors).toEqual(['憲法調査会'])
    expect(draft.year).toBeNull()
    expect(draft.url).toBe('https://doi.org/10.11501/3048327')
  })
})

describe('classifyField', () => {
  it('件名から分野を決める', () => {
    expect(classifyField('Sleep and memory consolidation')).toBe('ne')
    expect(classifyField('Habit formation in everyday life')).toBe('ps')
    expect(classifyField('The Spacing Effect in Learning')).toBe('ls')
    expect(classifyField('Quantum field theory')).toBeNull()
  })
})

describe('lookupPaper', () => {
  const id = { doi: '10.1038/nature14539', arxivId: null }
  const response = (status: number, body: unknown) =>
    (() => Promise.resolve(new Response(JSON.stringify(body), { status }))) as typeof fetch

  it('取得できたら下書きを返す', async () => {
    const draft = await lookupPaper(id, response(200, { title: 'Deep learning', issued: { 'date-parts': [[2015]] } }))
    expect(draft.title).toBe('Deep learning')
  })

  it('404 は not_found', async () => {
    await expect(lookupPaper(id, response(404, {}))).rejects.toMatchObject({ reason: 'not_found' })
  })

  it('通信できない(CORS を含む)ときは unavailable', async () => {
    const failing = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch
    await expect(lookupPaper(id, failing)).rejects.toMatchObject({ reason: 'unavailable' })
  })

  it('題名のない応答は unavailable', async () => {
    await expect(lookupPaper(id, response(200, {}))).rejects.toMatchObject({ reason: 'unavailable' })
  })
})

describe('shortTitle / authorLabel', () => {
  it('副題を落とし、長い題名を省略する', () => {
    expect(shortTitle('Attention Is All You Need')).toBe('Attention Is All Yo…')
    expect(shortTitle('Deep learning')).toBe('Deep learning')
    expect(shortTitle('12345678901234567890')).toBe('12345678901234567890')
    expect(shortTitle('BERT: Pre-training of Deep Bidirectional Transformers')).toBe('BERT')
    expect(shortTitle('A very long title that goes on and on and on')).toBe('A very long title t…')
    expect(shortTitle('日本語の長い題名がここに入ります。とても長い題名です。')).toBe('日本語の長い題名が…')
    expect(shortTitle('短い題名')).toBe('短い題名')
  })

  it('筆頭著者の姓と「ほか」を作る', () => {
    expect(authorLabel(['LeCun, Yann', 'Bengio, Yoshua'])).toBe('LeCun ほか')
    expect(authorLabel(['Miller, George'])).toBe('Miller')
    expect(authorLabel([])).toBe('')
  })
})
