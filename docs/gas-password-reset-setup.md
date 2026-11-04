# パスワード再設定メール（未設定）

本サービスでは `PASSWORD_RESET_ENABLED=false` とし、送信用GAS URL・秘密値は未設定です。日本史ラボの送信設定は流用しません。

将来設定するときは本サービス専用のGASプロジェクト、共有秘密値、接続先を用意します。ローカルの `FRONTEND_URL` は `http://localhost:3400` です。公開URLは未作成です。

汎用スクリプトは `frontend/automation/password-reset/Code.gs`。メール送信・公開・GAS設定は今回の初期構築の範囲外です。
