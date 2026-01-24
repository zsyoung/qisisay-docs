#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
// 确保这个路径和你本地 docs/日更 的物理路径完全一致
const TARGET_DIR = path.resolve(ROOT, "docs/日更"); 

function walkMdFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkMdFiles(p));
    else if (ent.isFile() && p.toLowerCase().endsWith(".md")) out.push(p);
  }
  return out;
}

function processContent(content, filePath) {
  const fileName = path.basename(filePath, ".md");
  // 关键：计算相对于 "docs/日更" 的路径 (例如 2026/01/0103xxx.md)
  const relative = path.relative(TARGET_DIR, filePath); 
  const parts = relative.split(path.sep);
  
  let dateStr = "";
  let cleanTitle = fileName;

  // 1. 适配你的目录结构 (parts[0]=年, parts[1]=月)
  if (parts.length >= 2) {
    const year = parts[0]; 
    // 匹配文件名开头的 MMDD (如 0103)
    const dateMatch = fileName.match(/^(\d{2})(\d{2})(.*)/);
    
    if (dateMatch) {
      dateStr = `${year}-${dateMatch[1]}-${dateMatch[2]}`;
      // 清洗标题：去掉开头的日期数字及符号
      cleanTitle = dateMatch[3].replace(/^[｜\-\s,，]+/, '').trim() || fileName;
    } else {
      // 兜底：如果文件名不含日期，用目录年份和月份，日设为 01
      const monthDir = parts[1].padStart(2, '0');
      dateStr = `${year}-${monthDir}-01`;
    }
  } else {
    // 彻底兜底：今天
    dateStr = new Date().toISOString().split('T')[0];
  }

  let body = content.trim();

  // 2. 彻底清理旧数据：移除旧 Frontmatter 和正文开头的所有一级标题
  body = body.replace(/^---[\s\S]*?---\n*/, '');
  body = body.replace(/^#\s+.+(\r?\n)*/, '');

  // 3. 重新组装：注入 date，正文加清洗后的 # 标题
  return `---\ndate: ${dateStr}\n---\n\n# ${cleanTitle}\n\n${body}`;
}

// 图片清理逻辑 (保持原有稳定性)
function isHttpUrl(u) { return /^https?:\/\//i.test(String(u || "").trim()); }
function isMacLocal(u) { return /^(?:file:\/\/\/)?\/Users\/.+/i.test(u); }
function isPlaceholderOrAnchor(u) { return !u || u.trim() === "#" || u.trim().startsWith("#"); }

function sanitizeImages(content) {
  return content.replace(/!\[([^\]]*)\]\(\s*([^)]+?)\s*\)/g, (match, alt, rawUrl) => {
    const url = rawUrl.trim();
    if (isHttpUrl(url)) return match;
    if (isPlaceholderOrAnchor(url) || isMacLocal(url)) return "";
    return match;
  });
}

function main() {
  const files = walkMdFiles(TARGET_DIR);
  if (files.length === 0) {
    console.log("⚠️ 路径错误：在 docs/日更 下没找到文件。请确认当前运行脚本的路径。");
    return;
  }

  let changedFiles = 0;
  for (const file of files) {
    const before = fs.readFileSync(file, "utf8");
    let after = sanitizeImages(before);
    after = processContent(after, file);
    if (after !== before) {
      fs.writeFileSync(file, after, "utf8");
      changedFiles += 1;
    }
  }
  console.log(`✅ 成功：已为 ${changedFiles} 篇文章注入 Date 并清洗标题。`);
}
main();