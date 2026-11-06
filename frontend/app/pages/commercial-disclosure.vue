<script setup lang="ts">
import type { SellerInformation } from '~/utils/sellerInformation'

type PaymentConfig = { seller?: SellerInformation }
type ApiResponse<T> = { data: T }

const { $api: api } = useNuxtApp()
const { data: paymentConfigResponse } = await useFetch<ApiResponse<PaymentConfig>>(
  '/api/v1/payments/config',
  { $fetch: api, server: false, lazy: true, timeout: 10000 },
)
// Public seller details verified on the referenced disclosure page on 2026-11-06.
// This display fallback does not enable checkout or configure server-side readiness.
const publishedSeller: SellerInformation = {
  name: '大野佳樹', representative: '大野佳樹', address: '', phone: '',
  email: SITE.contact_email, contact_disclosure_mode: 'on_request', contact_disclosure_ready: true,
}
const sellerInformation = computed(() => paymentConfigResponse.value?.data.seller?.name
  ? paymentConfigResponse.value.data.seller
  : publishedSeller)
const seller = computed(() => ({
  ...sellerInformation.value,
}))
const requestDisclosure = computed(() => seller.value.contact_disclosure_mode === 'on_request')

useSeoMeta({
  title: `特定商取引法に基づく表記｜${SITE.name}`,
  description: 'プレミアム会員の販売条件と販売事業者情報を表示します。',
})
</script>

<template>
  <div class="page-wrap legal-page">
    <header class="page-intro">
      <h1>特定商取引法に基づく表記</h1>
      <p>プレミアム会員の販売条件と販売事業者情報です。</p>
    </header>

    <article class="legal-document disclosure-table">
      <dl>
        <div><dt>販売事業者</dt><dd>{{ seller.name || '未掲載' }}</dd></div>
        <div><dt>運営責任者</dt><dd>{{ seller.representative || '未掲載' }}</dd></div>
        <div><dt>所在地</dt><dd>{{ requestDisclosure ? '請求があった場合に遅滞なく開示します。' : (seller.address || '未掲載') }}</dd></div>
        <div><dt>電話番号</dt><dd>{{ requestDisclosure ? '請求があった場合に遅滞なく開示します。' : (seller.phone || '未掲載') }}</dd></div>
        <div><dt>問い合わせ先</dt><dd><a :href="`mailto:${seller.email || SITE.contact_email}`">{{ seller.email || SITE.contact_email }}</a></dd></div>
        <div v-if="requestDisclosure"><dt>開示の請求方法</dt><dd>上記の問い合わせ先へ、所在地・電話番号の開示を希望する旨をメールでご連絡ください。購入前の請求にも、申込みの意思決定に先立って十分な時間的余裕をもって、電子メールで遅滞なく開示します。開示に費用はかかりません。</dd></div>
        <div><dt>販売価格</dt><dd>{{ PRICE_LABEL }}（税込）の買い切り。月額料金・自動更新はありません。</dd></div>
        <div><dt>販売価格以外の負担</dt><dd>インターネット接続に必要な通信料は利用者の負担となります。</dd></div>
        <div><dt>支払方法</dt><dd>クレジットカード、Apple Pay、Google Pay、Link、PayPay（利用可能な方法はStripeの決済画面に表示されます）</dd></div>
        <div><dt>支払時期</dt><dd>購入手続き時に決済されます。</dd></div>
        <div><dt>提供内容</dt><dd>公開中および今後追加される模擬試験{{ EXAM_CONFIG.payments.free_exam_count + 1 }}以降の利用資格。月額課金や自動更新はありません。</dd></div>
        <div><dt>無料で利用できる範囲</dt><dd>模擬試験1〜{{ EXAM_CONFIG.payments.free_exam_count }}は無料で利用できます。</dd></div>
        <div><dt>利用期間</dt><dd>利用資格に有効期限はありません。ただし、アカウント削除、全額返金、支払取消し、利用規約に基づく利用停止または本サービス終了の場合は失効することがあります。</dd></div>
        <div><dt>提供時期</dt><dd>決済完了をStripeの通知で確認後、直ちに利用できます。通知の遅延時は反映まで時間を要する場合があります。</dd></div>
        <div><dt>返品・返金</dt><dd>デジタルコンテンツの性質上、提供開始後の利用者都合による返品・返金は原則として受け付けません。重複決済、提供不能その他契約内容に適合しない場合は、上記問い合わせ先へご連絡ください。法令上認められる権利を制限するものではありません。</dd></div>
        <div><dt>利用環境</dt><dd>最新版の主要ブラウザとインターネット接続が必要です。CookieとJavaScriptを有効にしてください。</dd></div>
      </dl>
    </article>


  </div>
</template>

<style scoped>
.disclosure-table { padding: 0; overflow: hidden; }
.disclosure-table dl { margin: 0; }
.disclosure-table dl div { display: grid; grid-template-columns: minmax(180px, .35fr) minmax(0, 1fr); border-bottom: 1px solid var(--line); }
.disclosure-table dl div:last-child { border-bottom: 0; }
.disclosure-table dt, .disclosure-table dd { margin: 0; padding: 18px 22px; line-height: 1.8; }
.disclosure-table dt { background: var(--surface-tint); font-weight: 800; }
.disclosure-table dd { color: var(--text-secondary); overflow-wrap: anywhere; }
.disclosure-table a { color: var(--teal-dark); font-weight: 700; }
@media (max-width: 640px) {
  .disclosure-table dl div { grid-template-columns: 1fr; }
  .disclosure-table dt { padding-bottom: 8px; }
  .disclosure-table dd { padding-top: 8px; }
}
</style>
