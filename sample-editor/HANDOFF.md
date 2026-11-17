# サンプルエディター 引き継ぎ（2026-11-17）

## 現況
- 現在の表示/Androidバージョン **v11**。v11で上下視点スワイプ方向を補正し、電子音的な足音をノイズベースの短い接地音へ変更。
- GitHub: `tomatodaimonji-alt/new-`
- 実行用: `sample-editor/index.html`（生成済み、WebView/ブラウザで直接起動）
- Android: `sample-editor/app/`、Actions: `.github/workflows/build-sample-editor-apk.yml`
- Androidアプリは起動時にGitHub `main/sample-editor/index.html` を取得し、検証・保存して**次回起動時**に使用する方式。インストール済みアプリのネイティブ更新ではない。実機での更新成功は未確認。

## 実装済み
- 横画面、WebGL描画、谷中銀座を参考にした個人商店街の縮小モデル（現地実測の完全複製ではない）。
- 左半分の任意タッチ位置に出るパッド（終了時に初期位置に戻る）、傾きで歩き/走り。
- 左移動と右カメラを同時操作。右カメラ用2本指でピンチ、上下は空も見られる。
- 丸みを持つ人物、移動方向へ旋回、建物遮蔽処理、当たり判定。
- 手続き生成の風/低音アンビエンスと、ノイズベースの歩行/走行音（左右差付き）。

## ソースとビルド
- `src/page.template.html`: 固定HTML/CSSとバージョン表示。
- `src/01-renderer.js`: WebGL初期化、メッシュ。
- `src/02-yanaka-town.js`: 商店街構築（静的ジオメトリ）。
- `src/03-math.js`: 数学/バッファ基盤。
- `src/04-camera-gestures.js`: 右視点/ピンチ・左開始判定。
- `src/05-audio.js`: 音。
- `src/06-joystick.js`: 左パッド操作。
- `src/07-collision.js`: 衝突とカメラ遮蔽。
- `src/08-game-loop.js`: 移動、アバター、描画ループ。
- `tools/build.mjs`: 上記を**元と同じ順番で単一HTMLへ連結**。 `--check` は生成結果とコミット済み成果物の完全一致を検査。
- `tools/test.mjs`: 構文、版数/Actions整合、主要機能の静的スモーク検査。

## 開発手順
1. `DEVELOPMENT_RULES.md` → `MISTAKES.md` → この引き継ぎを読む。
2. 該当 `src/` のみ改修。必要なら先に現行動作の不変条件を確認。
3. バージョンを変えるならテンプレ、Gradle、Actions名を合わせる。
4. `node sample-editor/tools/build.mjs`。
5. `node sample-editor/tools/test.mjs`。
6. コードと生成された `index.html` を一緒にコミット。
7. Actionsビルド/Artifactsを確認。実機未検証ならそのまま報告。

## 次に気をつけること
- 現在はモジュールを**生成時に連結**。実行時のimportではない。WebViewの自動更新とオフライン起動を保護するため。
- `--check` は実行結果・実機での操作まで保証しない。
- 写真を根拠にした街並みの材質・寸法は今後も改善余地あり。
- 実測と写真比較、街の見通し、カメラ＋移動同時操作、ピンチ優先順位、音の重複再生を重点検証。
