import { defineConfig } from 'vitepress'
import { getThemeConfig } from '@sugarat/theme/node'

// 1. 获取主题配置
const blogTheme = getThemeConfig({
  title: '启四说',
  description: '投资与写作笔记归档',
  author: '启四',
  motto: '千万不要因为走得太久，而忘记了我们为什么出发',
  avatar: '/logo.jpg',
  
  social: [
    { icon: 'github', link: 'https://github.com' }
  ],

  // 关键：在标题下方显示 Frontmatter 里的 date
  article: {
    showTime: true,
    activeTime: 'date', // 必须：读取 date 字段
  },
  // 强制开启博客核心逻辑
  blog: false,
  pagesData: 'all', // 确保扫描所有页面数据
  // 关键：开启文章底部的推荐（上一篇/下一篇）
  recommend: {
    showSelf: true, // 在文章底部显示推荐
    nextText: '下一篇',
    prevText: '上一篇',
    style: 'card'
  }
})

export default defineConfig({
  extends: blogTheme,

  base: '/',
  title: "启四说",
  description: "投资与写作笔记归档",
  ignoreDeadLinks: true,
  
  // 重要：这是全局配置，决定是否开启更新时间
  lastUpdated: true,

  markdown: {
    config(md) {
      const defaultRender = md.renderer.rules.image || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options)
      }
      md.renderer.rules.image = function (tokens, idx, options, env, self) {
        const token = tokens[idx]
        token.attrSet('referrerpolicy', 'no-referrer')
        token.attrSet('loading', 'lazy')
        return defaultRender(tokens, idx, options, env, self)
      }
    }
  },

  themeConfig: {
    // 修正：最后更新时间的文字必须放在 themeConfig 内部才会变成中文
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'short'
      }
    },

    search: { 
      provider: 'local',
      placeholder: '搜索文章'
    },

    nav: [
      { text: '时间线', link: '/timeline/' },
      { text: '最新更新', link: '/' }
    ],

    sidebar: {
      '/': [
        {
          text: '📊 归档索引',
          items: [
            { text: '时间线总览', link: '/timeline/' },
            { text: '按主题查看', link: '/timeline/#按主题查看' }
          ]
        },
        {
          text: '📅 历年文章',
          collapsed: false,
          items: [
            { text: '2026年度', link: '/timeline/2026' },
            { text: '2025年度', link: '/timeline/2025' },
            { text: '2024年度', link: '/timeline/2024' },
            { text: '2023年度', link: '/timeline/2023' },
            { text: '2022年度', link: '/timeline/2022' },
            { text: '2021年度', link: '/timeline/2021' }
          ]
        }
      ]
    },

    outline: { level: [2, 3], label: '本页目录' },
    // 这里的配置作为兜底 
    docFooter: { prev: '上一篇', next: '下一篇' }
  }
})