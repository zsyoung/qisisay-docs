#!/usr/bin/env bash
set -euo pipefail

# ====== 路径配置 ======
SOURCE_DIR="/Users/mlamp/Library/CloudStorage/OneDrive-个人/write/日更"
TARGET_DIR="$(pwd)/docs/日更"
# =====================

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

rsync -a --delete "$SOURCE_DIR/" "$TARGET_DIR/"
