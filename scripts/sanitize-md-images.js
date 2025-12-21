#!/usr/bin/env node
/**
 * sanitize-md-images.js
 *
 * What it does:
 * - Remove invalid / local / placeholder image references in Markdown that can break VitePress build.
 * - Only touches image syntax: ![](...) and <img ... src="...">. It will NOT rewrite normal links [](...).
 *
 * Handles:
 * - ![](#) / ![](#anything) / ![]()
 * - Typora weird: ![](#Users/.../typora-user-images/xxx.png)
 * - macOS local: ![](/Users/...) and ![](file:///Users/...)
 * - Windows local: ![](C:\...) / ![](file:///C:/...)
 * - Directory-as-image: ![](/日更/2024/04) / ![](docs/日更/2024/04) etc.
 * - Generic: non-http(s) image url WITHOUT image extension (png/jpg/jpeg/gif/webp/svg/avif) => remove
 */

const fs = require("fs");
const path = require("path");

const DOCS_DIR = path.resolve(process.cwd(), "docs");

// Extensions considered valid image files
const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

function stripQueryHash(url) {
  // remove ?query and #hash for extension detection
  return url.split("#")[0].split("?")[0];
}

function normalizeAngleWrapped(url) {
  // Markdown sometimes allows <...> around URL
  const trimmed = url.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Remove a markdown image occurrence ![alt](url)
 * - Works for inline occurrences inside a line.
 */
function removeMarkdownImageByUrlPredicate(content, predicate) {
  // Captures: alt text + url (no nested ')' handling; OK for typical image urls)
  return content.replace(/!\[([^\]]*)\]\(\s*([^)]+?)\s*\)/g, (m, alt, rawUrl) => {
    const url = normalizeAngleWrapped(rawUrl);
    return predicate(url, alt) ? "" : m;
  });
}

/**
 * Remove entire line if the line contains only an image (and whitespace).
 * This helps keep clean formatting.
 */
function removeStandaloneImageLines(content) {
  // Remove lines that become just whitespace after deletions
  return content.replace(/^[ \t]*\n/gm, "");
}

function sanitizeContent(input) {
  let content = input;
  const original = content;

  // 0) Remove HTML <img ... src="..."> with invalid/local/placeholder src
  content = content.replace(
    /<img\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>/gi,
    (m, quote, src) => {
      const url = normalizeAngleWrapped(String(src || "").trim());
      if (!url) return ""; // empty src

      // placeholder / hash
      if (url === "#" || url.startsWith("#")) return "";

      // mac local
      if (/^(?:file:\/\/\/)?\/Users\//i.test(url)) return "";

      // typora #Users/...
      if (/^#\s*Users\//i.test(url) || /^#Users\//i.test(url)) return "";

      // windows local
      if (/^(?:file:\/\/\/)?[A-Za-z]:[\\/]/.test(url)) return "";

      // non-http without img ext => remove
      if (!isHttpUrl(url)) {
        const clean = stripQueryHash(url);
        if (!IMG_EXT_RE.test(clean)) return "";
      }

      return m;
    }
  );

  // 1) Kill Markdown placeholder images: ![](#...), ![](#), ![]()
  //    Do NOT touch normal links [](#...) — only images.
  content = removeMarkdownImageByUrlPredicate(content, (url) => {
    const u = url.trim();
    if (!u) return true;            // ![]()
    if (u === "#") return true;     // ![](#)
    if (u.startsWith("#")) return true; // ![](#anything) incl #Users/...
    return false;
  });

  // 2) Kill macOS local absolute paths in Markdown image urls
  //    - /Users/...
  //    - file:///Users/...
  content = removeMarkdownImageByUrlPredicate(content, (url) => {
    return /^(?:file:\/\/\/)?\/Users\/.+/i.test(url.trim());
  });

  // 3) Kill Windows local paths in Markdown image urls
  //    - C:\...
  //    - C:/...
  //    - file:///C:/...
  content = removeMarkdownImageByUrlPredicate(content, (url) => {
    return /^(?:file:\/\/\/)?[A-Za-z]:[\\/].+/.test(url.trim());
  });

  // 4) Kill directory-as-image patterns (your current VitePress killer)
  // Examples:
  // - ![](/日更/2024/04)
  // - ![](docs/日更/2024/04)
  // - ![](./docs/日更/2024/04)
  // - ![](../docs/日更/2024/04)
  // Any of these without extension should be removed.
  content = removeMarkdownImageByUrlPredicate(content, (url) => {
    const u = normalizeAngleWrapped(url);
    const clean = stripQueryHash(u);

    // If it already has a valid image extension, keep it
    if (IMG_EXT_RE.test(clean)) return false;

    // Explicit directory forms for 日更/YYYY/MM
    if (/^(?:\.{0,2}\/)?docs\/日更\/\d{4}\/\d{2}\/?$/.test(clean)) return true;
    if (/^\/?日更\/\d{4}\/\d{2}\/?$/.test(clean)) return true;

    return false;
  });

  // 5) Generic guardrail:
  // If it's a Markdown image, and url is NOT http(s),
  // and url has NO recognized image extension => remove.
  // This prevents future weird relative paths like ![](./2024/04) etc.
  content = removeMarkdownImageByUrlPredicate(content, (url) => {
    const u = normalizeAngleWrapped(url);
    if (isHttpUrl(u)) return false;

    const clean = stripQueryHash(u);
    // Allow data URLs (rare, but valid)
    if (/^data:image\//i.test(clean)) return false;

    // If it has an image extension, keep
    if (IMG_EXT_RE.test(clean)) return false;

    // Otherwise remove (directory, bare path, etc.)
    return true;
  });

  // 6) Cleanup: collapse excessive blank lines (optional but keeps markdown tidy)
  // - convert 3+ newlines to 2
  content = content.replace(/\n{3,}/g, "\n\n");

  // Remove now-empty image-only lines
  content = removeStandaloneImageLines(content);

  return content === original ? input : content;
}

function walkDir(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip VitePress internals just in case
      if (e.name === ".vitepress") continue;
      out.push(...walkDir(full));
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
      out.push(full);
    }
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

  for (const file of files) {
    const before = fs.readFileSync(file, "utf8");
    const after = sanitizeContent(before);

    if (after !== before) {
      fs.writeFileSync(file, after, "utf8");
      changed += 1;
    }
  }

  console.log(`✅ sanitize done. changed files: ${changed}`);
}

main();
