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
   - 公開の設定は `app/wrangler.jsonc`(`dist` を、そのまま配信する)。
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
