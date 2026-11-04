# DB更新・バックアップ

新規DBから開始し、他サービスのDB・利用者・履歴・決済・秘密値を移行していません。

DB更新は `docker compose exec frontend npm run db:migrate`。起動時も同じ処理を実行します。適用済みSQLを書き換えず、新しい番号を追加します。

003は元サービス専用データ変換を除いた予約枠で、この新規コピーだけの構成です。元サービスの移行履歴との互換移行ではありません。構造を定義する001・002・004〜007は保持します。

バックアップはGit・Docker対象外の `local-only/backups/` へ保存できます。

```sh
mkdir -p local-only/backups
chmod 700 local-only/backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > local-only/backups/before-change.dump
chmod 600 local-only/backups/before-change.dump
```

復元先は専用DBを明示します。`down -v` や通常DBへの復元を検証に使いません。問題アーカイブは利用者・履歴・決済を含まず、DB全体のバックアップとは用途が異なります。

`operations:restore_drill` はローカルの末尾 `_test` の接続先から使い捨てDBを作り、合成データだけで復元を確認します。未実行の復元を確認済みと記録しないでください。
