# design

見た目だけの静的モック(HTML)と、画像素材。開発用のコードではない。
ブラウザで開けば表示できる(画像は HTML に埋め込み済み)。

## モック
- `mobile.html` … **スマホ幅(375px)の3画面**(ホーム、書棚、記録の入力シート)。現在の本命
- `shelf4.html` … 採用した書棚(背表紙主体 + 表表紙を混在。PC 幅)
- `immersive.html` … ホーム画面(写真に溶け込む案)
- `index.html` … ホーム画面(白い枠の案。参考)
- `shelf.html` / `shelf2.html` / `shelf3.html` … 書棚の途中案(参考)

## 素材
- `assets/` … モックが使っている軽量版
- `assets/source/` … 生成 AI で作った元画像(用途が分かる名前に変更済み)
  - `hero-cafe-wide.jpg` 店内の写真(ワイド) / `hero-cafe-small.webp` 初期の店内写真
  - `oak-board-top.jpg` オークの1枚板(棚板・枠に使用)
  - `wall-panel-cream.jpg` 背板(クリーム色の羽目板)
  - `oak-planks-seamed.jpg` 板を並べたテクスチャ(継ぎ目が目立つため不採用)
  - `oak-shelf-angle-a.jpg` / `oak-shelf-angle-b.jpg` 棚板を斜めから撮った参考画像
  - `unused-blur-vertical.jpg` 不採用

生成画像を公開・配布する場合は、使った生成サービスの利用規約を確認すること。
