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
    }
  }
})
