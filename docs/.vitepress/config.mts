import { defineConfig } from 'vitepress'

export default defineConfig({
  themeConfig: {
    sidebar: {
      '/timeline/': [
        {
          text: '时间线',
          items: [
            { text: '时间线总览', link: '/timeline/' }
          ]
        }
      ]
    }
  }
})
