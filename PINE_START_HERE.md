# PINE — 開発の入口（新しいチャットはここから）

**ゲーム本体は `forest-game-prototype.html`、エディターは `world-editor.html`。** `index.html` は別の旧ゲームであり、PINE本体として更新しないでください。

## 現在のバージョンと方針
- PINE v3.3（兵員輸送艇・軍港改修版）。Androidで動かすオフライン・単一HTML。
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


## 共通化した建築・景観3D
[屋根](src/shared/roof-geometry.fragment.js) / [外壁アクセント](src/shared/wall-facade.fragment.js) / [柵](src/shared/fence-geometry.fragment.js) / [橋の種類と向き](src/shared/bridge-types.fragment.js) を共通ライブラリ化済み。ゲームとワールドエディターの表示に反映されます。

石橋の床の高さ・欄干の表示と、ゲームの歩行判定は**共通化対象外**。差分を調べずに一括置換しないこと。


## ビジュアル・建材品質の必須ルール
新しいアセットを作成・改修する場合、実際の構造物の写真や設計資料、参考になるゲームの画面を**先に調べてから**設計し、見た目・部材のつながり・サイズ・素材・自然な配置を重視する。適当な箱型モデルだけで済ませない。Androidで重くならない形に最適化し、既存島の建築や歩行判定を守る。

必読：[アセット品質基準](docs/ASSET_QUALITY_STANDARD.md) / [参考資料と観察ログ](docs/ASSET_REFERENCE_LOG.md)。画像の無断複製は禁止し、確認できなかった参考資料について「調査済み」と記載しない。

## v3.3 — 大型船と軍港
- [18×8マス輸送艇の共通3D形状](src/shared/landing-craft-geometry.fragment.js)
- [実際に確認した写真・参考ゲーム資料の観察ログ](docs/ASSET_REFERENCE_LOG.md)
- [本体の港・船・兵員移動](src/game/10-seamless-world.js)
- [ワールドエディター用の48×40港湾見本](src/editor/06-data-and-demos.js)

20名の乗船・本島上陸の簡易アニメーションを実装したが、まだ自律AIや船内自由歩行、実機FPSの完成検証はしていない。
