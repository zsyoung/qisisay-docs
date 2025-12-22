#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# ====== 源稿目录选择（本地优先 OneDrive；CI 回退到仓库内 日更/） ======
ONEDRIVE_DAILY="/Users/mlamp/Library/CloudStorage/OneDrive-个人/write/日更"
REPO_DAILY="$(pwd)/日更"

if [ -d "$ONEDRIVE_DAILY" ]; then
  SOURCE_DIR="$ONEDRIVE_DAILY"
else
  SOURCE_DIR="$REPO_DAILY"
fi

TARGET_DIR="$(pwd)/docs/日更"
# =====================================================================

# 目标目录：保证是干净的真实目录
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

# 同步源文章到发布目录
rsync -a --delete "$SOURCE_DIR/" "$TARGET_DIR/"

echo "✅ sync-content done. source: $SOURCE_DIR -> target: $TARGET_DIR"
