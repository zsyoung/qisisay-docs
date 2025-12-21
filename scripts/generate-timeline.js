const fs = require('fs')
const path = require('path')

/**
 * ===== 配置 =====
 *
 * 默认扫描：docs/日更（CI 一定存在：你在 workflow 里先跑了 sync-content.sh）
 * 如需本地指定其他目录，可设置环境变量 DAILY_DIR
 *   例：DAILY_DIR="日更" node scripts/generate-timeline.js
 */

const DOCS_ROOT = path.resolve(process.cwd(), 'docs')
const WRITE_ROOT = process.env.DAILY_DIR
  ? path.resolve(process.cwd(), process.env.DAILY_DIR)
  : path.join(DOCS_ROOT, '日更')

const TIMELINE_DIR = path.join(DOCS_ROOT, 'timeline')

/**
 * ===== 工具函数 =====
 */

function hasChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text)
}

// 安全生成可访问 URL（保留真实文件名）
function makeSafeLink(relativePath) {
  return encodeURI(relativePath)
}

// 从 md 文件中提取标题
function extractTitle(filePath, fallback) {
  const content = fs.readFileSync(filePath, 'utf-8')

  const fm = content.match(/title:\s*(.+)/)
  if (fm) return fm[1].replace(/['"]/g, '').trim()

  const h1 = content.match(/^#\s+(.+)$/m)
  if (h1) return h1[1].trim()

  return fallback
}

// 清理标题前多余分隔符
function cleanTitle(title) {
  return title.replace(/^[｜\-\s]+/, '').trim()
}

/**
 * ===== 主逻辑 =====
 */

function generateTimeline(year) {
  const yearDir = path.join(WRITE_ROOT, year)
  if (!fs.existsSync(yearDir)) return

  const months = fs.readdirSync(yearDir).sort().reverse()
  let output = `# ${year} 年\n\n`

  months.forEach(month => {
    const monthDir = path.join(yearDir, month)
    if (!fs.statSync(monthDir).isDirectory()) return

    output += `## ${Number(month)} 月\n\n`

    const files = fs.readdirSync(monthDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()

    files.forEach(file => {
      const fullPath = path.join(monthDir, file)

      const basename = file.replace(/\.md$/, '')
      const isDatePrefix = /^\d{4}/.test(basename)

      let dayPart = ''
      let titleFallback = basename

      if (isDatePrefix) {
        const mm = basename.slice(0, 2)
        const dd = basename.slice(2, 4)

        // 纯日期文件名：1219.md
        if (basename.length === 4) {
          dayPart = `${mm}-${dd}`
          titleFallback = basename
        } else {
          dayPart = `${mm}-${dd}`
          titleFallback = basename.slice(4)
        }
      }

      let title

      // 文件名里本身就有中文，直接用文件名（最稳）
      if (hasChinese(titleFallback)) {
        title = titleFallback
      } else {
        title = extractTitle(fullPath, titleFallback)
      }

      title = cleanTitle(title)

      // 注意：这里生成的是站内访问路径（docs 为站点根）
      const relativeLink = `/日更/${year}/${month}/${file}`
      const safeLink = makeSafeLink(relativeLink)

      if (dayPart) {
        output += `- **${dayPart}｜[${title}](${safeLink})**\n`
      } else {
        output += `- **[${title}](${safeLink})**\n`
      }
    })

    output += '\n'
  })

  fs.mkdirSync(TIMELINE_DIR, { recursive: true })
  fs.writeFileSync(path.join(TIMELINE_DIR, `${year}.md`), output, 'utf-8')

  console.log(`✅ ${year} timeline 生成完成`)
}

/**
 * ===== 执行 =====
 */

if (!fs.existsSync(WRITE_ROOT)) {
  console.log(`ℹ️ 日更 root not found, skip timeline: ${WRITE_ROOT}`)
  process.exit(0)
}

fs.readdirSync(WRITE_ROOT)
  .filter(y => /^\d{4}$/.test(y))
  .forEach(generateTimeline)
