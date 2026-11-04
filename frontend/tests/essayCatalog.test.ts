import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { essayRuleProfiles, getEssayRuleProfile, getEssayRuleProfiles, loadEssayRuleProfiles } from '../server/data/essay-rule-profiles.ts'
import { syntheticEssayProfile } from './fixtures/essayRuleCases.ts'

const temporaryRoot = fileURLToPath(new URL('../local-only/', import.meta.url))
function withFile(content: string, action: (path: string) => void) {
  mkdirSync(temporaryRoot, { recursive: true })
  const directory = mkdtempSync(join(temporaryRoot, 'essay-catalog-test-'))
  const path = join(directory, 'catalog.json')
  try {
    writeFileSync(path, content)
    action(path)
  } finally { rmSync(directory, { recursive: true, force: true }) }
}
const catalog = (profiles: unknown[]) => JSON.stringify({ schema_version: 1, profiles })

test('an absent local catalog is empty and a configured file supplies versioned profiles', () => {
  withFile(catalog([syntheticEssayProfile]), path => {
    assert.deepEqual(loadEssayRuleProfiles(`${path}.absent`), [])
    assert.deepEqual(loadEssayRuleProfiles(path), [syntheticEssayProfile])
    const previous = process.env.ESSAY_RULE_PROFILES_PATH
    try {
      process.env.ESSAY_RULE_PROFILES_PATH = path
      assert.deepEqual(loadEssayRuleProfiles(), [syntheticEssayProfile])
    } finally {
      if (previous === undefined) delete process.env.ESSAY_RULE_PROFILES_PATH
      else process.env.ESSAY_RULE_PROFILES_PATH = previous
    }
  })
})

test('multiple catalog versions are allowed but duplicate identity and version are rejected', () => {
  const later = { ...structuredClone(syntheticEssayProfile), version: 2 }
  withFile(catalog([syntheticEssayProfile, later]), path => {
    assert.deepEqual(loadEssayRuleProfiles(path).map(profile => profile.version), [1, 2])
  })
  withFile(catalog([syntheticEssayProfile, syntheticEssayProfile]), path => {
    assert.throws(() => loadEssayRuleProfiles(path), /IDと版の重複/)
  })
})

test('a present malformed catalog or invalid rule fails without printing its input', () => {
  for (const content of [
    'private-marker-that-must-not-be-logged',
    JSON.stringify([syntheticEssayProfile]),
    JSON.stringify({ schema_version: 2, profiles: [] }),
    JSON.stringify({ schema_version: 1, profiles: [], unexpected: true }),
    catalog([{ ...structuredClone(syntheticEssayProfile), max_characters: 0 }]),
    catalog([{ ...structuredClone(syntheticEssayProfile), elements: [] }]),
  ]) {
    withFile(content, path => {
      assert.throws(() => loadEssayRuleProfiles(path), error => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /論述採点基準ファイル/)
        assert.equal(error.message.includes(content), false)
        return true
      })
    })
  }
})

test('a running catalog reloads a new version atomically and rejects a malformed replacement', () => {
  withFile(catalog([syntheticEssayProfile]), path => {
    const previous = process.env.ESSAY_RULE_PROFILES_PATH
    const originalArray = essayRuleProfiles
    try {
      process.env.ESSAY_RULE_PROFILES_PATH = path
      assert.equal(getEssayRuleProfile(syntheticEssayProfile.id, 1)?.version, 1)
      const later = { ...structuredClone(syntheticEssayProfile), version: 2 }
      writeFileSync(path, catalog([syntheticEssayProfile, later]))
      assert.equal(getEssayRuleProfile(later.id, 2)?.version, 2)
      assert.equal(getEssayRuleProfiles(), originalArray)
      writeFileSync(path, '{invalid-private-catalog')
      assert.throws(() => getEssayRuleProfiles(), /論述採点基準ファイル/)
      assert.equal(originalArray.length, 2)
      writeFileSync(path, catalog([later]))
      assert.equal(getEssayRuleProfile(later.id, 1), undefined)
      assert.equal(getEssayRuleProfile(later.id, 2)?.version, 2)
    } finally {
      if (previous === undefined) delete process.env.ESSAY_RULE_PROFILES_PATH
      else process.env.ESSAY_RULE_PROFILES_PATH = previous
      getEssayRuleProfiles()
    }
  })
})
