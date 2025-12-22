<script setup>
import { withBase } from 'vitepress'
// 接收文章列表数据
defineProps(['posts'])
</script>

<template>
  <div class="post-container">
    <div v-for="post in posts" :key="post.link" class="post-card">
      <a :href="withBase(post.link)" class="post-link">
        <div class="post-meta">
          <span class="post-date">{{ post.date }}</span>
          <span v-if="post.category" class="post-tag">{{ post.category }}</span>
        </div>
        <h3 class="post-title">{{ post.title }}</h3>
        <p v-if="post.description" class="post-desc">{{ post.description }}</p>
      </a>
    </div>
  </div>
</template>

<style scoped>
.post-container { margin-top: 2rem; }
.post-card {
  padding: 1.2rem;
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider-light);
  margin-bottom: 1rem;
  transition: all 0.3s ease;
}
.post-card:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand);
  background: var(--vp-c-bg-mute);
}
.post-meta { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
.post-date { font-size: 0.85rem; color: var(--vp-c-text-2); font-family: monospace; }
.post-tag {
  font-size: 0.75rem;
  padding: 2px 8px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand);
  border-radius: 4px;
}
.post-title { margin: 0; font-size: 1.15rem; color: var(--vp-c-text-1); font-weight: 600; }
.post-desc {
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.post-link { text-decoration: none !important; }
</style>