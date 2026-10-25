# つむよむ 運用メモ

招待した人に渡すときと、そのあとの運営で使う手順。管理者の画面は作らず、**Supabase の SQL エディタ**で行う(決定)。

SQL エディタ: Supabase のダッシュボード → プロジェクト `tsumuyomu` → SQL Editor。
削除や変更の SQL を実行すると、「破壊的な操作です」という確認が出る。対象の条件(`where`)を見てから、実行する。

## 1. 招待する

1. 招待コードを発行する(下の SQL)。
2. 招待する人の Gmail を、Google Cloud の「Google Auth Platform → 対象 → テストユーザー」に足す(下の「3. Google のテストユーザー」)。
3. 招待コードと、アドレス(https://tsumuyomu.314159265yy3y.workers.dev)を、その人に渡す。
4. その人は、Google でログインして、招待コードとユーザー名を入れる。

### 招待コードを発行する
1 回だけ使えるコードを 1 つ、30 日間有効で発行する。コードは、推測されにくいよう、12 文字のランダムな文字列にする。

```sql
insert into public.invite_codes (code, max_uses, expires_at)
values (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), 1, now() + interval '30 days')
returning code, max_uses, expires_at;
```

- 数人で使い回すときは、`max_uses` を増やす。期限をなくすときは、`expires_at` を `null` にする。
- コードは、8 文字以上の大文字と数字(DB の制約)。大文字小文字は、入力のときに区別しない。
- 招待コードは、本人に直接渡す。チャットに貼ったものは、使い終わったら、無効にする(下)。

### 使い方を見る
どのコードが、何回使われたか。

```sql
select code, used_count, max_uses, expires_at, disabled, created_at
from public.invite_codes order by created_at desc;
```

誰が、どのコードで登録したか。

```sql
select p.username, u.code, u.used_at
from public.invite_uses u join public.profiles p on p.id = u.user_id
order by u.used_at desc;
```

### 無効にする・期限を変える
```sql
update public.invite_codes set disabled = true where code = 'ここにコード';
update public.invite_codes set expires_at = now() + interval '7 days' where code = 'ここにコード';
```

## 2. 利用をやめてもらう

1. Supabase → Authentication → Users で、その人を削除する(ログインできなくなる)。プロフィール、記録、棚も、一緒に消える。
2. 使った招待コードが残っていれば、無効にする(上)。

> 記録を残して、ログインだけ止めたいときは、Authentication → Users で、その人を「Ban」する。

## 3. Google のテストユーザー

Google Cloud の公開ステータスが「テスト」の間は、**テストユーザーに入れた人しか、Google でログインできない**(上限 100 人)。
- 追加する場所: Google Cloud コンソール → Google Auth Platform → 対象 → テストユーザー。
- 「テスト」のままだと、ログインの有効期限が 7 日で切れる。招待する人が増えたら、本番公開(検証)の手続きを検討する。

## 4. データベースを変える

DB の定義は、`supabase/migrations/` に、日付順で置く。**変更したら、ファイルを足して、Supabase の SQL エディタで、同じ SQL を実行する**(いまは手動)。

1. 新しいファイルを足す(例: `20261101000000_何を変えたか.sql`)。既存のファイルは、書き換えない。
2. ローカルで、権限のテストを通す: `supabase/tests/run.sh`(下の「5. テスト」)。
3. SQL エディタで実行する。「RLS なしでテーブルを作る」という警告が出たら、「Run and enable RLS」を選ぶ。
4. 実行したあと、`select` で、変更を確かめる。

## 5. テスト

画面と集計のテスト(Vitest):

```bash
cd app && npm test
```

データベースの権限(RLS)と招待コードのテスト。ローカルの PostgreSQL が要る(Supabase 本体は要らない)。接続先を、環境変数で指定する。

```bash
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres bash supabase/tests/run.sh
```

テスト用の DB(`tsumuyomu_test`)を作り直すだけで、ほかの DB には触れない。

## 6. 公開(デプロイ)

**いまは、手元でビルドして、`wrangler deploy` で公開する。** `main` への push では、公開されない(下の「自動ビルドについて」)。

1. 変更を `main` にマージする。
2. `main` の内容で、`app/.env.local` に接続情報を書く(`app/.env.example` を写して、値を入れる)。
   - `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY`(公開用キー)。`service_role` / secret キーは、どこにも置かない。
   - `.env.local` は、Git に入らない(`.gitignore` 済み)。
3. ビルドして、公開する。

   ```bash
   cd app && npm ci && npm run build && npx wrangler@4 deploy
   ```

   - 初めての PC では、先に `npx wrangler@4 login` で、Cloudflare にログインする。
   - 公開の設定は `app/wrangler.jsonc`(`dist` を配信し、`/api/` だけを Worker で扱う)。
   - さがすの DB(D1)を変えたときは、公開の前に `npm run db:migrate` も実行する(下の「8. 論文さがし」)。
4. https://tsumuyomu.314159265yy3y.workers.dev を開いて、変更が出ているか確かめる。
   - 公開の履歴は `npx wrangler@4 deployments list` で見られる。前の版に戻すときは `npx wrangler@4 rollback`。

### 自動ビルドについて
- Cloudflare の Git 連携(Workers Builds、Root directory は `app`)は設定してあるが、2026-10-22 以降、ビルドが失敗し続けている。原因は、まだ確かめていない。
- PR や `main` に付く「Workers Builds: tsumuyomu」の失敗は、このためで、変更のせいではない。
- 直すときは、Cloudflare → Workers & Pages → tsumuyomu → Deployments → Build history で、失敗したビルドのログを見る。接続情報は、ビルド変数 `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` に入れる。
- 直ったら、この節を「`main` に push すると、自動で公開される」に戻す。

## 7. 気をつけること

- **Supabase の無料プロジェクトは、1 週間アクセスがないと、一時停止する。** 停止したら、ダッシュボードで「Restore」を押す。
- 無料枠(DB 500MB など)は、ときどき、Supabase → Settings → Usage で確かめる。料金や無料枠の数字は、公式の料金ページで確認する。
- 公開ページ(`/u/ユーザー名`)は、検索エンジンに出さない設定(noindex)。公開した記録は、リンクを知っている人なら、誰でも見られる。
- 生成画像(`design/assets/`)を、配布・公開するときは、使った生成サービスの規約を確認する。
- 日本の論文(JaLC の DOI)は、ブラウザから書誌情報を取れないので、手入力になる。

## 8. 論文さがし(さがすタブ)

元は、別に作った「論文サーチャー(Paper Compass)」(`E:\論文サーチャー`)。その検索・おすすめ・類似・日本語の説明を、Worker(`app/worker/`)と画面(`app/src/components/SearchScreen.tsx`)に移した。

- 外部 API: **OpenAlex**(論文の検索と抄録。キーなしでも、小さい匿名枠で使える)、**Gemini**(検索語の英訳と、日本語の説明。任意)。
- キャッシュと、日ごとの呼び出し回数は、**Cloudflare D1**(無料枠の SQLite)。OpenAlex の結果は 1 日、論文と説明は 30 日で期限切れ。
- 日次の上限(`OPENALEX_DAILY_LIMIT`、`AI_DAILY_LIMIT`)は、**利用者全員で共通**。UTC の日付で数える。上限に達すると、その日は新しい呼び出しを止める(キャッシュ済みの結果は見られる)。有料枠へ切り替える処理はない。
- 使えるのは、ログインして、招待コードで登録を済ませた人だけ(Worker が Supabase に問い合わせて確かめる)。
- 探索の経路、あとで読む、関心分野は、ブラウザーの localStorage(利用者ごとに分ける)。端末をまたいでは引き継がない。

### 初めて公開するとき(1 回だけ)

**2026-10-25 に済ませた**(D1 `tsumuyomu-search` を APAC に作成、テーブル作成、`SUPABASE_URL` と `SUPABASE_ANON_KEY` を登録)。作り直すときの手順として残す。

`app` で実行する。初めての PC では、先に `npx wrangler@4 login`。

1. D1 のデータベースを作る。表示された `database_id` を、`app/wrangler.jsonc` の `REPLACE_WITH_D1_DATABASE_ID` と置き換える。

   ```bash
   npx wrangler@4 d1 create tsumuyomu-search
   ```

2. テーブルを作る。

   ```bash
   npm run db:migrate
   ```

3. Worker の秘密の設定を入れる(値は、聞かれたときに貼る。チャットやリポジトリには書かない)。

   ```bash
   npx wrangler@4 secret put SUPABASE_URL        # app/.env.local の VITE_SUPABASE_URL と同じ
   npx wrangler@4 secret put SUPABASE_ANON_KEY   # app/.env.local の VITE_SUPABASE_ANON_KEY と同じ(公開用キー)
   npx wrangler@4 secret put OPENALEX_API_KEY    # 任意。OpenAlex の無料アカウントの枠を使うとき
   ```

4. いつもどおり、ビルドして公開する(「6. 公開」)。

### AI(日本語の説明)を使う

1. Gemini の API キーを、**無料枠のプロジェクト**で作る。利用するモデルが無料枠であることを、提供元で確かめる(アプリからは、課金の設定を確かめられない)。
2. `npx wrangler@4 secret put GEMINI_API_KEY`
3. `app/wrangler.jsonc` の `vars` で、`AI_ENABLED` を `"true"` にして、公開する。上限やモデルも、ここで変える。
- AI 無料枠では、入力と出力が、製品の改善に使われることがある。送るのは、検索語と、公開されている抄録だけ。
- AI がないときは、検索語を、簡単な辞書で英語に変える(`worker/service.ts` の `DICTIONARY`)。辞書にない日本語は、そのまま OpenAlex に渡るので、見つかりにくい。

### 使い方を見る

```bash
npx wrangler@4 d1 execute tsumuyomu-search --remote --command "select * from usage order by day desc limit 10"
```

### 制約
- 類似のラベルは、候補を探した観点。手法が同じことを保証しない。
- 「新着」は過去 1 年の公開日順で、流行の判定ではない。
- 無料の Workers は、1 回の処理の CPU 時間が短い(10ms)。OpenAlex の結果の読み込みが重いときに、まれに失敗することがある。続くようなら、取得件数(40 件)を減らす。
