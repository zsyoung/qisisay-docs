const fs = require('fs')
const path = require('path')

/**
 * ====== 配置区 ======
 */

// 你的日更根目录（按你给的真实路径）
const WRITE_ROOT = '/Users/mlamp/Library/CloudStorage/OneDrive-个人/write/日更'

// VitePress docs 目录
const DOCS_ROOT = path.resolve(process.cwd(), 'docs')

// timeline 输出目录
const TIMELINE_DIR = path.join(DOCS_ROOT, 'timeline')

/**
 * ====== 工具函数 ======
 */

// 生成 URL 安全 slug（标题里允许 %，但 URL 不出现）
function slugify(filename) {
  return filename
    .replace(/\.md$/, '')
    .trim()
    .toLowerCase()
    .replace(/%/g, 'pct')     // % → pct（核心）
    .replace(/\+/g, 'plus')
    .replace(/#/g, '')
    .replace(/\?/g, '')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-') // 允许中文
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// 从 md 文件中提取 title（没有就用文件名）
function extractTitle(filePath, fallback) {
  const content = fs.readFileSync(filePath, 'utf-8')

  const frontmatterMatch = content.match(/title:\s*(.+)/)
  if (frontmatterMatch) {
    return frontmatterMatch[1].replace(/['"]/g, '').trim()
  }

  const h1Match = content.match(/^#\s+(.+)$/m)
  if (h1Match) return h1Match[1].trim()

  return fallback
}

/**
 * ====== 主逻辑 ======
 */

function generateTimeline(year) {
  const yearDir = path.join(WRITE_ROOT, year)
  if (!fs.existsSync(yearDir)) return

  // 只保留数字月份目录，并按数字排序（解决10、11、12月排序问题）
  const months = fs.readdirSync(yearDir)
    .filter(month => /^\d{2}$/.test(month)) // 确保是"01"-"12"格式的月份
    .sort((a, b) => Number(a) - Number(b)) // 按数字排序而非字符串
  
  let output = `# ${year} 年\n\n`

  months.forEach(month => {
    const monthDir = path.join(yearDir, month)
    if (!fs.statSync(monthDir).isDirectory()) return

    output += `## ${Number(month)} 月\n\n`

    // 筛选文件名以日期开头的md文件（如"01xxxx.md"、"15xxxx.md"）
    const files = fs.readdirSync(monthDir)
      .filter(f => f.endsWith('.md') && /^\d{2}[^0-9]/.test(f)) // 确保前两位是数字且后面不是数字
      .sort()
      .reverse() // 新的在前

    files.forEach(file => {
      const fullPath = path.join(monthDir, file)

      // 提取文件名前两位作为日期（如"05xxxx.md" → "05"）
      const day = file.slice(0, 2)
      // 移除日期前缀和.md后缀获取原始名称
      const rawName = file.slice(2).replace(/\.md$/, '').trim()
      const title = extractTitle(fullPath, rawName || day)

      const slug = slugify(file)
      const link = `/${year}/${month}/${slug}`

      // 生成格式：- **12-05｜[标题](链接)**
      output += `- **${Number(month)}-${day}｜[${title}](${link})**\n`
    })

    output += '\n'
  })

  if (!fs.existsSync(TIMELINE_DIR)) {
    fs.mkdirSync(TIMELINE_DIR, { recursive: true })
  }

  fs.writeFileSync(
    path.join(TIMELINE_DIR, `${year}.md`),
    output,
    'utf-8'
  )

  console.log(`✅ ${year} timeline 生成完成`)
}

/**
 * ====== 执行 ======
 */

// 只处理4位数字的年份目录，并按年份倒序排列
const years = fs.readdirSync(WRITE_ROOT)
  .filter(y => /^\d{4}$/.test(y))
  .sort((a, b) => b - a)

years.forEach(generateTimeline)