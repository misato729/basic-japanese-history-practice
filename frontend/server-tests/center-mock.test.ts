import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, test } from 'node:test'
import { configuration } from '../server/core/config.ts'
import { closeDatabase, getDatabase, query, type Database } from '../server/core/db.ts'
import { migrate } from '../server/database/migrate.ts'
import { createArchiveV2, importArchiveV2 } from '../server/operations/content-v2.ts'
import { loadExamSet, loadQuestion, validateExamSet, publishExamSet, createQuestionGroup, saveQuestionGroup } from '../server/services/learning-writer.ts'
import { getQuestion, putFavorite } from '../server/services/learning.ts'
import type { User } from '../server/core/auth.ts'

process.env.APP_ENV = 'test'
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
const integration = { skip: !process.env.TEST_DATABASE_URL }
after(closeDatabase)
const counts = [6, 6, 6, 6, 4, 8]
function fixture() {
  const topic = configuration.categories.minor[0]!
  let number = 0
  const groups = counts.map((count, i) => ({ archive_id: i + 1, exam_number: 1, group_number: i + 1, title: `Synthetic group ${i + 1}`, planned_question_count: count, publication_status: 'draft', passages: [{ archive_id: i + 1, label: 'A', display_order: 1, content_blocks: [{ type: 'text', text: 'Synthetic shared passage' }, { type: 'table', headers: ['A', 'B'], rows: [['1', '2']] }] }] }))
  const questions = counts.flatMap((count, i) => Array.from({ length: count }, (_, j) => ({ exam_number: 1, question_number: ++number, group_id: i + 1, group_question_number: j + 1,
    major_category_code: topic.major_category_value, category_code: topic.value, is_cultural_history: false, is_art_history: false, cultural_history_category: null,
    publication_status: 'draft', answer_type: 'single_choice', content_blocks: [{ type: 'text', text: `Synthetic question ${number} (3 points)` }, { type: 'quote', text: 'Synthetic excerpt' }, { type: 'code', code: 'A -> B' }], explanation_blocks: [{ type: 'text', text: 'Synthetic explanation' }], source_text: null,
    source_references: [{ kind: 'book', title: 'Synthetic source', section: 'Synthetic heading' }], related_topics: [], accepted_answers: [], input_constraints: {}, passage_references: [{ passage_id: i + 1, anchor_id: null }],
    choices: configuration.exam.choice_labels.map((label, k) => ({ choice_label: label, display_order: k + 1, is_correct: k === j % 4, content_blocks: [{ type: 'text', text: `Synthetic choice ${k + 1}` }] })),
  })))
  return createArchiveV2({ exam_sets: [{ exam_number: 1, title: 'Synthetic Center mock', format_code: 'center_mock', publication_status: 'draft' }], groups, questions })
}

test('Center archives require the 6/6/6/6/4/8 distribution before publication', () => {
  const archive = fixture()
  assert.equal(archive.question_count, 36)
  assert.equal(archive.choice_count, 144)
  const published = { ...archive, exam_sets: archive.exam_sets.map(s => ({ ...s, publication_status: 'published' })), groups: archive.groups.map(g => ({ ...g, publication_status: 'published' })), questions: archive.questions.map(q => ({ ...q, publication_status: 'published' })) }
  assert.equal(createArchiveV2(published).question_count, 36)
  assert.throws(() => createArchiveV2({ ...published, groups: published.groups.map(g => ({ ...g, planned_question_count: g.group_number === 5 ? 8 : g.group_number === 6 ? 4 : 6 })) }))
  assert.throws(() => createArchiveV2({ ...archive, questions: archive.questions.map(q => q.question_number === 36 ? { ...q, question_number: 37 } : q) }))
})

test('Center import keeps full blocks and source references, stays draft, refuses a repeat, and preserves users/favorites', integration, async () => {
  assert.match(new URL(process.env.TEST_DATABASE_URL!).pathname, /_test$/)
  const client = await getDatabase().connect()
  await client.query('BEGIN')
  try {
    const schema = `center_mock_${randomUUID().replaceAll('-', '')}`
    await client.query(`CREATE SCHEMA "${schema}"`)
    await client.query(`SET LOCAL search_path TO "${schema}"`)
    await migrate(client)
    const [user] = await query<User>("INSERT INTO users(name,email,password_digest,role,created_at,updated_at) VALUES('Synthetic account',$1,'synthetic','admin',NOW(),NOW()) RETURNING *", [`center-${randomUUID()}@example.invalid`], client)
    const archive = fixture()
    await importArchiveV2(archive, client)
    const before = await loadExamSet(1, client)
    assert.equal(before.publication_status, 'draft')
    assert.equal(before.format_code, 'center_mock')
    assert.deepEqual(before.groups.map(g => g.planned_question_count), counts)
    assert.deepEqual(before.groups.map(g => g.questions!.length), counts)
    assert.equal((await validateExamSet(1, client)).valid, true)
    const firstGroup = before.groups[0]!
    const changed = await saveQuestionGroup(firstGroup.id, { lock_version: firstGroup.lock_version, planned_question_count: 8 }, { db: client })
    assert.ok((await validateExamSet(1, client)).errors.some(error => error.includes('大問1: 6小問')))
    await saveQuestionGroup(firstGroup.id, { lock_version: changed.lock_version, planned_question_count: 6 }, { db: client })
    const ids: number[] = []
    for (const group of before.groups) {
      assert.equal(group.publication_status, 'draft')
      assert.deepEqual(group.passages[0]!.content_blocks, archive.groups[group.group_number - 1]!.passages[0]!.content_blocks)
      for (const q of group.questions!) {
        ids.push(q.id)
        const expected = archive.questions[q.question_number - 1]!
        assert.equal(q.publication_status, 'draft')
        assert.deepEqual(q.content_blocks, expected.content_blocks)
        assert.deepEqual(q.explanation_blocks, expected.explanation_blocks)
        assert.deepEqual(q.source_references, expected.source_references)
        assert.deepEqual(q.choices.map((c: any) => ({ choice_label: c.choice_label, content_blocks: c.content_blocks, display_order: c.display_order, is_correct: c.is_correct })), expected.choices)
        await assert.rejects(getQuestion(q.id, null, client), { status: 404 })
      }
    }
    await assert.rejects(createQuestionGroup(1, { group_number: 7, title: 'Synthetic invalid seventh group', planned_question_count: 6 }, { db: client }), { status: 422 })
    // All publication and favorites here are synthetic data in a rollback-only test schema.
    await publishExamSet(1, before.lock_version, { db: client })
    await putFavorite(ids[0]!, user!, client)
    const first = await loadQuestion(ids[0]!, client)
    const publicView = (await getQuestion(first.id, null, client)).data
    assert.equal(publicView.shared_passages.length, 1)
    for (const key of ['explanation_blocks', 'source_references', 'source_text', 'correct_answer']) assert.equal(key in publicView, false)
    assert.equal(publicView.choices.some((c: any) => 'is_correct' in c), false)
    await assert.rejects(importArchiveV2(archive, client))
    const after = await loadExamSet(1, client)
    assert.deepEqual(after.groups.flatMap(g => g.questions!.map(q => q.id)), ids)
    assert.equal((await query('SELECT id FROM users', [], client)).length, 1)
    assert.equal((await query('SELECT id FROM favorites', [], client)).length, 1)
  } finally { await client.query('ROLLBACK'); client.release() }
})
