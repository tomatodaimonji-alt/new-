# 3Dワールド工房

このリポジトリは **3Dワールド工房専用** です。他のゲーム本体・ゲーム用テスト・ゲーム用APKビルドは含めません。

- 完成版: `world-editor.html`
- 編集ソース: `src/editor/`
- 建材と形状の共有部品: `src/shared/`
- HTML生成と検証: `scripts/`
- Androidアプリ: `app/`
- Android APKビルド: `.github/workflows/build-apk.yml`
- ブラウザ検証: `.github/workflows/editor-test.yml`
- ソース整合性検証: `.github/workflows/editor-integrity.yml`
- 工房の操作説明: `WORLD_EDITOR_GUIDE.md`

## 開発手順
```sh
node scripts/build.mjs
node scripts/build.mjs --check
node scripts/test-build.mjs
```

ワールドの保存形式 `forest-world-v1`、既存の建材ID（`pine*` など）は古い利用者データとの互換性のため維持します。これらは別ゲームの実行ファイルではありません。

工房以外のアプリは変更・復元しないでください。
