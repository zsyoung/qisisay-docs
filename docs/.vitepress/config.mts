import { defineConfig } from 'vitepress'

export default defineConfig({
  themeConfig: {
    sidebar: {
      '/timeline/': [
        { text: '2025 年', link: '/timeline/2025' }
      ]
    }
  }
})