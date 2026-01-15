const fs = require('fs')
const path = require('path')

const DOCS_ROOT = path.resolve(process.cwd(), 'docs')
const TIMELINE_DIR = path.join(DOCS_ROOT, 'timeline')
const TAG_DIR = path.join(TIMELINE_DIR, 'tags')
const TIMELINE_INDEX = path.join(TIMELINE_DIR, 'index.md')

// 你想要的主题列表（= 生成哪些 tag 页）
// 没有文章 tags 的前提下，只能用“标题关键词命中”这种确定性规则
const TAGS = ['周报', 'ETF', '港股', '恒生', '动量', '沪深300', '红利', '小盘', '套利', '教程', '策略']

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

/**
 * 更新 markdown 的标记块
 */
function updateBlock(md, start, end, blockContent) {
  const s = `<!-- ${start} -->`
  const e = `<!-- ${end} -->`
  const block = [s, blockContent.trimEnd(), e].join('\n')

  if (md.includes(s) && md.includes(e)) {
    const re = new RegExp(`${s}[\\s\\S]*?${e}\\s*`, 'm')
    return md.replace(re, block + '\n')
  }
  return md.trimEnd() + '\n\n' + block + '\n'
}

/**
 * 解析 timeline 行：
 * 支持：
 * - **2024-12-29｜[标题](link)**   （保持）
 * - **12-29｜[标题](link)**        （补 year）
 * 返回 { yyyy, mm, dd, title, link, outLine }
 */
function parseTimelineLine(line, yearFromFile) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('-')) return null

  // - **2024-12-29｜[title](link)**
  let m = trimmed.match(
    /^-\s*\*\*(\d{4})-(\d{2})-(\d{2})｜\[(.+?)\]\((.+?)\)\*\*\s*$/
  )
  if (m) {
    const [, yyyy, mm, dd, title, link] = m
    const outLine = `- **${yyyy}-${mm}-${dd}｜[${title}](${link})**`
    return {
      yyyy: Number(yyyy),
      mm: Number(mm),
      dd: Number(dd),
      title,
      link,
      outLine,
    }
  }

  // - **12-29｜[title](link)**  -> 补 year
  m = trimmed.match(/^-\s*\*\*(\d{2})-(\d{2})｜\[(.+?)\]\((.+?)\)\*\*\s*$/)
  if (m) {
    const [, mm, dd, title, link] = m
    const yyyy = Number(yearFromFile)
    const outLine = `- **${String(yyyy).padStart(4, '0')}-${mm}-${dd}｜[${title}](${link})**`
    return {
      yyyy,
      mm: Number(mm),
      dd: Number(dd),
      title,
      link,
      outLine,
    }
  }

  return null
}

function ymdKey(it) {
  const yyyy = String(it.yyyy).padStart(4, '0')
  const mm = String(it.mm).padStart(2, '0')
  const dd = String(it.dd).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

/**
 * 倒序：由近及远
 */
function sortDesc(a, b) {
  return ymdKey(b).localeCompare(ymdKey(a))
}

/**
 * 生成 tags 页，并返回 counts（tag -> count）
 */
function buildTagPages() {
  ensureDir(TAG_DIR)

  const tagMap = {}
  TAGS.forEach(t => (tagMap[t] = []))

  // 年份文件列表：2021.md / 2022.md ...
  const yearFiles = fs
    .readdirSync(TIMELINE_DIR)
    .filter(f => /^\d{4}\.md$/.test(f))
    .sort((a, b) => Number(b.replace('.md', '')) - Number(a.replace('.md', '')))

  for (const yf of yearFiles) {
    const year = yf.replace('.md', '')
    const content = fs.readFileSync(path.join(TIMELINE_DIR, yf), 'utf-8')
    const lines = content.split('\n')

    for (const line of lines) {
      const parsed = parseTimelineLine(line, year)
      if (!parsed) continue

      for (const tag of TAGS) {
        if (parsed.title.includes(tag)) {
          tagMap[tag].push(parsed)
        }
      }
    }
  }

  // 写 tags/*.md（倒序 + 去重）
  const counts = {}
  for (const [tag, items] of Object.entries(tagMap)) {
    if (!items.length) {
      counts[tag] = 0
      continue
    }

    items.sort(sortDesc)

    // 去重：同一条 outLine 避免重复出现
    const seen = new Set()
    const out = []
    for (const it of items) {
      if (seen.has(it.outLine)) continue
      seen.add(it.outLine)
      out.push(it.outLine)
    }

    counts[tag] = out.length

    const md = `# ${tag}\n\n` + out.join('\n') + '\n'
    fs.writeFileSync(path.join(TAG_DIR, `${tag}.md`), md, 'utf-8')
  }

  return { counts, yearFiles }
}

/**
 * 更新 docs/timeline/index.md：
 * - YEARS 块：自动列出年份导航
 * - TAGS 块：只保留一份「按主题查看」，避免重复
 */
function updateTimelineIndex({ counts, yearFiles }) {
  let md = fs.existsSync(TIMELINE_INDEX)
    ? fs.readFileSync(TIMELINE_INDEX, 'utf-8')
    : `# 时间线\n\n请选择年份查看对应的日更记录。\n`

  // YEARS 块内容
  const years = yearFiles.map(f => f.replace('.md', ''))
  const yearsLine = years
    .sort((a, b) => Number(b) - Number(a))
    .map(y => `[${y}](./${y})`)
    .join(' ｜ ')

  md = updateBlock(md, 'YEARS_START', 'YEARS_END', yearsLine)

  // TAGS 块内容（保持你想要的标题“按主题查看”）
  // 排序策略：
  // - 默认按 TAGS 数组顺序（最稳定、符合你的心智）
  // - 如果你想按数量排序，把下面 sort 改成 counts 倒序即可
  const tagLines = TAGS.map(tag => `- [${tag}](./tags/${tag}.md)`).join('\n')
  const tagsBlock = `## 按主题查看\n\n${tagLines}`

  md = updateBlock(md, 'TAGS_START', 'TAGS_END', tagsBlock)

  // 清理旧的重复“按主题查看”段（只删除 TAGS 块外的那段，避免你现在的双份）
  // 典型结构：## 按主题查看 + 若干行 - [xxx](...)
  // 我们只删掉出现在 TAGS_START 之前的那份
  md = md.replace(
    /(\n## 按主题查看[\s\S]*?)(?=\n<!-- TAGS_START -->)/m,
    '\n'
  )

  // 同时，如果你之前脚本生成过“## 标签”那一套，也干掉（避免残留）
  md = md.replace(
    /(\n## 标签[\s\S]*?)(?=\n<!-- TAGS_END -->|\n<!-- TAGS_START -->|\n<!-- YEARS_START -->|\n# |\n$)/m,
    '\n'
  )

  fs.writeFileSync(TIMELINE_INDEX, md, 'utf-8')
}

/**
 * 主流程
 */
function main() {
  if (!fs.existsSync(TIMELINE_DIR)) {
    console.error(`Timeline dir not found: ${TIMELINE_DIR}`)
    process.exit(1)
  }

  const { counts, yearFiles } = buildTagPages()
  updateTimelineIndex({ counts, yearFiles })

  console.log('✅ tags 生成完成：标题补年份 + 倒序排序 + 自动更新 timeline/index.md')
  console.log('📌 tag 数量：', counts)
}

main()
