# 検証手順

## Netlifyの静的生成

CIの`netlify-static`ジョブは既存の検査完了後、Ubuntu 24.04の新しいチェックアウトで実行します。Node版・base・command・publish・環境変数は`netlify.toml`（production上書きを含む）を読み、`NETLIFY=true`・`CI=true`で`npm ci`と生成コマンドを実行します。CI側に`NITRO_PRESET=static`を重複定義しないため、配信設定からpresetを除いて出力先が変わる回帰も検知できます。

設定された公開先に非空の`index.html`・`200.html`・JS/CSSがあること、ソースにある`_headers`・`_redirects`が保持されることを検査します。古い公開先が存在する場合は削除せず検査を中止します。通常のサーバービルドの成果物による見かけ上の成功を防ぐため、実生成の検証はクリーンなコピーで行ってください。Python 3.11以上が必要です。

```sh
python3 -B -m unittest discover -s scripts -p 'test_netlify_build.py'
python3 scripts/check-netlify-build.py --node-version
# 上記のNode版を用意した、生成物のないコピーで実行
python3 scripts/check-netlify-build.py
```

このCIは生成先の整合を検査し、Netlifyへの公開操作は行いません。Netlify上のシークレット検査や外部環境変数を丸ごと再現するものではありません。

## アプリと資料保護の検査

Node.jsは `frontend/package.json` の対応版を使用し、DockerはNode.js 24です。負荷を抑えて順に実行します。

```sh
node scripts/check-template.mjs
node --test --test-concurrency=1 scripts/context.test.mjs scripts/workflow-policy.test.mjs scripts/workspace-policy.test.mjs scripts/check-private-sources.test.mjs
node scripts/context.mjs check
```

API検査は独立した `basic_japanese_history_test` を使います。DBの作成は初回のみです。

```sh
docker compose up -d db --wait
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" basic_japanese_history_test'
docker compose run --rm -e APP_ENV=test -e DB_NAME=basic_japanese_history_test frontend sh -c 'npm run db:migrate && npm run test:server'
docker compose run --rm frontend sh -c 'npm run security:check && npm test && npm run typecheck && npm run build'
```

合成データで保存・反復・公開条件・回答前非公開・履歴・お気に入り・アーカイブ・採点を検査します。論述の実教材の精度は原典と答案で別に確認します。画面はPC・スマートフォンの実操作を確認し、結果を [verification.md](verification.md) に残します。
