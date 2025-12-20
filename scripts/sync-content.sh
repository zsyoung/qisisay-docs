#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

# 目标目录：保证是干净的真实目录
rm -rf "docs/日更"
mkdir -p "docs/日更"

# 同步源文章到发布目录
rsync -a "日更/" "docs/日更/"
