# 特定商取引法に基づく表記の整備

2026-11-06（JST）のユーザー依頼に基づく。500円（税込）の買い切り、模試1〜4無料・模試5以降の利用資格、月額課金・自動更新なしを掲載した。利用期間・支払方法/時期・提供時期・返品返金・利用環境も既存実装と利用規約にそろえた。

参照先は https://japanese-history-practice.netlify.app/commercial-disclosure/ 。初期HTMLの未掲載表示だけで判断せず、API読み込み後の実画面で販売者名・責任者・問い合わせ先・請求による所在地/電話の無料開示と請求方法を確認した。その公開情報を表示用の初期値にし、本サービスの販売者設定を取得できれば設定全体を優先する。「販売準備中」は削除。API読込みは遷移を妨げないlazy取得・10秒タイムアウトとした。

通信販売広告の表示事項と開示方法は消費者庁の https://www.no-trouble.caa.go.jp/qa/advertising.html と https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php を参照した。法的適合性全体や実際の開示業務の実施を証明するものではない。

## 検証

- 設定検査、資料保護の追跡対象・全履歴検査、差分空白検査：成功。
- 関連既存検査：examConfig/catalogExamNavigation/sidebarCatalogAccessの33件成功。静的ページの問題API非取得と遅延応答無効化を含む。
- 専用開発コンテナーの型検査：成功。
- PC1280px、スマートフォン390pxの実画面で販売者情報・販売条件・開示方法・折返しとフッター導線を確認。文書幅は各1280/390pxで横はみ出しなし。利用規約からフッターの特商法リンクで戻り、初期値が即表示されることを確認。一時表示幅は解除。
- 独立レビュー担当disclosure_reviewが設定/表示/API取得と決済状態の分離を確認。指摘された販売者APIの決済フラグ依存を修正し再確認、未解決指摘なし。外部実情報のブラウザー確認はroot実施。
- 実決済、ログイン利用者、DB書込、外部公開・デプロイは対象外。payments.enabled=falseは保持し、現在の全問題利用可を変えていない。料金と無料枠の予定設定と実際の販売有効化を区別する。

## 今回の送信対象

- config/exam.json：free_exam_countを4へ変更、500円と決済無効を保持。
- frontend/app/pages/commercial-disclosure.vue：販売者表記と条件表、表示の初期値、非同期取得。
- frontend/app/components/SiteFooter.vue：特商法リンクを常時表示。
- docs/commercial-disclosure-update.md：本記録。

混在している進捗ファイル・引き継ぎ原本と、他担当の作問/表示修正はローカルに保持し、今回のコミットへ含めない。ユーザーは上記の変更のコミット・pushを依頼済み。
