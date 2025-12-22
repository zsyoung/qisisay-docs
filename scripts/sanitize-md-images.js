#!/usr/bin/env node
/**
 * sanitize-md-images.js (COVER VERSION / SAFE)
 *
 * ✅ 目标：只清理“会炸 VitePress 的本地/占位图片”，绝不动任何 http/https 外链图片
 *
 * 会被删除（仅删除整条图片语法，不会动正文其它内容）：
 * 1) 本地绝对路径（macOS）:
 *    ![](/Users/...)
 *    ![](file:///Users/...)
 * 2) Typora 伪链接（常见）：#Users/...typora-user-images/...
 *    ![](#Users/...)
 *    ![]( #Users/... )
 * 3) Windows 本地路径：
 *    ![](C:\...)
 *    ![](file:///C:/...)
 * 4) 空/占位：
 *    ![]()
 *    ![]( )
 *    ![](#)
 *    ![](#anything)
 *
 * ✅ 绝不处理（完全保留）：
 * - 所有 http/https 图片（包括 files.mdnice.com/user/... 这类）
 * - 带 %、带 querystring 的外链
 * - 相对路径图片（./img/a.png、/img/a.png）
 *
 * 额外：
 * - 输出删除报告：sanitize-md-images.removed.log（便于追查“哪张图被删了”）
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIR = path.resolve(ROOT, "docs"); // 你的流水线是在 sync -> sanitize -> build，所以处理 docs 最合理
const REPORT_PATH = path.resolve(ROOT, "sanitize-md-images.removed.log");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function walkMdFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkMdFiles(p));
    else if (ent.isFile() && p.toLowerCase().endsWith(".md")) out.push(p);
  }
  return out;
}

function isHttpUrl(u) {
  return /^https?:\/\//i.test(String(u || "").trim());
}

function normalizeAngleWrapped(u) {
  const s = String(u || "").trim();
  if (s.startsWith("<") && s.endsWith(">")) return s.slice(1, -1).trim();
  return s;
}

function isMacLocal(u) {
  // /Users/... or file:///Users/...
  return /^(?:file:\/\/\/)?\/Users\/.+/i.test(u);
}

function isWindowsLocal(u) {
  // C:\... or C:/... or file:///C:/...
  return /^(?:file:\/\/\/)?[A-Za-z]:(?:\\|\/).+/.test(u);
}

function isPlaceholderOrAnchor(u) {
  // empty, "#", "#xxx" (includes "#Users/..." from Typora)
  const s = String(u || "").trim();
  if (!s) return true;
  if (s === "#") return true;
  if (s.startsWith("#")) return true;
  return false;
}

/**
 * Pragmatic Markdown image regex: ![alt](url)
 * Not perfect for nested parentheses, but works for typical links.
 */
function sanitizeMarkdownImages(content, fileRelPath, removed) {
  return content.replace(/!\[([^\]]*)\]\(\s*([^)]+?)\s*\)/g, (match, alt, rawUrl) => {
    const url = normalizeAngleWrapped(rawUrl);

    // ✅ 任何外链图片一律不动（核心保证：不会误删 /user/ 这种）
    if (isHttpUrl(url)) return match;

    // ✅ 只删除明确危险/占位/本地路径
    if (isPlaceholderOrAnchor(url) || isMacLocal(url) || isWindowsLocal(url)) {
      removed.push(`[MD] ${fileRelPath}: ${match}`);
      return "";
    }

    return match;
  });
}

/**
 * HTML img tag sanitize: <img ... src="...">
 */
function sanitizeHtmlImages(content, fileRelPath, removed) {
  return content.replace(
    /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi,
    (match, quote, rawSrc) => {
      const src = normalizeAngleWrapped(rawSrc);

      // ✅ 外链不动
      if (isHttpUrl(src)) return match;

      if (isPlaceholderOrAnchor(src) || isMacLocal(src) || isWindowsLocal(src)) {
        removed.push(`[HTML] ${fileRelPath}: ${match}`);
        return "";
      }
      return match;
    }
  );
}

function cleanupBlankLines(content) {
  // 删除图片行后可能留下多余空行，做个轻量清理
  return content
    .replace(/^[ \t]+\n/gm, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function main() {
  if (!fs.existsSync(TARGET_DIR)) {
    console.error(`❌ target dir not found: ${TARGET_DIR}`);
    process.exit(1);
  }

  const files = walkMdFiles(TARGET_DIR);
  let changedFiles = 0;
  const removed = [];

  for (const file of files) {
    const before = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);

    let after = before;
    after = sanitizeMarkdownImages(after, rel, removed);
    after = sanitizeHtmlImages(after, rel, removed);
    after = cleanupBlankLines(after);

    if (after !== before) {
      fs.writeFileSync(file, after, "utf8");
      changedFiles += 1;
    }
  }

  // report
  try {
    if (removed.length > 0) {
      fs.writeFileSync(REPORT_PATH, removed.join("\n") + "\n", "utf8");
      console.log(`🧾 removal report: ${path.relative(ROOT, REPORT_PATH)} (${removed.length} entries)`);
    } else {
      if (fs.existsSync(REPORT_PATH)) fs.unlinkSync(REPORT_PATH);
    }
  } catch {
    // ignore report errors
  }

  console.log(`✅ sanitize done. changed files: ${changedFiles}`);
}

main();
