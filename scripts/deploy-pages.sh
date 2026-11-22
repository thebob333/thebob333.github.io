#!/usr/bin/env bash
# Build TELOS and publish it to GitHub Pages (the `gh-pages` branch of `origin`).
# Live at https://thebob333.github.io/ — run with `npm run deploy`.
set -euo pipefail

cd "$(dirname "$0")/.."
REMOTE_URL="$(git remote get-url origin)"
COMMIT="$(git rev-parse --short HEAD)"

npm run build

# GitHub Pages serves 404.html for unknown paths — make it the app, so
# opening /plan or /gym directly (or refreshing there) still works.
cp dist/index.html dist/404.html
# Serve files as-is (no Jekyll processing).
touch dist/.nojekyll

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="TELOS deploy" -c user.email="deploy@users.noreply.github.com" commit -q -m "Deploy ${COMMIT}"
git push -q --force "$REMOTE_URL" gh-pages
echo "Published ${COMMIT} → https://thebob333.github.io/ (live in about a minute)"
