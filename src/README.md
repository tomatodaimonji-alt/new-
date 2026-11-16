# PINE 開発用ソース

このリポジトリには **オフラインで動く単一HTML** と、その開発用に分割したソースの両方があります。ゲーム本体は `forest-game-prototype.html`、ワールドエディターは `world-editor.html`。既存のセーブデータや画面を壊さないため、初回分割ではコードの順番・文字列・処理を**一切変更していません**。

## ビルド

Node.js 20以降（外部パッケージ不要）。

```sh
node scripts/build.mjs --check
node scripts/test-build.mjs
node scripts/build.mjs
```

`--check` は `src/` を連結して得られるHTMLと、リポジトリ直下の完成HTMLが**完全一致**するか調べます。不一致なら失敗します。通常のビルドでは両HTMLを書き出します。ネットワークやCDNは使用しません。

**変更の原則:** これからは `src/` を編集し、ビルドでHTMLを生成します。完成HTMLだけを直接編集してはいけません。例外的に直接修正した場合は、分割ソースへ必ず同じ修正を反映し、`--check` を通してください。

## 分割の現状

`src/game/` と `src/editor/` は、既存の巨大な即時実行関数（IIFE）の**連結断片**です。個々の `.js` はまだ独立したESモジュールではありません。`import` / `export` を無断追加しないこと。ファイル名は主な役割を示しますが、過去の処理が混在する章も残っています。

- `01-runtime`, `02-palette`, `03-geometry`: 初期化、ブロック定義、地形と共通3D形状
- `04-scene`, `05-*`, `06-*`: WebGLレンダリング、エディター画面、既存マップ／デモ
- `07-island-migration` ～ `11-zone-geometry`: PINE島と周辺区域の移行、施設、海・本島・船
- `12-collision-and-interiors`, `13-player-loop`, `14-game-entry`: 当たり判定、入室・階段、移動、起動
- `src/editor/`: エディター側の初期化、建材、形状、描画、編集／インポート

初回分割では「共通ブロックの描画関数」が両方に複製されたままです。**共通ライブラリへの移行は次の段階**で、双方の動作とJSON互換を検証しながら小さく進めます。未完了の共通化を完了済みと書かないでください。

## 毎回の変更手順

1. `docs/HANDOFF.md`, `docs/PROJECT_RULES.md`, `docs/GAME_SPEC.md`, `PINE_WORLD_RULES.md` を先に読む。
2. 関連する編集用とゲーム用ソースを両方調べる。既存の区画・農地・道路・橋・建物・セーブを保護する。
3. 変更内容を `src/` に加えてからビルド。不要なデモ置換・固定座標上書きは避ける。
4. ビルドの完全一致チェックと静的テストを実施する。
5. 実機/WebGLの歩行、橋、港、船、屋内、セーブを確認する。できなければ未検証と明記。
6. `docs/CHANGELOG.md` と `docs/HANDOFF.md` を更新する。

重要: 静的テストはブラウザの実動作、GPU負荷、船の着岸や歩行の全経路を保証しません。


## 共通建材ソース（2026-11-17 以降）
- `src/shared/block-catalog.fragment.js` — ゲーム/エディター両方が使う**全ブロックカタログ**
- `src/shared/harbor-palette.fragment.js` — カタログ内に展開される港湾7ブロック
- `src/shared/harbor-geometry.fragment.js` — 港湾7ブロックの共通3D形状

`scripts/build.mjs` は3種類の参照マーカーを展開して、従来と同じ完全オフライン単一HTMLを生成します。**新しいブロックIDはまず共通カタログへ追加**してください。描画や当たり判定に新しい実装が必要なら、それらも整合させてください。

現在、全ブロックの**定義**は一元化できていますが、港湾以外の3D**形状・判定処理**はまだ各アプリ側にあります。見た目だけを共有したと誤解しないこと。今回の共通化によって現行完成HTMLの内容は変更していません。


## 共通3D形状（2026-11-17 更新）
追加した唯一の編集元：
- `src/shared/roof-geometry.fragment.js` — 接続式屋根
- `src/shared/wall-facade.fragment.js` — 壁面の外装アクセント
- `src/shared/fence-geometry.fragment.js` — 柵
- `src/shared/bridge-types.fragment.js` — 橋ID・向き・同種橋の接続規則

`scripts/build.mjs` が両方の `03-geometry.js` へ挿入するため、ゲームとエディターで描画ロジックが乖離しにくくなっています。

**除外したもの：** `bridgeSpanElevation`、`bridgeConnectedGeometry`、`gameBridgeCanStep` はゲーム／エディター間で差異があります。特に白い石橋の高さと歩行に関係するため、差分の仕様化と実機検証をするまで統合しないでください。

## v3.3 大型船の共有3Dモデル
`src/shared/landing-craft-geometry.fragment.js` は18×8の船体・甲板・操舵室などを描画する共通コード。ゲームとワールドエディターに同じメッシュ生成関数を埋め込む。港・操船・20名の乗降ロジックは `src/game/10-seamless-world.js`。エディターの見本は `src/editor/06-data-and-demos.js`。
参考資料は `docs/ASSET_REFERENCE_LOG.md`。別の船を増やす場合は、港の接岸寸法と当たり判定をセットで設計する。
