# リリース手順(メンテナ向け)

## ローカルでインストーラーをビルドする

[electron-builder](https://www.electron.build/) を使ってWindows用インストーラー(NSIS、.exe)を生成できます。

```bash
npm run dist:win
```

生成物は `dist/` に出力されます(Gitには含まれません)。

## GitHub Releasesへの自動公開

`v` から始まるタグ(例: `v0.2.0`)をpushすると、GitHub Actions(`.github/workflows/release.yml`)がWindows用インストーラーをビルドし、自動的に [Releases](https://github.com/yooogeee16/concierge/releases) に公開します。

```bash
npm version patch   # package.jsonのversionを更新(必要に応じて minor / major)
git push
git tag v$(node -p "require('./package.json').version")
git push origin --tags
```
