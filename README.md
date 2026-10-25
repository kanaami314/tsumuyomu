# つむよむ

論文を毎日読む習慣を付けるための、読書記録アプリ。読んだ論文を書棚に積み上げて、累積をふりかえる。スマホ中心の Web アプリ(PWA)。招待制で運用している。

- 記録: DOI や arXiv の ID から書誌情報を取得して、一言感想としおり(刺さった度)を付けて、棚に迎える。
- 書棚・ふりかえり: 通算、今月、読んだ日、月ごとの積み上げ、分野の内訳。連続日数は、持たない。
- 公開: 既定は非公開。公開にした記録と棚だけが、`/u/ユーザー名` で見られる。
- さがす: 日本語で論文を検索し、選んだ論文から、つながりのある論文へたどる。関心分野の新着のおすすめ(関心に近い 4 本と、視野を広げる 1 本)。見つけた論文は、そのまま記録できる。元は、別に作った「論文サーチャー(Paper Compass)」。

## 構成

| 領域 | 採用 |
|---|---|
| 画面 | React + Vite + TypeScript(静的な SPA、PWA) |
| 公開先 | Cloudflare Workers(静的ファイルの配信と、さがすの API `/api/papers/`)。いまは、手元でビルドして `wrangler deploy` で公開(手順は `docs/operations.md`) |
| さがす | OpenAlex(論文の検索・抄録)、Gemini(日本語の説明。任意)、Cloudflare D1(キャッシュと、日ごとの呼び出し回数) |
| DB・認証 | Supabase(Postgres、Google ログイン、行ごとの権限 RLS) |
| 書誌情報 | doi.org の CSL JSON(Crossref、DataCite) |

```
app/        画面(Vite + React + TypeScript)
app/worker/ Worker(さがすの API。D1 の定義は app/worker/migrations)
supabase/   DB の定義(migrations)と、権限のテスト
docs/       アイデアメモ、実装計画、運用メモ
design/     見た目のモックと素材(開発用のコードではない)
```

## 開発

```bash
cd app
npm install
cp .env.example .env.local   # Supabase の URL と、公開用キーを入れる
npm run dev                  # http://localhost:5173
npm test                     # 画面・集計のテスト
npm run lint && npm run build
```

`.env.local` には、Supabase の**公開用キー**(`sb_publishable_…` / anon)だけを入れる。`service_role` / secret キーは、画面にも、リポジトリにも、置かない。接続情報がないときは、見た目の確認用のデータで動く(保存はできない)。

さがすは、接続情報がないときは、同梱した 29 本のデモで動く(外部と通信しない)。実際の検索を手元で試すときは、`app/.dev.vars`(`.dev.vars.example` を写す)を置いて `npm run build && npm run db:migrate:local && npm run dev:worker`(http://localhost:8787)。

DB の権限のテストは、ローカルの PostgreSQL で実行する。手順は `docs/operations.md`。

## 文書

- `docs/idea-memo.md` … 決定事項(アイデア、運用の方針)
- `docs/implementation-plan.md` … 技術構成、データ設計、開発の段階
- `docs/operations.md` … 招待、運営、デプロイ、注意点
