# 3Dワールド工房 — 編集用ソース

このリポジトリは **3Dワールド工房** (`world-editor.html`) と、別の旧作 **森の遺跡** (`index.html`) を保持します。
PINEゲーム本体、サンプルエディター、箱庭AIは含みません。

## ワールド工房
- 編集元: `src/editor/`
- 共有建材と3D形状: `src/shared/`（工房の描画に必要なので保持）
- 配布用HTML: `world-editor.html`
- Androidアプリ: `app/`、APKビルド: `.github/workflows/build-apk.yml`

## 編集・検証
```sh
node scripts/build.mjs
node scripts/build.mjs --check
node scripts/test-build.mjs
```
共通ソース中の PINE 接頭辞は既存ブロックID・保存データとの互換性維持のため変更していません。
