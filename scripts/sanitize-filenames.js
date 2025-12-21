// scripts/sanitize-filenames.js
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(process.cwd(), 'docs/日更')

// 这些在“文件名/URL”层面极易炸
const REPLACE_MAP = new Map([
  ['%', '％'],
  ['#', '＃'],
  ['?', '？'],
])

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (st.isFile() && p.endsWith('.md')) out.push(p)
  }
  return out
}

// 归一化文件名：
// 1) 去掉 .md 前的多余空格： "xxx  .md" / "xxx .md" -> "xxx.md"
// 2) 去掉末尾空白
// 3) 特殊字符替换（% # ? -> 全角）
function normalizeBaseName(base) {
  let n = base

  // 把 ".md" 前的空格清掉
  n = n.replace(/\s+\.md$/i, '.md')

  // 去掉末尾空白（保险）
  n = n.replace(/\s+$/g, '')

  // 替换危险字符
  for (const [a, b] of REPLACE_MAP.entries()) {
    n = n.split(a).join(b)
  }

  return n
}

if (!fs.existsSync(ROOT)) {
  console.log('ℹ️ docs/日更 not found, skip rename')
  process.exit(0)
}

const files = walk(ROOT).sort((a, b) => b.length - a.length)

let renamed = 0
let collisions = 0

for (const file of files) {
  const dir = path.dirname(file)
  const base = path.basename(file)
  const next = normalizeBaseName(base)

  if (next === base) continue

  let target = path.join(dir, next)

  // 重名冲突：追加稳定后缀
  if (fs.existsSync(target)) {
    collisions++
    const ext = path.extname(next)
    const stem = next.slice(0, -ext.length)
    target = path.join(dir, `${stem}__dup${ext}`)
  }

  fs.renameSync(file, target)
  renamed++
}

console.log(`✅ filename normalize done. renamed: ${renamed}, collisions: ${collisions}`)
