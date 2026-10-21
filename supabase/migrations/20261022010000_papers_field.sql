-- 論文の分野。背表紙の色に使う(M3)。
-- 分野の値は、画面の色の名前(app/src/lib/books.ts の Field)と同じ。取得できなければ null(画面の側で色を決める)。

alter table public.papers
  add column field text check (field in ('ml', 'ls', 'ps', 'li', 'ne', 'ed', 'st', 'ma'));
