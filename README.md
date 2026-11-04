# 基礎日本史ラボ

日本史ラボをもとにした独立したローカル開発環境です。Nuxt 4 / Vue / TypeScript、Nitro / H3、PostgreSQL 16、Docker Composeを使用します。

## 起動

```sh
docker compose up -d --build
```

| 接続先 | URL・設定 |
| --- | --- |
| 学習画面 | http://localhost:3400 |
| 管理ログイン | http://localhost:3400/admin/login |
| API稼働確認 | http://localhost:3400/api/v1/health |
| 互換APIポート | http://localhost:3401/api/v1/health |
| PostgreSQL | 127.0.0.1:55435 |
| Compose名 | basic-japanese-history-practice |
| DB | basic_japanese_history_development |
| DBユーザー | basic_japanese_history |

初期構築時に独自のDBパスワードと認証用秘密値を `.env` へ生成しています。別環境では `.env.example` を複製して独自の値を設定してください。既存 `.env` は上書きしません。

停止は `docker compose stop`、再開は `docker compose up -d`。DBデータは専用ボリュームに保持されます。

## 模試の割り当て

- 偶数番号：歴検2級日本史の模擬問題。
- 奇数番号：センター試験日本史の模擬問題。

正本は `config/exam.json` の `exam.numbering`。初期枠は10回です。模試1（センター型36問）をローカルDBへ下書き登録しています。公開問題はありません。元サービスの教材・利用者・履歴は移していません。章節と文化史分類、会員・履歴・お気に入り・管理画面等の共通機能を引き継いでいます。

センター型は `center_mock` として6大問36問（6/6/6/6/4/8）を保存できます。全四択で、配点は各小問の表示に保持します。100点の加重集計機能は未実装です。歴検2級の正式な構成は別途対応し、既存の `rekiken_mock` は4大問30問の互換形式として残します。`content/questions.json` は合成検査用5問で、自動登録しません。

## ローカル運用

決済・パスワード再設定メール・広告は無効です。元サービスの秘密設定、Git履歴・リモート接続、Fly設定、公開実績・承認記録は引き継ぎません。管理者アカウントは未作成です。作成する場合は `frontend` の `admin:create` を環境変数 `ADMIN_EMAIL`、`ADMIN_PASSWORD`、`ADMIN_NAME` で実行します。秘密値をコマンド引数や履歴へ直接書かないでください。

[検証記録](docs/verification.md) / [初期コピー一覧](docs/copy-manifest.md) / [テスト手順](docs/testing.md) / [進捗管理](docs/workflow/README.md)

## センター型の作問

[作問ノウハウ](docs/center-authoring.md)に試験固有の方法・改善知見を蓄積します。作問・改稿のたびに更新し、原資料・問題原稿・解答・登録データはlocal-onlyで管理します。
