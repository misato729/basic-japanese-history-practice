# 本番の定期スモークテスト

`.github/workflows/daily-smoke.yml` は毎日10:17 JST（01:17 UTC）に1回実行する。GitHubのスケジュール実行は遅延する場合がある。Actionsの `Daily production smoke` → `Run workflow` からも実行でき、スモークテスト自体の変更をmainへpushした際にも動作確認する。

`node scripts/production-smoke.mjs` で次を確認し、1件でも失敗すると終了コード1を返す。

- Netlify本番ホームのHTTP 200、HTML、サイト名、Nuxtアセット参照。
- Fly直接とNetlify経由のhealthのHTTP 200、JSON形式、サービス名、正常状態。
- Netlify経由の模試一覧のHTTP 200、JSON形式、模試1の利用可能状態と問題数が正の整数であること。DBからの取得経路を含む。
- 未認証のアカウントAPIがHTTP 401とJSONの `unauthorized` を返すこと。

全通信は認証情報なしのGET。1リクエスト30秒、ジョブ全体5分の上限を設け、リダイレクトも失敗とする。応答本文・ヘッダー・例外詳細はログへ出さず、確認名と合否だけを出す。秘密設定や追加パッケージは不要。失敗はActionsの実行結果で確認する。メール等の通知は利用者のGitHub通知設定に従う。

これはHTTPの疎通・応答形式・基本データ取得の確認である。ブラウザーのJavaScript実行、画面操作、ログイン成功、解答保存、決済は対象に含めない。

検査ロジックの回帰確認: `node --test scripts/production-smoke.test.mjs`。正常応答、APIへのHTML誤配信、health異常、空カタログ、認証境界の異常、ホーム異常、通信例外を合成応答で確認する。

2026-11-27の確認: 回帰検査8件成功、本番へのHTTP確認5件成功。YAML読込と資料保護検査も成功。初回のGitHub Actions実行結果は同ワークフローの実行履歴を参照する。
