import test from 'node:test'
import assert from 'node:assert/strict'
import { essayRuleProfiles, getEssayRuleProfile } from '../server/data/essay-rule-profiles.ts'
import { gradeEssay, validateEssayProfile } from '../server/services/essay-scoring.ts'
import { syntheticEssayProfile, essayModelAnswers, essayRuleCases } from './fixtures/essayRuleCases.ts'

test('the application catalog does not include synthetic test content', () => {
  assert.equal(getEssayRuleProfile(syntheticEssayProfile.id), undefined)
})

test('a reviewed synthetic profile has eight points and versioned lookup stays isolated to this test', () => {
  const profile = structuredClone(syntheticEssayProfile)
  validateEssayProfile(profile)
  assert.equal(profile.elements.reduce((n, item) => n + item.points, 0), 8)
  assert.deepEqual(Object.keys(essayModelAnswers), [profile.id])
  const original = [...essayRuleProfiles]
  try {
    essayRuleProfiles.push(profile)
    assert.equal(getEssayRuleProfile(profile.id, profile.version), profile)
    assert.equal(getEssayRuleProfile(profile.id, 999), undefined)
    assert.ok(essayRuleCases.length >= 8)
  } finally { essayRuleProfiles.splice(0, essayRuleProfiles.length, ...original) }
  assert.equal(essayRuleProfiles.length, original.length)
})

for (const item of essayRuleCases) {
  test(`${item.profile_id}: ${item.name}`, () => {
    const result = gradeEssay(syntheticEssayProfile, item.answer)
    assert.equal(result.reference_only, true)
    assert.equal(result.max_points, 8)
    if (item.expected_confirmed_points !== undefined) assert.equal(result.confirmed_points, item.expected_confirmed_points, JSON.stringify(result.elements))
    if ('expected_score' in item) assert.equal(result.score, item.expected_score)
    if (item.expected_grading_status) assert.equal(result.grading_status, item.expected_grading_status)
    for (const id of item.must_match ?? []) assert.equal(result.elements.find(element => element.id === id)?.status, 'matched', JSON.stringify(result.elements))
    for (const id of item.must_not_match ?? []) assert.notEqual(result.elements.find(element => element.id === id)?.status, 'matched', JSON.stringify(result.elements))
    for (const id of item.must_pending ?? []) assert.equal(result.elements.find(element => element.id === id)?.status, 'pending', JSON.stringify(result.elements))
    if (item.expect_unsettled) assert.notEqual(result.score, 8)
    assert.equal(result.confirmed_points, result.elements.reduce((n, element) => n + (element.awarded_points ?? 0), 0))
    assert.equal(result.pending_points, result.elements.reduce((n, element) => n + (element.status === 'pending' ? element.points : 0), 0))
  })
}
