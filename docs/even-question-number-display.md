# 歴検型の番号・配点重複行の非表示

2026-11-06、追加依頼により偶数歴検型も対象に拡張。ローカル表示のみ、DB・解答履歴・原稿への変更なし。

変更ファイル：
- `frontend/app/utils/learningPresentation.ts`：先頭の番号・配点だけの独立行を非表示にする処理から奇数条件を除去。本文、ID・inlines付き行、先頭以外は保持。
- `frontend/app/pages/practice/[examNumber]/[questionNumber].vue`：表示関数の不要になった模試番号引数を除去。
- `frontend/tests/groupedLearningPresentation.test.ts`：全模試共通の期待値へ変更。

検証：全430問のAPIデータで表示配列が元の先頭1行だけを除いた配列と一致し、元データ不変を確認。表示関連11テスト・型検査成功。模試2の内部問13（大問内問5）をPC1280×850とスマートフォン390×844で確認し、番号配点行なし、設問本文保持、横はみ出しなし。本文枠の開閉・再読み込み後の表示も確認。全430画面の実操作は行っていない。資料保護・差分空白検査成功。

独立レビュー：`docs/even-question-number-review.md`。
未コミット・未公開。
