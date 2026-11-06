<script setup lang="ts">
useSeoMeta({ title: `試験概要｜${SITE.name}`, description: `${SITE.exam_name}の概要をご案内します。` })
</script>

<template>
  <div class="page-wrap overview-page">
    <header class="page-intro"><h1>{{ SITE.exam_name }}</h1><p>{{ SITE.description }}</p></header>
    <section v-for="section in SITE.overview" :key="section.title" class="content-panel">
      <h2>{{ section.title }}</h2><p>{{ section.body }}</p>
    </section>
    <p class="overview-actions">
      <NuxtLink class="primary-link" to="/#practice-launcher">問題演習を始める</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.overview-page { padding-bottom: 36px; }
.content-panel p { white-space: pre-line; overflow-wrap: anywhere; }
.overview-actions { margin: 24px 0 0; }
</style>
