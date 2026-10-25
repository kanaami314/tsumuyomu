import type { Field } from '../books'
import { unique, type SearchPaper } from './types'

// 見た目の確認用(Supabase の接続情報がないとき)のデモ。論文サーチャーに同梱していた、実在の論文 29 本。
// 紹介文は編集済み。最新・流行のランキングではない。外部とは通信しない。

/** デモの内部の分野 */
export const DEMO_FIELD_NAMES: Record<string, string> = {
  ai: 'AI・画像認識',
  robot: 'ロボティクス',
  bio: '生命・医療',
  energy: '環境・エネルギー',
  space: '宇宙・物理',
}

// デモの論文は、AI・ロボティクスが中心なので、つむよむの分野を、近いものに寄せる
const DEMO_FIELDS_OF: Record<Field, string[]> = {
  ml: ['ai', 'robot'],
  ls: ['ai'],
  ps: ['bio'],
  li: ['ai'],
  ne: ['bio'],
  ed: ['robot'],
  st: ['energy'],
  ma: ['space'],
}

type Row = [string, string, string, string, string, string, string, string, string]

const ROWS: Row[] = [
  ['1602.03837', 'Observation of Gravitational Waves from a Binary Black Hole Merger', 'ブラックホールの合体が、時空に残した信号', '干渉計で得られた信号を分析し、ブラックホール連星の合体による重力波の観測を報告した研究です。', 'space', '2016', 'signal analysis', '重力波', '観測'],
  ['1207.7214', 'Observation of a new particle in the search for the Standard Model Higgs boson with the ATLAS detector at the LHC', '粒子衝突のデータから、新しい粒子を探す', 'ATLAS実験における新粒子の観測を報告。膨大な衝突データから信号を選び出す測定と統計の研究に触れられます。', 'space', '2012', 'statistical analysis', '素粒子', '観測'],
  ['1807.06209', 'Planck 2018 results. VI. Cosmological parameters', '宇宙に残る光から、宇宙の姿を推定する', '宇宙マイクロ波背景放射の観測をもとに、宇宙論のパラメーターを推定します。観測とモデルを結びつける研究です。', 'space', '2018', 'statistical analysis', '宇宙論', '観測'],
  ['1706.03762', 'Attention Is All You Need', '「注意」の仕組みで、言葉の関係を捉える', '再帰や畳み込みを使わず、注意機構を中心に据えたTransformerを提案。文章のどの部分を参照するかを学習する考え方です。', 'ai', '2017', 'attention', '言語理解', '翻訳'],
  ['2010.11929', 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale', '画像を小さな断片に分けて読む', '画像をパッチの列としてTransformerへ入力するVision Transformerを提案。言語で使われた手法が、画像認識につながる例です。', 'ai', '2020', 'attention', '画像認識', '画像分類'],
  ['1512.03385', 'Deep Residual Learning for Image Recognition', '深いモデルを学習するための「近道」', '入力を先へ足し合わせる残差接続によって、深い画像認識モデルの学習を扱います。深さを増す際の最適化の難しさが出発点です。', 'ai', '2015', 'neural network', '画像認識', '画像分類'],
  ['1506.02640', 'You Only Look Once: Unified, Real-Time Object Detection', '物体の位置と種類を、一度に見つける', '物体検出を単一のネットワークによる予測として扱うYOLOを提案。認識の精度と処理速度を両立するための設計に触れられます。', 'ai', '2015', 'detection', '物体認識', '速度'],
  ['2005.12872', 'End-to-End Object Detection with Transformers', '物体検出を、集合の予測として考える', 'Transformerと集合に対する損失を使ったDETRを提案。従来の物体検出の処理をどこまで簡潔にできるかを探ります。', 'ai', '2020', 'attention', '物体認識', '検出'],
  ['2304.02643', 'Segment Anything', '画像の「ここ」を切り分ける汎用モデル', 'プロンプトで対象を指定できるセグメンテーションモデルとデータセットを提示。さまざまな画像の領域を切り分ける方法を扱います。', 'ai', '2023', 'segmentation', '画像認識', '汎用化'],
  ['2103.00020', 'Learning Transferable Visual Models From Natural Language Supervision', '画像と言葉を、共通の表現へ', '画像とテキストの組を使って表現を学習するCLIPを提案。自然言語で指定した概念と画像を対応させる方法を探ります。', 'ai', '2021', 'contrastive learning', '画像認識', '汎用化'],
  ['1604.07316', 'End to End Learning for Self-Driving Cars', 'カメラの画像から、車の操舵を学ぶ', 'カメラ画像を入力し操舵を出力するニューラルネットワークを扱います。自動運転の認識と制御を一体で学ぶアプローチです。', 'robot', '2016', 'neural network', '自動運転', '操舵'],
  ['1903.11027', 'nuScenes: A Multimodal Dataset for Autonomous Driving', '自動運転を、複数のセンサーで捉える', 'カメラやLiDARなどを含む自動運転向けデータセットを紹介。異なるセンサーの情報を組み合わせて評価する基盤です。', 'robot', '2019', 'sensor fusion', '自動運転', 'データセット'],
  ['2203.17270', 'BEVFormer: Learning Bird’s-Eye-View Representation from Multi-Camera Images via Spatiotemporal Transformers', '複数のカメラから、見下ろした地図をつくる', '車載カメラの画像から鳥瞰図の表現を学習します。空間と時間の注意機構を使い、3次元認識へつなげる研究です。', 'robot', '2022', 'attention', '自動運転', '3次元認識'],
  ['2212.01593', 'Planning-oriented Autonomous Driving', '認識の先にある「どう走るか」まで考える', '知覚・予測・計画を統合したUniADを提案。各処理を独立に最適化するだけでなく、運転計画を中心に構成します。', 'robot', '2022', 'attention', '自動運転', '計画'],
  ['1812.05784', 'PointPillars: Fast Encoders for Object Detection from Point Clouds', '点群を柱にまとめて、物体をすばやく捉える', 'LiDARの点群を柱状に整理する表現を提案。自動運転に関わる3次元物体検出の効率を考える研究です。', 'robot', '2018', 'detection', '自動運転', '速度'],
  ['2112.11950', 'BEVDet: High-performance Multi-camera 3D Object Detection in Bird-Eye-View', 'カメラだけで、周囲の物体を3次元に捉える', '複数カメラの情報を鳥瞰表現へ変換して3次元物体を検出する枠組みを扱います。画像と空間表現のつながりが焦点です。', 'robot', '2021', 'detection', '自動運転', '3次元認識'],
  ['2307.15818', 'RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control', '画像と言葉の知識を、ロボットの動作へ', '視覚と言語のモデルをロボットの行動へ接続するRT-2を提案。ウェブで学んだ知識を実世界の操作に生かす方向を探ります。', 'robot', '2023', 'attention', 'ロボット操作', '汎用化'],
  ['1505.04597', 'U-Net: Convolutional Networks for Biomedical Image Segmentation', '医療画像の境界を、少ないデータから学ぶ', '画像の文脈と位置情報を組み合わせるU-Netを提案。生体画像のセグメンテーションを扱う、画像認識の別分野への入口です。', 'bio', '2015', 'segmentation', '医療画像', '検出'],
  ['1711.05225', 'CheXNet: Radiologist-Level Pneumonia Detection on Chest X-Rays with Deep Learning', '胸部X線から肺炎の手がかりを探す', '胸部X線画像を用いた肺炎検出のモデルと評価を報告。データセット上の評価と臨床での利用は分けて理解する必要があります。', 'bio', '2017', 'neural network', '医療画像', '画像分類'],
  ['2102.04306', 'TransUNet: Transformers Make Strong Encoders for Medical Image Segmentation', '医療画像にも、注意機構の視点を取り入れる', 'TransformerとU-Netの構成を組み合わせた医療画像セグメンテーションを扱います。大域的な関係と細かな位置情報の両立を目指します。', 'bio', '2021', 'attention', '医療画像', '検出'],
  ['2304.12306', 'Segment Anything in Medical Images', '汎用の画像モデルを、医療画像に適応する', '汎用セグメンテーションを医療画像へ適応させるMedSAMを扱います。領域が変わったときに必要な学習を考える入口です。', 'bio', '2023', 'segmentation', '医療画像', '汎用化'],
  ['1906.05433', 'Tackling Climate Change with Machine Learning', '機械学習は、気候変動にどこで役立つか', 'エネルギーや交通など幅広い領域での機械学習の活用可能性を整理。単一の実験結果ではなく、課題と研究機会を見渡す論文です。', 'energy', '2019', 'machine learning', '気候変動', '応用調査'],
  ['2212.12794', 'GraphCast: Learning skillful medium-range global weather forecasting', '地球の天気を、グラフで予測する', 'グラフニューラルネットワークを用いた全球の中期天気予報を扱います。学習した時空間の関係が予測にどう役立つかを探ります。', 'energy', '2022', 'graph network', '天気予報', '予測'],
  ['2211.02556', 'Pangu-Weather: A 3D High-Resolution Model for Fast and Accurate Global Weather Forecast', '立体的な大気の情報を、天気予報へ', '3次元の大気情報を扱う深層学習モデルによる全球予報を提案。予報の精度と計算効率を考える研究です。', 'energy', '2022', 'attention', '天気予報', '予測'],
  ['2202.11214', 'FourCastNet: A Global Data-driven High-resolution Weather Model using Adaptive Fourier Neural Operators', '波の表現を使って、大気の変化を予測する', 'フーリエ領域の演算を利用する全球気象モデルを提示。物理場の予測に適したニューラルネットワークの構成を扱います。', 'energy', '2022', 'neural operator', '天気予報', '速度'],
  ['2002.09405', 'Learning to Simulate Complex Physics with Graph Networks', '粒子のつながりから、物理の動きを学ぶ', 'グラフネットワークを使って粒子ベースの物理シミュレーションを学びます。関係を表す手法が物理現象の予測にもつながります。', 'space', '2020', 'graph network', '物理シミュレーション', '予測'],
  ['2010.08895', 'Fourier Neural Operator for Parametric Partial Differential Equations', '方程式の解き方を、データから学ぶ', '関数間の写像をフーリエ領域で学ぶ手法を提案。個別の数値だけでなく、物理場を予測する作用素を学習する考え方です。', 'space', '2020', 'neural operator', '物理シミュレーション', '速度'],
  ['2003.08934', 'NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis', '数枚の写真から、新しい視点を描く', '連続的なニューラル表現で場面を表し、未知の視点からの画像を合成します。画像認識とは違う角度から3次元表現に触れられます。', 'ai', '2020', 'neural network', '3次元表現', '画像生成'],
  ['2308.04079', '3D Gaussian Splatting for Real-Time Radiance Field Rendering', '3次元の小さな分布で、場面を描き直す', '3次元ガウス分布を用いて場面を表現し、リアルタイムの描画を目指します。3次元再構成と速度の両立がテーマです。', 'ai', '2023', 'rendering', '3次元表現', '速度'],
]

export const DEMO_PAPERS: SearchPaper[] = ROWS.map(([id, title, ja, summary, field, year, method, topic, challenge]) => ({
  id,
  title,
  ja,
  summary,
  field,
  year,
  method,
  topic,
  challenge,
  date: year,
  url: `https://arxiv.org/abs/${id}`,
  source: 'arXiv',
  demo: true,
  authors: '著者・原文は出典で確認',
  abstract: '',
}))

export function demoSearch(query: string): SearchPaper[] {
  const keys = query.toLowerCase().split(/[\s　]+/).filter(Boolean)
  return DEMO_PAPERS.map((p) => {
    const text = `${p.title} ${p.ja} ${p.summary} ${p.topic} ${p.method} ${DEMO_FIELD_NAMES[p.field ?? '']}`.toLowerCase()
    return { paper: p, score: keys.reduce((n, k) => n + (text.includes(k) ? 3 : 0), 0) }
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => x.paper)
}

const DIMENSIONS: [keyof SearchPaper, string][] = [
  ['topic', '対象が近い'],
  ['method', '手法が近い'],
  ['challenge', '課題が近い'],
  ['field', '分野が近い'],
]

/** 対象・手法・課題・分野の観点を混ぜて、最大 10 件。少なくても、無関係な論文では埋めない */
export function diversify(anchor: SearchPaper, candidates: SearchPaper[], excluded: string[] = []): SearchPaper[] {
  const pool = unique(candidates).filter((p) => p.id !== anchor.id && !excluded.includes(p.id))
  const selected: SearchPaper[] = []
  const used = new Set<string>()
  for (let round = 0; round < 3; round++) {
    for (const [key, label] of DIMENSIONS) {
      const p = pool.find((p) => !used.has(p.id) && anchor[key] && p[key] === anchor[key])
      if (p && selected.length < 10) {
        used.add(p.id)
        const shared = key === 'field' ? DEMO_FIELD_NAMES[p.field ?? ''] ?? p.field : String(p[key])
        selected.push({ ...p, relation: label, reason: `共通点:${shared}` })
      }
    }
  }
  return selected
}

const rotate = <T,>(a: T[], n: number): T[] => (a.length ? [...a.slice(n % a.length), ...a.slice(0, n % a.length)] : [])

/** 関心に近い 4 件と、視野を広げる 1 件 */
export function demoRecommendations(fields: Field[], offset = 0, history: string[] = []): SearchPaper[] {
  const active = new Set((fields.length ? fields : (['ml'] as Field[])).flatMap((f) => DEMO_FIELDS_OF[f]))
  const near = DEMO_PAPERS.filter((p) => active.has(p.field ?? ''))
  if (history.length) near.sort((a, b) => Number(history.includes(b.topic ?? '')) - Number(history.includes(a.topic ?? '')))
  const main = rotate(near, offset * 4)
    .slice(0, 4)
    .map((p) => ({ ...p, relation: '関心に近い', reason: '選んだ分野から' }))
  let far = DEMO_PAPERS.filter((p) => !active.has(p.field ?? ''))
  if (!far.length) far = DEMO_PAPERS.filter((p) => !main.some((m) => m.id === p.id))
  const linked = far.filter((p) => main.some((m) => m.method === p.method))
  const useLinked = offset % 2 === 0 && linked.length > 0
  const discovery = rotate(useLinked ? linked : far, offset)[0]
  return [
    ...main,
    ...(discovery
      ? [
          {
            ...discovery,
            discovery: true,
            relation: '視野を広げる',
            reason: useLinked ? '別分野にも、共通する手法' : 'いつもと違う分野への寄り道',
          },
        ]
      : []),
  ]
}
