// scripts/sanitize-md-images.js
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(process.cwd(), 'docs/日更')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (st.isFile() && p.endsWith('.md')) out.push(p)
  }
  return out
}

function sanitize(content) {
  // A) 本机绝对路径资源（Markdown 链接/图片）
  content = content.replace(
    /\((file:\/\/\/)?\/Users\/[^\)]+\.(png|jpg|jpeg|gif|webp)\)/gi,
    '(#)'
  )

  // B) 本机绝对路径资源（HTML img/src/href）
  content = content.replace(
    /\b(src|href)=(["'])(file:\/\/\/)?\/Users\/[^"']+\.(png|jpg|jpeg|gif|webp)\2/gi,
    '$1=$2#$2'
  )

  // C) 处理空链接、只有 ./、只有 / 的情况（Markdown）
  //    例如: ![](./)  [](./)  ![](/)  []()  ![]()
  content = content.replace(/\]\(\s*\.\/*\s*\)/g, '](#)')
  content = content.replace(/\]\(\s*\/\s*\)/g, '](#)')
  content = content.replace(/\]\(\s*\)/g, '](#)')

  // D) 处理 HTML 里 src/href="./" 或 src/href="" 或 src/href="/"
  content = content.replace(/\b(src|href)=(["'])(\s*\.\/\s*)\2/gi, '$1=$2#$2')
  content = content.replace(/\b(src|href)=(["'])(\s*)\2/gi, '$1=$2#$2')
  content = content.replace(/\b(src|href)=(["'])(\s*\/\s*)\2/gi, '$1=$2#$2')

  return content
}

if (!fs.existsSync(ROOT)) {
  console.log('ℹ️ docs/日更 not found, skip sanitize')
  process.exit(0)
}

const files = walk(ROOT)
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
