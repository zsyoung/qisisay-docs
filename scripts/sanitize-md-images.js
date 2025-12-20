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
  // A) 本机绝对路径资源（Markdown 括号）
  content = content.replace(
    /\((file:\/\/\/)?\/Users\/[^\)\s]+\.(png|jpg|jpeg|gif|webp)\)/gi,
    '(#)'
  )

  // B) 本机绝对路径资源（HTML 属性：有引号）
  content = content.replace(
    /\b(src|href)=(["'])(file:\/\/\/)?\/Users\/[^"']+\.(png|jpg|jpeg|gif|webp)\2/gi,
    '$1=$2#$2'
  )

  // C) Markdown 内的空链接 / 只有 ./ / 只有 / / 空括号
  //    兼容 () 以及 (<...>) 写法
  content = content.replace(/\]\(\s*<\s*\.\/\s*>\s*\)/g, '](#)')
  content = content.replace(/\]\(\s*<\s*\/\s*>\s*\)/g, '](#)')
  content = content.replace(/\]\(\s*<\s*>\s*\)/g, '](#)')

  content = content.replace(/\]\(\s*\.\/\s*\)/g, '](#)')
  content = content.replace(/\]\(\s*\/\s*\)/g, '](#)')
  content = content.replace(/\]\(\s*\)/g, '](#)')

  // D) HTML 属性：src/href="./"、src/href="/"、src/href=""（有引号）
  content = content.replace(/\b(src|href)=(["'])(\s*\.\/\s*)\2/gi, '$1=$2#$2')
  content = content.replace(/\b(src|href)=(["'])(\s*\/\s*)\2/gi, '$1=$2#$2')
  content = content.replace(/\b(src|href)=(["'])(\s*)\2/gi, '$1=$2#$2')

  // E) HTML 属性：src=./ 或 href=./（无引号，含多余空格也兜住）
  content = content.replace(/\b(src|href)=\s*\.\/\b/gi, '$1=#')
  content = content.replace(/\b(src|href)=\s*\/\b/gi, '$1=#')

  // F) 参考式链接定义：[xxx]: ./   或 [xxx]: /   或 [xxx]:
  //    这类最容易导致 rollup 解析 ./ 失败
  content = content.replace(/^(\[[^\]]+\]:)\s*\.\/\s*$/gim, '$1 #')
  content = content.replace(/^(\[[^\]]+\]:)\s*\/\s*$/gim, '$1 #')
  content = content.replace(/^(\[[^\]]+\]:)\s*$/gim, '$1 #')

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
