const fs = require('fs')
const path = require('path')

const TIMELINE_DIR = path.resolve(process.cwd(), 'docs/timeline')
const TAG_DIR = path.resolve(process.cwd(), 'docs/timeline/tags')

const TAGS = ['周报', 'ETF', '港股', '恒生', '动量', '复盘']

let tagMap = {}
TAGS.forEach(tag => tagMap[tag] = [])

const files = fs.readdirSync(TIMELINE_DIR)
  .filter(f => /^\d{4}\.md$/.test(f))

files.forEach(file => {
  const content = fs.readFileSync(path.join(TIMELINE_DIR, file), 'utf-8')
  const lines = content.split('\n')

  lines.forEach(line => {
    TAGS.forEach(tag => {
      if (line.includes(tag)) {
        tagMap[tag].push(line)
      }
    })
  })
})

fs.mkdirSync(TAG_DIR, { recursive: true })

Object.entries(tagMap).forEach(([tag, items]) => {
  if (items.length === 0) return

  let md = `# ${tag}\n\n`
  items.forEach(line => {
    md += `${line}\n`
  })

  fs.writeFileSync(
    path.join(TAG_DIR, `${tag}.md`),
    md,
    'utf-8'
  )
})

console.log('✅ 标签页已生成')
