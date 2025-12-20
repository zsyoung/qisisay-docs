#!/bin/bash
set -e

# 进入仓库根目录（可选：保证从任何位置运行都正确）
cd "$(dirname "$0")/.."

# 同步“源日更”到“发布日更”
rsync -a --delete "日更/" "docs/日更/"
