import test from 'node:test'
import assert from 'node:assert/strict'
import { EXAM_CONFIG, examTargetName, parseExamConfig, authCookieName } from '../shared/examConfig.ts'

test('basic Japanese history keeps odd/even exam targets and independent authentication', () => {
  for (const number of [1, 3, 9, 11]) assert.equal(examTargetName(number), 'センター試験日本史')
  for (const number of [2, 4, 10, 12]) assert.equal(examTargetName(number), '歴検2級日本史')
  for (const number of [0, -1, 1.5, NaN]) assert.equal(examTargetName(number), '')
  assert.equal(authCookieName(), 'exam-basic-japanese-history-practice-access-token')
  assert.equal(EXAM_CONFIG.payments.enabled, false)
  const invalid = structuredClone(EXAM_CONFIG)
  invalid.exam.numbering = { even: '', odd: 'センター試験日本史' }
  assert.throws(() => parseExamConfig(invalid), /numbering/)
})
