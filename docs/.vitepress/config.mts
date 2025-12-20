import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/qisisay-docs/',
  ignoreDeadLinks: true,
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
