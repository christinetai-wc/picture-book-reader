#!/bin/sh
# 把 app/ 推到 gh-pages 分支（GitHub Pages 從這個分支發布）
set -e
cd "$(dirname "$0")/.."
git push origin main
git push origin "$(git subtree split --prefix app main)":refs/heads/gh-pages --force
