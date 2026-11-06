# 模試1資料見出し統合・独立レビュー

2026-11-06、ローカル表示差分を確認。判定：合格、指摘0件・未解決0件。

- 模試1のみ、資料ラベルが大文字英字1字で、先頭の純テキスト単一行の英字と一致する場合に限定。英字だけなら重複行を省き、空白で続くテーマはheading_titleへ移して【英字】の横に表示する。Vueの通常の文字列補間を使い、テーマをHTMLとして解釈しない。
- 別英字、改行を含む本文、ID/inlines/source付きブロック、非英字ラベル、模試2〜10は保持する。本文・anchorブロックは元のオブジェクト参照を保ち、資料ID・group_id・表示順・section ID・anchor prefixは変更しない。表示用のコピーだけを作り、原配列と保存データは変更しない。
- 独立実行：表示関連13件と追加の合成・構造境界29件が全件成功。英字のみ、半角/全角空白・タブ付きテーマ、英字不一致、改行本文、参照付き、他模試、凍結配列の非破壊、テーマ表示・section/anchor維持を確認した。
- 独立担当はHTTP・DB・UI・重い検査・状態更新を実施していない。今回の変更は本レビュー記録のみ。

確認時点のSHA-256：

| ファイル | digest |
|---|---|
| `frontend/app/utils/learningPresentation.ts` | `d361d9b38e29cd00e762683200f21df4e851731cb09a1c4a0bbdc37fef0caede` |
| `frontend/app/components/SharedPassagePanel.vue` | `fd4721d6bc42146fa86b4e3a3afcd4ebeda5aa5f3320c29ddc92d7e9de70aa8d` |
| `frontend/tests/groupedLearningPresentation.test.ts` | `6437ede5d1a582c7ad9c2c9b36ed41aa8fd7a168d74becdfbb36513f0f3785ab` |

未コミット・未公開。
