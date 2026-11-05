# 模試1のローカル演習と見出し

確認日：2026-11-05（JST）。ユーザー依頼により、登録済みの模試1を専用ローカル環境で解答可能にした。

入口：[模擬試験1（センター）](http://localhost:3400/practice/1/1?exams=1)。トップページの同名カードからも開始できる。ログインなしで解答・解説を利用でき、履歴保存にはログインが必要。

## 変更

- 専用Composeの開発DBで、模試1・6大問・36問を既存の共通Writerと単一トランザクションで有効化した。教材名は「模擬試験1（センター）」。本番・クラウドDB・外部公開は対象外。
- 模試見出しの共通関数を変更し、奇数は「模擬試験n（センター）」、偶数は「模擬試験n（歴検2級）」に統一した。トップ・サイドバー・演習・履歴・お気に入り・達成度・管理側の教材見出しで使用する。
- 概要の「公開問題はありません」という古い案内を更新し、利用できる模試は演習一覧から確認する案内にした。静的設定の10枠を実公開10件とは扱わない。

## 検証

- 変更前後の全問題・選択肢・正答・解説・出典・分類・本文参照・内容版・IDと、共通本文・対象外件数を比較し一致。再実行は変更なし、保持対象のdigestも一致した。教材原稿や教材payloadはGitに含めない。
- 独立レビューで一覧1件・6大問36問・指定教材名を確認。36問すべて匿名取得でき、各4肢。回答前の正答・解説・出典・採点規則の非露出も全件確認。
- PCと390×844のスマートフォン表示で、全36問の四択・見出しとページ全体の横はみ出しなしを確認。表・引用・模式図の表示位置を確認した。スマートフォンの表は専用の横スクロール領域内で操作できる。
- 実操作で入口から開始、選択・回答・正答／解説／根拠資料表示、次問・大問移動、最終問の完了表示を確認。PCとスマートフォンで回答操作を実施した。表示サイズを元に戻し、最初の問題を開いた状態で引き渡す。
- 画面側単体254件・型検査・テンプレート設定検査・資料保護検査・差分空白検査が成功。
- 専用の `basic_japanese_history_test` で合成データのAPI回帰124件が成功。公開条件・解答前非露出・回答・再送・履歴・お気に入り保全を含む。実教材のDBや利用者データへ検査用データを投入していない。
- 独立レビューは [local-playable-review.md](local-playable-review.md)。運用処理・検査ログ・画面画像はlocal-onlyに保持する。

今回の確認は匿名演習。ログイン後の履歴・お気に入り・管理操作は今回の実問題UI検証に含めない。配点表示は保持し、100点の加重集計機能を新設したものではない。今回の変更はローカルの未コミット差分で、外部公開・デプロイは行っていない。

## 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `frontend/app/utils/examCatalog.ts` | 指定見出しの共通生成 |
| `frontend/app/pages/index.vue` | カードの読み上げ名 |
| `frontend/app/components/ExamSidebar.vue` | 既存の共通関数を通じて新見出しを表示（ファイル変更なし） |
| `frontend/app/pages/practice/[examNumber]/[questionNumber].vue` | 教材名・完了メッセージ |
| `frontend/app/pages/history.vue` | 履歴の模試名 |
| `frontend/app/pages/favorites.vue` | お気に入りの模試名 |
| `frontend/app/components/AchievementReport.vue` | 達成度の模試名 |
| `frontend/app/pages/admin/exams/index.vue` | 教材一覧の見出し |
| `frontend/app/pages/admin/exams/[examNumber].vue` | 教材編集の対象名 |
| `frontend/tests/catalogExamNavigation.test.ts` | 奇数・偶数の期待表示 |
| `config/exam.json` / `frontend/app/pages/exam-overview.vue` | 収録内容・演習案内 |
| `README.md` | 現在のローカル状態・開始URL |
| `docs/center-authoring.md` | 実画面での確認方法を蓄積 |
| `docs/local-playable.md` / `docs/local-playable-review.md` | 結果と独立レビュー |
| `docs/workflow/state.json` / `docs/workflow/handoffs/*.json` | 依頼・受入条件・完了記録 |

## 大問見出しの追加調整（2026-11-05）

ユーザー指定により、大問の題名の前へ付加していた「大問n」を演習画面と大問メニューから削除した。題名自体の「第n問」は保持する。変更は `frontend/app/utils/examCatalog.ts`、`frontend/app/pages/practice/[examNumber]/[questionNumber].vue`、既存期待値を調整した `frontend/tests/catalogExamNavigation.test.ts`。DB・教材本文・問番号・リンクは変更していない。

対象の既存検査15件・差分検査・資料保護検査が成功。PCで全6大問の見出しと6リンク、スマートフォンで見出し・メニューの開閉と大問移動を確認し、ページ全体の横はみ出しはない。開発中の古い表示は再読込後に最新の表示で確認した。独立レビューは `docs/group-heading-review.md`。今回の追加調整も未コミット。
