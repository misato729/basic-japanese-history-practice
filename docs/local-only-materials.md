# ローカル専用資料

日本史の資料は未登録で、別サービスの原資料は持ち込んでいません。

過去問は `past-exam/`、用語集は `glossary*`、原画像・全文OCRは `分析/`、その他資料・バックアップは `local-only/` に置きます。`classification.md*` もローカル専用です。

Git・Docker・外部ストレージ・CI成果物・Issue・PRへ送信しません。ポリシー、除外設定、`workspace-policy.mjs` の保護を維持します。別環境へ資料が会話履歴だけで移ることはありません。

送信前は `node scripts/check-private-sources.mjs` を実行し、削除済みでも履歴に原資料があれば停止します。履歴の書換え・強制pushは別の明示依頼が必要です。
