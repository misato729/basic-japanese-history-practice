import { pathToFileURL } from 'node:url'

const site = 'https://basic-japanese-history-practice.netlify.app'
const api = 'https://basic-japanese-history-practice.fly.dev'
const app = '基礎日本史ラボ API'
const jsonType = response => /\bapplication\/json\b/i.test(response.headers.get('content-type') ?? '')
const checks = [
  { name: 'home HTML', url: `${site}/`, status: 200, type: 'html' },
  { name: 'direct API health', url: `${api}/api/v1/health`, status: 200, type: 'health' },
  { name: 'proxied API health', url: `${site}/api/v1/health`, status: 200, type: 'health' },
  { name: 'published exam catalog', url: `${site}/api/v1/exams`, status: 200, type: 'catalog' },
  { name: 'anonymous account boundary', url: `${site}/api/v1/me`, status: 401, type: 'anonymous' },
]

export async function runSmoke({ fetchImpl = fetch, log = console.log } = {}) {
  let failed = 0
  for (const check of checks) {
    try {
      const response = await fetchImpl(check.url, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Accept: check.type === 'html' ? 'text/html' : 'application/json' },
      })
      if (response.status !== check.status) throw new Error('status')
      if (check.type === 'html') {
        if (!/\btext\/html\b/i.test(response.headers.get('content-type') ?? '')) throw new Error('type')
        const html = await response.text()
        if (!html.includes('基礎日本史ラボ') || !html.includes('/_nuxt/')) throw new Error('page')
      } else {
        if (!jsonType(response)) throw new Error('type')
        const body = await response.json()
        if (check.type === 'health' && (body?.status !== 'ok' || body?.app !== app)) throw new Error('health')
        if (check.type === 'catalog' && (!Array.isArray(body?.data) || !body.data.some(row =>
          row?.exam_number === 1 && row.access === 'available' && Number.isInteger(row.question_count) && row.question_count > 0
        ))) throw new Error('catalog')
        if (check.type === 'anonymous' && body?.error?.code !== 'unauthorized') throw new Error('boundary')
      }
      log(`PASS ${check.name}`)
    } catch {
      // Never print response bodies, headers, exception messages, or question data.
      log(`FAIL ${check.name}`)
      failed++
    }
  }
  log(`Smoke checks: ${checks.length - failed}/${checks.length} passed`)
  return failed === 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runSmoke() ? 0 : 1
}
