import assert from 'node:assert/strict'
import test from 'node:test'
import { runSmoke } from './production-smoke.mjs'

function fixture(url) {
  if (url.endsWith('/')) return new Response('<title>基礎日本史ラボ</title><script src="/_nuxt/app.js"></script>', { headers: { 'content-type': 'text/html' } })
  if (url.endsWith('/health')) return Response.json({ status: 'ok', app: '基礎日本史ラボ API' })
  if (url.endsWith('/exams')) return Response.json({ data: [{ exam_number: 1, access: 'available', question_count: 36 }] })
  return Response.json({ error: { code: 'unauthorized' } }, { status: 401 })
}

test('healthy site passes using only anonymous GET requests', async () => {
  let count = 0
  assert.equal(await runSmoke({ fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET')
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
    assert.equal(options.headers.Authorization, undefined)
    count++
    return fixture(url)
  }, log: () => {} }), true)
  assert.equal(count, 5)
})

for (const [name, suffix, replacement] of [
  ['SPA fallback returned as API success', '/health', () => new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } })],
  ['wrong health payload', '/health', () => Response.json({ status: 'down' })],
  ['empty database catalog', '/exams', () => Response.json({ data: [] })],
  ['account access unexpectedly succeeds', '/me', () => Response.json({ data: {} })],
  ['wrong authentication error', '/me', () => Response.json({ error: { code: 'other' } }, { status: 401 })],
  ['broken home page', '/', () => new Response('unavailable', { status: 503 })],
]) {
  test(`rejects ${name}`, async () => {
    assert.equal(await runSmoke({ fetchImpl: async url => url.endsWith(suffix) ? replacement() : fixture(url), log: () => {} }), false)
  })
}

test('network errors fail safely and remaining checks still run', async () => {
  const logs = []
  let count = 0
  assert.equal(await runSmoke({ fetchImpl: async () => {
    count++
    throw new Error('sensitive response or credential')
  }, log: line => logs.push(line) }), false)
  assert.equal(count, 5)
  assert.equal(logs.some(line => line.includes('sensitive')), false)
})
