#!/usr/bin/env bash
set -euo pipefail

# ====== 配置区 ======
REPO_DIR="/Users/mlamp/Library/CloudStorage/OneDrive-个人/write"
BRANCH="main"
LOG_DIR="$HOME/Library/Logs"
LOG_FILE="$LOG_DIR/qisisay-autopublish.log"
LOCK_FILE="/tmp/qisisay-autopublish.lock"
# ====================

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# 防并发
if [ -f "$LOCK_FILE" ]; then
  log "Lock exists, skip."
  exit 0
fi
touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

cd "$REPO_DIR"

# 补齐 PATH（LaunchAgent 环境变量很干净）
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# 只在指定分支工作
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  log "Current branch is $CURRENT_BRANCH, expected $BRANCH. Skip."
  exit 0
fi

# 若完全无改动，退出
if [ -z "$(git status --porcelain)" ]; then
  log "No changes. Done."
  exit 0
fi

log "Changes detected. Running pipeline..."

# ===== 流水线 =====
bash scripts/sync-content.sh

# ===== 草稿剔除（关键）：源稿前 5 行有 #draft，则从 docs 构建输入移除（只删 docs，不动源稿）=====
# 这样本地 npm run docs:build 也不会生成草稿页面
find "$REPO_DIR/日更" -type f -name "*.md" -print0 \
| while IFS= read -r -d '' src; do
    if head -n 5 "$src" 2>/dev/null | rg -qi '^#draft'; then
      rel="${src#"$REPO_DIR/日更/"}"
      dst="$REPO_DIR/docs/日更/$rel"
      rm -f "$dst"
      log "Draft removed from docs build input: $rel"
    fi
  done
# ================================================================================================

node scripts/sanitize-filenames.js
node scripts/sanitize-md-images.js
node scripts/generate-timeline.js
node scripts/generate-tags.js
node scripts/generate-latest.js

rm -rf docs/.vitepress/.temp docs/.vitepress/cache
npm run docs:build

# 暂存全部
git add -A

# ======（可选保险）草稿排除：含 #draft 的源稿不提交（但其它照发）======
# 这段不是必须（因为上面已经从 docs 输入删了），但保留能防止误提交源稿目录里的草稿
DRAFT_SRC_FILES="$(
  find "$REPO_DIR/日更" -type f -name "*.md" -print0 \
  | while IFS= read -r -d '' f; do
      head -n 5 "$f" 2>/dev/null | rg -qi '^#draft' && echo "$f" || true
    done
)"

if [ -n "${DRAFT_SRC_FILES:-}" ]; then
  log "Draft source files detected (will NOT be committed):"
  echo "$DRAFT_SRC_FILES" | tee -a "$LOG_FILE"

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    rel="${f#"$REPO_DIR/"/}"
    git reset -q -- "$rel" || true
  done <<< "$DRAFT_SRC_FILES"
fi
# =================================================================

# 如果此时没有可提交内容，就退出（避免空提交）
if [ -z "$(git diff --cached --name-only)" ]; then
  log "Nothing to commit after excluding drafts. Done."
  exit 0
fi

MSG="auto: publish $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$MSG"
git push origin "$BRANCH"

log "Pushed to $BRANCH. GitHub Actions will deploy."
