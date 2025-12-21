#!/usr/bin/env node
/**
 * sanitize-md-images.js (SAFE VERSION)
 *
 * Goal:
 * - Only remove image syntaxes that are known to break VitePress build:
 *   - Empty / placeholder images: ![](), ![](#...), ![](#)
 *   - Local absolute paths: /Users/..., file:///Users/..., Windows drives, Typora "#Users/..."
 * - NEVER delete http/https images (mdnice/OSS/etc). If it's remote, we keep it.
 *
 * A small removal report will be written to: sanitize-md-images.removed.log (repo root)
 */

const fs = require("fs");
const path = require("path");

const DOCS_DIR = path.resolve(process.cwd(), "docs");
const REPORT_PATH = path.resolve(process.cwd(), "sanitize-md-images.removed.log");

const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

function stripQueryHash(url) {
  return url.split("#")[0].split("?")[0];
}

function normalizeAngleWrapped(url) {
  const trimmed = String(url || "").trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isMacLocalPath(u) {
  // /Users/... or file:///Users/...
  return /^(?:file:\/\/\/)?\/Users\/.+/i.test(u);
}

function isWindowsLocalPath(u) {
  // C:\...  or C:/... or file:///C:/...
  return /^(?:file:\/\/\/)?[A-Za-z]:(?:\\|\/).+/.test(u);
}

function isPlaceholderOrAnchor(u) {
  // ![]() or ![](#) or ![](#anything) — includes Typora "#Users/..."
  if (!u) return true;
  if (u === "#") return true;
  if (u.startsWith("#")) return true;
  return false;
}

function looksLikeDirectoryAsImage(u) {
  // Some bad cases seen in VitePress temp import errors:
  // ![](/日更/2024/04)  or ![](docs/日更/2024/04)
  // Only delete if it DOES NOT look like a real image file.
  const clean = stripQueryHash(u).trim();

  // If it has image extension, it's an actual file, keep it.
  if (IMG_EXT_RE.test(clean)) return false;

  // Directory-ish patterns (allow trailing slash)
  if (/^(?:\.{0,2}\/)?docs\/日更\/\d{4}\/\d{2}\/?$/.test(clean)) return true;
  if (/^\/?日更\/\d{4}\/\d{2}\/?$/.test(clean)) return true;

  return false;
}

/**
 * Replace Markdown images ![alt](url) by predicate(url, alt) => true remove
 * NOTE: this is a pragmatic regex (typical URLs). It won't perfectly parse nested parentheses.
 */
function removeMarkdownImageByUrlPredicate(content, predicate, report, filePath) {
  return content.replace(/!\[([^\]]*)\]\(\s*([^)]+?)\s*\)/g, (m, alt, rawUrl) => {
    const url = normalizeAngleWrapped(rawUrl);

    // NEVER delete remote images
    if (isHttpUrl(url)) return m;

    if (predicate(url, alt)) {
      report.push(`[MD] ${filePath}: ${m}`);
      return "";
    }
    return m;
  });
}

/**
 * Replace HTML images <img ... src="..."> by predicate(src) => true remove
 */
function removeHtmlImageBySrcPredicate(content, predicate, report, filePath) {
  // Handles src="..." and src='...'
  return content.replace(
    /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi,
    (m, quote, rawSrc) => {
      const src = normalizeAngleWrapped(rawSrc);

      // NEVER delete remote images
      if (isHttpUrl(src)) return m;

      if (predicate(src)) {
        report.push(`[HTML] ${filePath}: ${m}`);
        return "";
      }
      return m;
    }
  );
}

function cleanupEmptyImageLines(content) {
  // Remove lines that are just whitespace (created by deletions)
  // Keep paragraph spacing reasonable
  return content
    .replace(/^[ \t]+\n/gm, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function sanitizeContent(input, report, filePath) {
  let content = input;

  // 1) Remove placeholder / anchor images (Markdown)
  content = removeMarkdownImageByUrlPredicate(
    content,
    (url) => isPlaceholderOrAnchor(String(url || "").trim()),
    report,
    filePath
  );

  // 2) Remove Typora weird anchors: ![](#Users/.../typora-user-images/xxx.png)
  // Already covered by startsWith("#"), keep explicit for clarity (no-op if already removed).

  // 3) Remove macOS local absolute paths in Markdown images
  content = removeMarkdownImageByUrlPredicate(
    content,
    (url) => isMacLocalPath(String(url || "").trim()),
    report,
    filePath
  );

  // 4) Remove Windows local paths in Markdown images
  content = removeMarkdownImageByUrlPredicate(
    content,
    (url) => isWindowsLocalPath(String(url || "").trim()),
    report,
    filePath
  );

  // 5) Remove "directory as image" in Markdown images
  content = removeMarkdownImageByUrlPredicate(
    content,
    (url) => looksLikeDirectoryAsImage(String(url || "").trim()),
    report,
    filePath
  );

  // 6) HTML <img src="...">: remove the same bad local/placeholder patterns
  content = removeHtmlImageBySrcPredicate(
    content,
    (src) => {
      const s = String(src || "").trim();
      if (isPlaceholderOrAnchor(s)) return true;
      if (isMacLocalPath(s)) return true;
      if (isWindowsLocalPath(s)) return true;
      if (looksLikeDirectoryAsImage(s)) return true;
      return false;
    },
    report,
    filePath
  );

  content = cleanupEmptyImageLines(content);
  return content;
}

function walkDir(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkDir(p));
    else if (ent.isFile() && p.toLowerCase().endsWith(".md")) out.push(p);
  }
  return out;
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`❌ docs dir not found: ${DOCS_DIR}`);
    process.exit(1);
  }

  const files = walkDir(DOCS_DIR);
  let changed = 0;
  const removedReport = [];

  for (const file of files) {
    const before = fs.readFileSync(file, "utf8");
    const after = sanitizeContent(before, removedReport, path.relative(process.cwd(), file));

    if (after !== before) {
      fs.writeFileSync(file, after, "utf8");
      changed += 1;
    }
  }

  // Write report (useful when someone says "my image disappeared")
  try {
    if (removedReport.length > 0) {
      fs.writeFileSync(REPORT_PATH, removedReport.join("\n") + "\n", "utf8");
    } else {
      // keep repo clean: remove old report if nothing removed this run
      if (fs.existsSync(REPORT_PATH)) fs.unlinkSync(REPORT_PATH);
    }
  } catch (e) {
    // report is optional; ignore
  }

  console.log(`✅ sanitize done. changed files: ${changed}`);
  if (removedReport.length > 0) {
    console.log(`🧾 removal report: ${path.relative(process.cwd(), REPORT_PATH)} (${removedReport.length} entries)`);
  }
}

main();
