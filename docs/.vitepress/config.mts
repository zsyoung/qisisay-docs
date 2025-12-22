import { defineConfig } from 'vitepress'
//import { getThemeConfig } from '@sugarat/theme/node'

//const blogTheme = getThemeConfig({
  // 先保持默认即可；想关掉内置搜索可用：search: false
  // search: false,
//})

export default defineConfig({
  //extends: blogTheme,

  base: '/',
  title: "启四说",
  description: "投资与写作笔记归档",
  ignoreDeadLinks: true,
  lastUpdated: true,

  markdown: {
    config(md) {
      const defaultRender = md.renderer.rules.image || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options)
      }
      md.renderer.rules.image = function (tokens, idx, options, env, self) {
        const token = tokens[idx]
        token.attrSet('referrerpolicy', 'no-referrer')
        token.attrSet('loading', 'lazy') // 顺手加懒加载
        return defaultRender(tokens, idx, options, env, self)
      }
    }
  },

  themeConfig: {
    // 1. 开启搜索 
    search: { provider: 'local' },

    // 2. 优化导航栏
    nav: [
      { text: '时间线', link: '/timeline/' },
      { text: '最新更新', link: '/' }
    ],

    // 3. 结构化侧边栏 
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
            { text: '2025年度', link: '/timeline/2025' },
            { text: '2024年度', link: '/timeline/2024' },
            { text: '2023年度', link: '/timeline/2023' },
            { text: '2022年度', link: '/timeline/2022' },
            { text: '2021年度', link: '/timeline/2021' }
          ]
        }
      ]
    },

    // 4. 文章内大纲设置
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdatedText: '最后更新于'
  }
})