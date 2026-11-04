# 構成

- 画面：`frontend/app/` のNuxt 4 / Vue / TypeScript。
- API：`frontend/server/api/v1/[...path].ts` を入口とするNitro / H3。同一オリジンの `/api/v1`。
- 共有設定・型：`frontend/shared/`。設定の正本は `config/exam.json`。
- DB：PostgreSQL 16、`pg`、番号付きSQL。適用済みSQLはSHA-256で照合。
- 運用CLI：`frontend/server/operations/cli.ts`。問題アーカイブ、管理者作成、DB更新、決済監査、合成データの復元演習。

`frontend` と `db` の2サービスです。3400と3401は同じNuxtプロセスへ接続します。開発DBと他環境を共有しません。

教材→大問→小問、共通本文・部分参照・関連章節を保持します。単独5問、1大問7〜8問、4大問30問、選択・語句記述・論述の参考採点に対応します。

保存は `server/services/learning-writer.ts`、入力検証は `learning-validation.ts`、一般演習は `learning.ts`。公開後の回答形式を固定し、内容変更時は対象小問の履歴を失効させます。ID・お気に入り・対象外データを保持します。

論述は要素ごとの複数許容表現を使い、一致数・保留数と参考点を表示します。採点規則の実データは `frontend/local-only/essay-rule-profiles.json` の版付きJSONカタログとし、GitとDockerビルドから除外します。`ESSAY_RULE_PROFILES_PATH` で別のローカルファイルも指定できます。未配置は空、不正な形式・ルール・IDと版の重複は明示エラーにします。登録には原典確認と反例検査が必要で、合成テスト用の規則を実教材へ登録しません。

`server/data/essay-rule-profiles.ts` は汎用読込・検索処理です。起動時とファイル更新時に全体を検証してから一括で読込状態を切り替えます。不正な置換ファイルではエラーにし、古い規則で採点を続けません。規則とエンジンの版を含むdigestを保存し、読み込まれた規則と保存値の不一致は再保存まで409で止めます。`local-only/` は開発時の自動監視からも除外します。カタログ変更後は対象問題を共通Writerで再保存し、実際のサーバーの規則版・engine・digestを確認します。一般の回答前APIに正答・解説・採点規則・出典を返しません。未知表現は保留、論述の履歴の正誤はnullです。

`literal-rules-v3` は完全な関係文を登録する1スロットの読点省略、指定語の明示的な併記異表記、各節が独立して主体・対象・関係を示す複数事実のAND群、確認済み答案全体の完全一致を扱います。読点省略は助詞や句点を消しません。主体が省略された別の節を自由に結合せず、既知の複文答案を補完する場合は全文完全一致に限定します。登録した正しい否定・対比表現の保護はその範囲だけに適用し、前後の否定・仮定・撤回・矛盾の検査は残します。

Cookie名は `site.id` で分離します。認証・管理権限・利用資格・決済はサーバー側で検査し、課金・販売の初期値は無効です。

## ローカル環境と環境変数

Composeは `.env` をコンテナへ渡します。通常のNode.js CLIは自動読込しないため、基本はコンテナ内から実行します。`DATABASE_URL` は個別のDB接続変数より優先されます。他サービスの環境変数・秘密値を流用しないでください。

API・保存形式の詳細は `frontend/shared/types/learning.ts`、`frontend/shared/types/essay.ts` と実装を確認します。コピー時の確認範囲は [検証記録](verification.md) を参照してください。

## パスワードの変更・再設定

`PATCH /api/v1/me/password` は現在・新しい値・確認入力を検査し、新しいセッションを返す。SQL009の認証版で旧ログイン情報を失効し、変更前の旧形式tokenは版0として扱う。

`POST /api/v1/auth/forgot-password` は登録メールへGASの署名付き依頼を送り、未登録へは送らない。SQL010へhash/認証版/30分の期限を保存し、`POST /api/v1/auth/reset-password` で一度だけ保存できる。再申請や通常のパスワード変更で古いリンクは無効になる。本サービス専用のGAS・共有鍵・URLは未設定。ローカルではNuxtの同一origin APIを使う。[設定手順](gas-password-reset-setup.md)。
