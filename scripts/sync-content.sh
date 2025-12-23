#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ONEDRIVE_DAILY="/Users/mlamp/Library/CloudStorage/OneDrive-个人/write/日更"
REPO_DAILY="$(pwd)/日更"
DOCS_DAILY="$(pwd)/docs/日更"

# CI：没有 OneDrive，就只能用 repo/日更 → docs/日更
if [ ! -d "$ONEDRIVE_DAILY" ]; then
  echo "[sync-content] CI mode: repo(日更) -> docs/日更"
  rm -rf "$DOCS_DAILY"
  mkdir -p "$DOCS_DAILY"
  rsync -a --delete "$REPO_DAILY/" "$DOCS_DAILY/"
  exit 0
fi

# 本地：OneDrive 为真源，同步到 repo/日更（用于提交给 CI）
echo "[sync-content] local mode: onedrive(日更) -> repo(日更) + docs/日更"

rm -rf "$REPO_DAILY"
mkdir -p "$REPO_DAILY"
rsync -a --delete "$ONEDRIVE_DAILY/" "$REPO_DAILY/"

rm -rf "$DOCS_DAILY"
mkdir -p "$DOCS_DAILY"
rsync -a --delete "$REPO_DAILY/" "$DOCS_DAILY/"

echo "[sync-content] done"
