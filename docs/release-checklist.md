# Vault Canary リリースチェックリスト

## 自動検証

- [ ] `npm ci`
- [ ] `npm run check`
- [ ] `npm run release:check`
- [ ] `main.js` が200 KB未満
- [ ] `package.json`、`manifest.json`、`versions.json`のバージョンが一致
- [ ] `manifest.json`の`minAppVersion`がCommunity Pluginの要件を満たす
- [ ] `manifest.json`の`fundingUrl`と`.github/FUNDING.yml`がBuy Me a Coffeeを指している
- [ ] `main.js`、`manifest.json`、`styles.css`がリリース成果物として存在する

## ベータ公開前

- [ ] Desktopの捨てVaultで手動QAを完了
- [ ] 日本語UIで設定画面、警告、baseline操作を確認
- [ ] English UIで設定画面、警告、baseline操作を確認
- [ ] 警告後に小さい状態が自動でbaselineにならないことを確認
- [ ] 復元後に手動チェックで警告状態が解消することを確認
- [ ] 除外フォルダ、容量減少、変更ファイルのテストを完了
- [ ] AndroidまたはiOSの捨てVaultで起動・設定・削除検知を確認
- [ ] privateなVault内容をIssue、ログ、スクリーンショットに含めていない

## バージョン更新

1. `npm version 0.1.1 --no-git-tag-version`のように、次のsemverを指定する。
2. `version` lifecycleで`manifest.json`と`versions.json`が更新されたことを確認する。
3. `npm run check`と`npm run release:check`を実行する。
4. 差分を確認してcommitする。
5. `0.1.1`のように`v`なしのタグをcommitへ付けてpushする。

タグpushでDraft Release workflowが実行され、検証後に`main.js`、`manifest.json`、`styles.css`がDraft Releaseへ添付される。Draftの内容と変更履歴を確認してから、手動で公開する。

## Community Plugins申請前

- [ ] BRATでベータ版を試して重大な問題がない
- [ ] README、手動QA、Privacy、Limitationsが現行挙動と一致している
- [ ] Draft Releaseを公開版へ切り替えた
- [ ] Community Plugins申請に使うrepository、manifest、release assetを再確認した
