const fs = require('fs')
const path = require('path')

const TIMELINE_DIR = path.resolve(process.cwd(), 'docs/timeline')
const OUTPUT = path.resolve(process.cwd(), 'docs/latest.md')

let items = []

const files = fs.readdirSync(TIMELINE_DIR)
  .filter(f => /^\d{4}\.md$/.test(f))

files.forEach(file => {
  const year = Number(file.replace('.md', ''))
  const content = fs.readFileSync(path.join(TIMELINE_DIR, file), 'utf-8')
  const lines = content.split('\n')

  lines.forEach(line => {
    // 匹配：- **12-19｜xxx**
    const match = line.match(/- \*\*(\d{2})-(\d{2})｜(.+)\*\*/)
    if (!match) return

    const [, mm, dd, rest] = match

    items.push({
      year,
      month: Number(mm),
      day: Number(dd),
      line: `- **${mm}-${dd}｜${rest}**`
    })
  })
})

// 关键：真正的时间倒序
items.sort((a, b) => {
  if (a.year !== b.year) return b.year - a.year
  if (a.month !== b.month) return b.month - a.month
  return b.day - a.day
})

const latest = items.slice(0, 7)

let md = "" // 去掉标题
latest.forEach(item => {
  md += `${item.line}\n`
})

fs.writeFileSync(OUTPUT, md, 'utf-8')
console.log('✅ 最近更新已按真实时间倒序生成')
