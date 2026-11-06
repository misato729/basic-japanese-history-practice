# 大問見出しの独立レビュー

確認日：2026-11-05（JST）。担当：review_local_playable。判定：修正必須の問題なし。

対象は `frontend/app/utils/examCatalog.ts`、`frontend/app/pages/practice/[examNumber]/[questionNumber].vue`、`frontend/tests/catalogExamNavigation.test.ts` の追加変更。共通見出し関数が題名の前後空白を除いて表示し、題名が空の場合は「第n問」を返すことを確認した。演習画面も同じ関数を使い、「大問n」の接頭辞と不要になったCSSを削除している。

小問番号・教材番号・リンク・本文・DB操作への変更はない。既存検査の期待値は通常の題名と空題名の両方を新しい仕様へ更新している。PC/SP実操作と検査実行の結果は主担当の記録へ分け、このレビューでは実行していない。

2026-11-06追記：上記は当時の題名をそのまま表示する変更のレビュー。後続教材の題名に番号の有無が混在し、「第n問」の欠落が判明したため、構造上の大問番号を表示時に補完する修正を行った。今回の原因・独立レビュー・PC/SP全30大問の確認は [numbered-group-headings.md](numbered-group-headings.md) を参照。
