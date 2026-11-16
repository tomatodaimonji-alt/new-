# PINE 引き継ぎ（最初に読む）

更新日: 2026-11-17

## プロジェクト本体
GitHub: `tomatodaimonji-alt/new-` / main
- プレイ用: `forest-game-prototype.html`（PINE v3.2）
- エディター: `world-editor.html`
- 分割ソース: `src/game/`、`src/editor/`
- 生成・チェック: `scripts/build.mjs`、`scripts/test-build.mjs`
- 世界の原則: `PINE_WORLD_RULES.md`、本書と `docs/PROJECT_RULES.md` 等

## 今回の整理内容
既存の2つの巨大なHTMLを**一文字も変更せず**、順番が固定された複数ファイルへ切り出した。ソースは連結断片であり、まだ独立ES Modulesではない。単一HTMLの完成物とエディターは残す。以降の編集は `src/` が基本。

## 変更する前に
1. 本書・`docs/PROJECT_RULES.md`・`docs/GAME_SPEC.md`・`docs/WORLD_SPEC.md` を読む。
2. 最新GitHubの完成HTMLと分割ソースの一致を確認する（`node scripts/build.mjs --check`）。
3. 対象の実装と関連するエディター/ゲームの両方を読む。断片境界をまたぐ変数に注意。
4. 変更は最小限にし、`node scripts/build.mjs` → `node scripts/test-build.mjs`。
5. 結果と未検証事項を `docs/CHANGELOG.md` と本書に残す。

## 意図して変更していないもの
ゲームの描画、地形、橋の歩行判定、港の乗下船、セーブ形式、ワールド構成、UI、ブロックID。この整理では**機能変更なし**。

## 直近の実装
v3.2: 旧漁港は3マス幅の木造桟橋、軍港はコンクリート岸壁、旅客港には接岸スペース。エディターに港湾建材7種類と32×32港湾見本。

## 未完成と次に行うこと
- エディターとゲームに複製された建材カタログ・3Dジオメトリを**本当に一元化**する。まだ複製のまま。
- エディター側でレイアウトを編集してゲームに安全に反映するパイプラインを設計する。
- 白い石橋・新港の歩行/描画、船の接岸、島→本島の連続移動、全体パフォーマンスをブラウザとAndroid実機で検証。
- チャンク永続化や遠景LODの設計と改善。
- 本島側の都市構造と建物入室、港・軍隊イベントの改善。

## 原則
ユーザーが重視するのは従来のPINE島を**壊さずに成長させる**こと。勝手な仕様変更や別マップ切替をしない。検証できていないことを完了したと断言しない。


## 2026-11-17 追記：共通建材カタログ・港湾3D形状の一元化
- 全ブロックカタログの唯一の編集元：`src/shared/block-catalog.fragment.js`。その中の港湾7種の参照先：`src/shared/harbor-palette.fragment.js`。
- 港湾7種の3D描画の唯一の編集元：`src/shared/harbor-geometry.fragment.js`。
- `src/game/02-palette.js` と `src/editor/02-palette.js` は共通カタログを参照する。両方の `03-geometry.js` は港湾3D形状を参照する。
- `scripts/build.mjs` がこれらを結合し、外部読込のない各単一HTMLを作る。ビルド後のHTMLは共通化前の現行版と**完全一致**することを検証済み。
- **その他の3D形状・当たり判定・編集UIはまだ共通化されていない**。追加ブロックはカタログの登録だけで完成しない。ゲーム描画・エディター描画・衝突・歩行/床判定を個別に確認する。
- 次の大きな統合対象は石橋/木橋、屋根、壁などの3D描画。ただしゲームとエディターの現状に差があり、差分を検証せずに統合しない。
- ブラウザとAndroidでの動作テストは別途必要。今回の共通化そのものは機能変更なし。


## 2026-11-17 追記：屋根・壁面・柵・橋の共通基礎
- ゲームとエディターでバイト単位で同じだった次の描画処理を `src/shared/` に移行：
  - `roof-geometry.fragment.js` — 屋根の接続処理
  - `wall-facade.fragment.js` — 外壁・窓・玄関まわりの外装表現
  - `fence-geometry.fragment.js` — 木・石・鉄の柵の接続モデル
  - `bridge-types.fragment.js` — 橋ブロックIDと方向・接続の基礎
- `scripts/build.mjs` がゲーム・エディターの両方に挿入し、単一オフラインHTMLを維持。両方の既存コードに対して **03-geometry.js の再構成結果が文字単位で完全一致**することを確認。
- **橋の高さ `bridgeSpanElevation` と橋の3D床・欄干 `bridgeConnectedGeometry`、実際の歩行 `gameBridgeCanStep` は共通化していない。** ゲームとエディターに違いがあるため、無理に上書きして白い石橋を壊さない。
- 建物の全壁生成、衝突・扉・屋根の非表示、島・港の配置なども引き続きゲームごとの実装。次回もソースの同一部分だけを切り出し、移行前後のHTML完全一致と動作確認を優先する。
