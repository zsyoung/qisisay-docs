import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/',
  ignoreDeadLinks: true,

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
