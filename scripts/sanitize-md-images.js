// scripts/sanitize-md-images.js
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(process.cwd(), 'docs/日更')

// 只处理 markdown
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (st.isFile() && p.endsWith('.md')) out.push(p)
  }
  return out
}

// 把本机绝对路径 / file:// 图片引用替换掉
function sanitize(content) {
  // 1) Markdown 图片/链接里出现 (/Users/..)
  content = content.replace(/\((file:\/\/\/)?\/Users\/[^\)]+\.(png|jpg|jpeg|gif|webp)\)/gi, '(#)')

  // 2) HTML img src="/Users/.."
  content = content.replace(/src=(["'])(file:\/\/\/)?\/Users\/[^"']+\.(png|jpg|jpeg|gif|webp)\1/gi, 'src=$1#$1')

  return content
}

const files = fs.existsSync(ROOT) ? walk(ROOT) : []
let changed = 0

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8')
  const fixed = sanitize(raw)
  if (fixed !== raw) {
    fs.writeFileSync(f, fixed, 'utf8')
    changed++
  }
}

console.log(`✅ sanitize done. changed files: ${changed}`)
