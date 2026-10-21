#!/usr/bin/env bash
# RLS のテストを、ローカルの PostgreSQL で実行する。
# 接続先は、環境変数 PGHOST / PGPORT / PGUSER / PGPASSWORD で指定する(既定は、いまの設定のまま)。
# テスト用の DB (tsumuyomu_test) を作り直すので、ほかの DB には触れない。
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
db=tsumuyomu_test

# ロールはサーバー全体のものなので、前回の分を消してから作り直す
psql -v ON_ERROR_STOP=1 -d postgres -q <<SQL
drop database if exists $db;
create database $db;
SQL

# テスト用のロールが残っていれば消す(DB を消した後なので、依存はない)
psql -d postgres -q -c 'drop role if exists anon' -c 'drop role if exists authenticated' >/dev/null 2>&1 || true

psql -v ON_ERROR_STOP=1 -d "$db" -q -f "$here/stub_auth.sql"
for f in "$here"/../migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -d "$db" -q -f "$f"
done
psql -v ON_ERROR_STOP=1 -d "$db" -q -f "$here/rls_test.sql"
