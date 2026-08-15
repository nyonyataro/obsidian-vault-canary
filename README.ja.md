# Vault Canary（日本語）

[English README](README.md)

Vault Canaryは、Obsidian Vaultの内容が予期せず大きく減ったときに知らせる、ローカル動作の早期警告プラグインです。

これはバックアップや復元機能ではありません。警告が出たら、Git、Obsidian Sync、OneDriveの履歴、その他のバックアップを確認して復旧してください。

## 何を監視するか

保存した基準値と現在の状態を、次の集計値だけで比較します。

- 表示中のファイル総数
- Markdownノート数
- 表示中のファイル合計容量

ファイルの内容は読みません。ネットワーク通信、テレメトリー、解析もありません。

## 警告の仕組み

起動後の待機時間、ファイルイベントのdebounce、警告cooldownを備えています。警告後に減った状態を自動で新しい基準値にはしません。

設定画面またはコマンドパレットから次を実行できます。

- **Vaultを今すぐ確認**：現在の状態を基準値と比較
- **現在のVault状態を基準値に設定**：現在の状態を正常として受け入れる

削除が意図したものだった場合でも、バックアップや同期状態を確認してから基準値を更新してください。

## 日本語対応

初期設定ではObsidianの表示言語に追従します。Obsidianが日本語なら、設定項目、警告、コマンド名が日本語になります。

設定画面の「表示言語」から、Obsidianに追従、日本語、Englishを選択できます。言語を変更した後は、コマンドパレットの名称を更新するためにプラグインを再読み込みしてください。

## 除外フォルダ

Vaultルートからの相対フォルダを1行に1つ指定できます。指定したフォルダ以下は集計から除外されます。除外範囲を変更すると、異なる対象範囲を比較しないよう基準値が消去されます。

## βテスト

Community Pluginsに掲載される前は、BRATまたは手動インストールで試せます。

手動QAは必ず捨てVaultで行ってください。手順は[日本語の手動テスト計画](docs/manual-test-plan.ja.md)、[英語の手動テスト計画](docs/manual-test-plan.md)、[リリースチェックリスト](docs/release-checklist.md)にあります。

## インストール

1. Releaseから`main.js`、`manifest.json`、`styles.css`を取得する。
2. `<Vault>/.obsidian/plugins/vault-canary/`へ3ファイルをコピーする。
3. ObsidianのCommunity pluginsでVault Canaryを有効化する。

## サポート

不具合報告は、Obsidianのバージョン、Vault Canaryのバージョン、再現手順を添えてください。個人Vaultのノート内容や未加工ログは添付しないでください。

開発を支援する場合は、[Buy Me a Coffee](https://buymeacoffee.com/nyonyataro)から任意で支援できます。支援によって機能制限が解除されることはありません。

## ライセンス

[MIT License](LICENSE)
