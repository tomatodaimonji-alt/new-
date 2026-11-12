# 月影の遺跡 — Android APK

- Android専用HTMLプレイヤー。箱庭アプリとは別のアプリID（`jp.tsukacchi.moonruins`）です。
- ゲーム本体はリポジトリ直下の `index.html`。APKビルド時に内部の初期HTMLへコピーします。
- アプリ起動時にHTTPSのHTML公開URLを確認します。更新内容は **次回起動時** に反映します。ゲームの途中で勝手に再読み込みしません。
- 更新失敗時は保存済みのHTMLでオフライン起動できます。手動HTML更新・再読込・前に戻すも使用できます。
- 「自動更新」をタップすると手動確認、**長押し**で配信URLの変更・自動更新OFFを設定できます。
- 最大HTMLサイズは12MiB。配信内容に認証トークンを埋め込まないでください。

## 重要: 配信先を公開する必要があります

開発用リポジトリ `new-` はPrivateです。APKはGitHub認証情報を持たないため、デフォルトの `raw.githubusercontent.com/tomatodaimonji-alt/new-/main/index.html` は**Privateの間は取得できません**。APK内には初期HTMLが同梱されているのでゲーム自体は遊べます。

実際の自動更新を有効にするには、HTMLのみを公開HTTPS URL（例: 公開配信用リポジトリのRawファイル）に配信する必要があります。公開配信URLを作成したらアプリの自動更新ボタンを長押しして一度設定してください。それ以降の手動サイト訪問は不要です。Privateリポジトリを公開化する必要はありません。

## APKの取得

GitHubの `Actions` → `Build Moon Ruins APK` → 成功したrun → `moon-ruins-apk` アーティファクトを取得し、ZIP内の `app-debug.apk` をAndroidにインストールしてください。

このAPKはデバッグ署名です。再ビルドによるAPKは署名が変わる場合があるため、継続更新には固定署名キーでの配布設定が必要です。APKをアンインストールするとアプリ内のゲームデータが失われる可能性があります。

## 開発の流れ

1. ChatGPTが `index.html` を修正してGitHubに保存
2. GitHub Actionsが新しい初期HTML入りAPKをビルド（APKの入れ物を更新する場合）
3. 普段のゲーム更新は公開HTML配信先を更新することで、アプリ起動時の自動確認を利用

※ Android端末での実機テストは別途必要です。
