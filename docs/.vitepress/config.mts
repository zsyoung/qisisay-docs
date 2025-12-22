import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/',
  ignoreDeadLinks: true,
  
  markdown: {
    config(md) {
      const defaultRender =
        md.renderer.rules.image ||
        function (tokens, idx, options, env, self) {
          return self.renderToken(tokens, idx, options)
        }

      md.renderer.rules.image = function (tokens, idx, options, env, self) {
        const token = tokens[idx]

        // 只对图片生效：不给第三方图片发送 Referer
        token.attrSet('referrerpolicy', 'no-referrer')

        // 可选：顺手加懒加载（不影响防盗链）
        // token.attrSet('loading', 'lazy')

        return defaultRender(tokens, idx, options, env, self)
      }
    }
  },

  vite: {
    build: {
      rollupOptions: {
        external: (id) => id === './' || id === './' || id === './'
      }
    }
  },

  themeConfig: {
    sidebar: {
      '/timeline/': [
        {
          text: '时间线',
          items: [{ text: '时间线总览', link: '/timeline/' }]
        }
      ]
    },
    // 在 themeConfig 内部添加
    search: {
      provider: 'local', // 启用内置本地搜索 
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: { noResultsText: '无法找到相关结果', resetButtonTitle: '清除查询条件', footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' } }
        }
      }
    },
    outline: {
      level: [2, 3], // 让右侧目录显示更深层级的标题
      label: '本页大纲'
    },
    lastUpdated: {
      text: '最后更新于',
      formatOptions: { dateStyle: 'full', timeStyle: 'medium' }
    }
  }
})
