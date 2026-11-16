# PINE — 開発の入口（新しいチャットはここから）

**ゲーム本体は `forest-game-prototype.html`、エディターは `world-editor.html`。** `index.html` は別の旧ゲームであり、PINE本体として更新しないでください。

## 現在のバージョンと方針
- PINE v3.2（港湾景観改修版）。Androidで動かすオフライン・単一HTML。
- PINE島・海・本島はシームレスな単一ワールド。**別マップへの切り替え禁止**。
- 既存の畑、住宅、白い石橋、道路、ホテル、スーパー、住民区域、避難民キャンプなどを勝手に壊さない。
- ゲーム本体とワールドエディターは港湾建材などの定義を一致させる。

## 最初に読む資料
1. [引き継ぎ](docs/HANDOFF.md)
2. [開発の絶対ルール](docs/PROJECT_RULES.md)
3. [ゲーム仕様](docs/GAME_SPEC.md) / [ワールド仕様](docs/WORLD_SPEC.md)
4. [更新履歴](docs/CHANGELOG.md)
5. [分割ソースとビルド方法](src/README.md)
6. [世界観と配置ルール](PINE_WORLD_RULES.md) / [エディターガイド](WORLD_EDITOR_GUIDE.md)

## ソース構成
- [ゲームの分割ソース](src/game/) — 元の完成HTMLから順序を変えずに抽出。
- [エディターの分割ソース](src/editor/) — 同様。
- [ビルド](scripts/build.mjs) / [静的チェック](scripts/test-build.mjs) — Node.js標準機能のみ、外部パッケージ不要。
- [HTML整合性の自動検証](.github/workflows/pine-integrity.yml)。

```sh
node scripts/build.mjs --check
node scripts/test-build.mjs
# src/ を変更したとき:
node scripts/build.mjs
```

## 大事な制限
初回の分割は**安全な連結断片化**であって、個々のファイルは独立したES Modulesではない。共有ブロック・3Dジオメトリの完全一元化も未完成。静的チェックの成功はAndroid実機のFPS、描画・歩行判定の成功を保証しません。

## 新しいチャットでの依頼の仕方
「GitHub `tomatodaimonji-alt/new-` の `PINE_START_HERE.md` と `docs/HANDOFF.md` を最初に読み、`src/` の分割コードを編集して2つのHTMLをビルド・検証して。既存の島の構造は保護して。」で作業を継続できます。


## 共通ライブラリ（引き継ぎで重要）
- [全ブロック定義](src/shared/block-catalog.fragment.js) — 最優先の編集元
- [港湾ブロック定義](src/shared/harbor-palette.fragment.js) — 全ブロック定義から参照
- [港湾の共通3D形状](src/shared/harbor-geometry.fragment.js) — ゲームとエディターが利用
- `scripts/build.mjs` で各HTMLに埋め込むため、ランタイムに外部JavaScriptの読み込みは発生しません。
- 港湾以外の3D形状/当たり判定はまだ分離途上。新たな建材を追加するときは既存表示と移動判定の確認が必要。
