<script setup lang="ts">
useSeoMeta({ title: `試験概要｜${SITE.name}`, description: `${SITE.exam_name}の概要をご案内します。` })
</script>

<template>
  <div class="page-wrap overview-page">
    <header class="page-intro"><h1>{{ SITE.exam_name }}</h1><p>{{ SITE.description }}</p></header>
    <section v-for="section in SITE.overview" :key="section.title" class="content-panel">
      <h2>{{ section.title }}</h2><p>{{ section.body }}</p>
    </section>
    <section class="content-panel">
      <h2>本サイトの演習</h2>
      <p>偶数番号は歴検2級日本史、奇数番号はセンター試験日本史の模擬問題です。</p>
      <p>模擬試験1（センター）は6大問36問です。利用できる模擬試験は問題演習の一覧から確認できます。章・節や文化史の区分を指定した演習にも対応しています。</p>
      <NuxtLink class="primary-link" to="/#practice-launcher">問題演習を始める</NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.overview-page { padding-bottom: 36px; }
.content-panel p { white-space: pre-line; overflow-wrap: anywhere; }
</style>
