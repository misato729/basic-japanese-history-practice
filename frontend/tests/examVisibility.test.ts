import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { isVisibleExam, VISIBLE_EXAM_NUMBERS } from '../app/utils/examVisibility.ts'

test('navigation explicitly allows only exams 1 through 4', () => {
  assert.deepEqual(VISIBLE_EXAM_NUMBERS, [1, 2, 3, 4])
  assert.ok(Object.isFrozen(VISIBLE_EXAM_NUMBERS))
})

test('static slots never produce navigation for exams 5 through 10', () => {
  const slots = Array.from({ length: 10 }, (_, i) => ({ exam_number: i + 1, question_numbers: [] }))
  assert.deepEqual(slots.filter(isVisibleExam).map(row => row.exam_number), [1, 2, 3, 4])
})

test('published API results also exclude unfinished exams 5 and 6', () => {
  const catalog = Array.from({ length: 6 }, (_, i) => ({ exam_number: i + 1, question_numbers: [1, 7, 13] }))
  assert.deepEqual(catalog.filter(isVisibleExam).map(row => row.exam_number), [1, 2, 3, 4])
})

test('filtering preserves published ordering, sparse positions, access and group metadata', () => {
  const entries = [
    { exam_number: 4, question_numbers: [7, 19], access: 'available', groups: [{ id: 72 }] },
    { exam_number: 5, question_numbers: [1], access: 'available', groups: [] },
    { exam_number: 2, question_numbers: [], access: 'paid_membership_required', groups: [] },
  ]
  const before = JSON.stringify(entries)
  const result = entries.filter(isVisibleExam)
  assert.deepEqual(result.map(row => row.exam_number), [4, 2])
  assert.equal(result[0], entries[0])
  assert.equal(result[1], entries[2])
  assert.equal(JSON.stringify(entries), before)
})

test('missing exams are not invented', () => {
  assert.deepEqual([{ exam_number: 3 }].filter(isVisibleExam), [{ exam_number: 3 }])
  assert.deepEqual([].filter(isVisibleExam), [])
  assert.deepEqual([{ exam_number: 5 }, { exam_number: 6 }].filter(isVisibleExam), [])
})

test('invalid and future exam numbers are hidden', () => {
  for (const exam_number of [0, -1, 1.5, 4.1, 5, 10, 11, NaN, Infinity]) {
    assert.equal(isVisibleExam({ exam_number }), false)
  }
})

test('home filters after choosing the static or published catalog and displays the filtered total', () => {
  const source = readFileSync(new URL('../app/pages/index.vue', import.meta.url), 'utf8')
  assert.match(source, /import \{ isVisibleExam \} from '~\/utils\/examVisibility'/)
  assert.match(source, /const catalogExams = computed\(\(\) => \(hasFullAccess\.value[\s\S]*?: staticExams\)\.filter\(isVisibleExam\)\)/)
  assert.ok(source.includes('`模擬試験 全${catalogExams.length}回`'))
  assert.ok(!source.includes('`模擬試験 全${EXAM_SET_COUNT}回`'))
})

test('the shared desktop/mobile sidebar filters before constructing links', () => {
  const source = readFileSync(new URL('../app/components/ExamSidebar.vue', import.meta.url), 'utf8')
  assert.match(source, /import \{ isVisibleExam \} from '~\/utils\/examVisibility'/)
  assert.match(source, /createSidebarExamCatalog\([^\n]+\)\s*\.filter\(isVisibleExam\)\s*\.map\(/)
})
