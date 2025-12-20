// scripts/sanitize-filenames.js
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(process.cwd(), 'docs/日更')

// 文件名里这些字符最容易导致 VitePress/路由 decodeURIComponent 崩：% # ?
// 用全角替换，显示几乎不变，URL/构建稳定
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

function safeBaseName(base) {
  let n = base
  for (const [a, b] of REPLACE_MAP.entries()) n = n.split(a).join(b)
  return n
}

if (!fs.existsSync(ROOT)) {
  console.log('ℹ️ docs/日更 not found, skip rename')
  process.exit(0)
}

const files = walk(ROOT)

// 先按路径长度倒序，避免极端情况下的覆盖问题
files.sort((a, b) => b.length - a.length)

let renamed = 0
let collisions = 0

for (const file of files) {
  const dir = path.dirname(file)
  const base = path.basename(file)
  const next = safeBaseName(base)
  if (next === base) continue

  let target = path.join(dir, next)

  // 如果重名，追加一个稳定后缀
  if (fs.existsSync(target)) {
    collisions++
    const ext = path.extname(next)
    const stem = next.slice(0, -ext.length)
    target = path.join(dir, `${stem}__dup${ext}`)
  }

  fs.renameSync(file, target)
  renamed++
}

console.log(`✅ filename sanitize done. renamed: ${renamed}, collisions: ${collisions}`)
