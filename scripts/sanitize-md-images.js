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
  // 1) 任何 /Users/... 本机路径（Markdown 链接/图片）
  //    例如: ![](/Users/...png) 或 ![](file:///Users/...png)
  content = content.replace(
    /\((\s*)(file:\/\/\/)?\/Users\/[^\)\s]+(\s*)\)/gi,
    '(#)'
  )

  // 2) 任何 /Users/... 本机路径（HTML src/href，有无引号都兜）
  content = content.replace(
    /\b(src|href)\s*=\s*(["']?)\s*(file:\/\/\/)?\/Users\/[^"'\s>]+\s*\2/gi,
    '$1="#"'
  )

  // 3) 兜底：任何形式的 "./" 作为 URL（Markdown 括号形式，带 title 也算）
  //    ](./)  ](./ "t")  ](<./>)  ![](./)
  content = content.replace(/\]\(\s*<\s*\.\/\s*>\s*([^\)]*)\)/g, '](#$1)')
  content = content.replace(/\]\(\s*\.\/\s*([^\)]*)\)/g, '](#$1)')

  // 4) 参考式链接定义：[id]: ./   或 [id]: ./ "title"
  content = content.replace(/^(\[[^\]]+\]:)\s*\.\/\s*(.*)$/gim, '$1 # $2')

  // 5) HTML src/href="./" 或 src/href=./（有无引号都兜）
  content = content.replace(/\b(src|href)\s*=\s*(["'])\s*\.\/\s*\2/gi, '$1=$2#$2')
  content = content.replace(/\b(src|href)\s*=\s*\.\/\b/gi, '$1=#')

  // 6) 再兜底：空链接 / 只有 /（防止下一轮又炸）
  content = content.replace(/\]\(\s*\)/g, '](#)')
  content = content.replace(/\]\(\s*\/\s*([^\)]*)\)/g, '](#$1)')
  content = content.replace(/\b(src|href)\s*=\s*(["'])\s*\2/gi, '$1=$2#$2')
  content = content.replace(/\b(src|href)\s*=\s*\/\b/gi, '$1=#')

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
