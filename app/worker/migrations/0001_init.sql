-- 論文さがしのキャッシュと、日ごとの外部 API 呼び出し回数(論文サーチャーの SQLite と同じ形)
-- value は JSON。OpenAlex の結果は 1 日、論文と AI の説明は 30 日で期限切れ。
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS cache_expires ON cache (expires);

-- day は UTC の日付。count は呼び出しの回数(トークン数や請求額ではない)。利用者全員で共通の枠。
CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL,
  service TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, service)
);
