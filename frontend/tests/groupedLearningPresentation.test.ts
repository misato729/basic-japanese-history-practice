import assert from 'node:assert/strict'
import test from 'node:test'
import { presentExplanationBlocks, presentSources, shortAnswerIssue, inputConstraintLabel, passageAnchorId } from '../app/utils/learningPresentation.ts'
import { publishedQuestionNumbers, catalogQuestionLabel } from '../app/utils/examCatalog.ts'
import { selectPracticePositions } from '../app/utils/practiceSequence.ts'

test('catalog-based navigation preserves group display order and never invents missing positions', () => {
  const catalog = [{ exam_number: 1, question_numbers: [1, 3, 2] }, { exam_number: 2, question_numbers: [8] }]
  assert.deepEqual(selectPracticePositions(catalog, [1, 2], [1, 2, 3, 8, 30]), [
    { examNumber: 1, questionNumber: 1 }, { examNumber: 1, questionNumber: 3 },
    { examNumber: 1, questionNumber: 2 }, { examNumber: 2, questionNumber: 8 },
  ])
  assert.deepEqual(publishedQuestionNumbers(catalog), [1, 2, 3, 8])
  assert.deepEqual(selectPracticePositions(catalog, [2], [1]), [])
})

test('omitting the old question filter includes all published groups through the thirtieth question', () => {
  const groups = [8, 7, 8, 7].map((count, index, counts) => Array.from({ length: count }, (_, offset) => counts.slice(0, index).reduce((sum, value) => sum + value, 0) + offset + 1))
  const catalog = [{ exam_number: 1, question_numbers: groups.flat() }, { exam_number: 2, question_numbers: [1, 3, 2] }]
  const sequence = selectPracticePositions(catalog, [1, 2])
  assert.equal(sequence.length, 33)
  for (const number of [8, 15, 23]) {
    const index = sequence.findIndex(position => position.examNumber === 1 && position.questionNumber === number)
    assert.deepEqual(sequence[index + 1], { examNumber: 1, questionNumber: number + 1 })
  }
  assert.deepEqual(sequence[29], { examNumber: 1, questionNumber: 30 })
  assert.deepEqual(sequence.slice(30), [{ examNumber: 2, questionNumber: 1 }, { examNumber: 2, questionNumber: 3 }, { examNumber: 2, questionNumber: 2 }])
})

test('an omitted question filter uses actual published positions while explicit old filters stay narrow', () => {
  const catalog = [{ exam_number: 1, question_numbers: [1, 3, 2, 4, 5, 6, 7, 8] }]
  assert.equal(selectPracticePositions(catalog, [1]).length, 8)
  assert.deepEqual(selectPracticePositions(catalog, [1], []), [])
  assert.deepEqual(selectPracticePositions(catalog, [1], [2, 3, 30]), [{ examNumber: 1, questionNumber: 3 }, { examNumber: 1, questionNumber: 2 }])
  assert.deepEqual(selectPracticePositions(catalog, [2]), [])
})

test('group labels use actual group-local order while URLs retain the stable number', () => {
  const exam = { exam_number: 2, question_numbers: [8, 5], groups: [{ id: 9, group_number: 1, title: '合成大問', question_numbers: [8, 5] }] }
  assert.equal(catalogQuestionLabel(exam, 5), '大問1・問2')
  assert.equal(catalogQuestionLabel({ exam_number: 1, question_numbers: [1] }, 1), '問1')
  assert.equal(passageAnchorId(8, 'term-a'), 'passage-8-term-a')
  assert.notEqual(passageAnchorId(9, 'term-a'), passageAnchorId(8, 'term-a'))
})

test('short answer constraints normalize compatibility width but do not permit arbitrary fuzzy text', () => {
  assert.equal(shortAnswerIssue('　合成語　', { script: 'kanji', exact_length: 3 }), '')
  assert.equal(shortAnswerIssue('ｶﾀｶﾅ', { script: 'katakana', exact_length: 4 }), '')
  assert.equal(shortAnswerIssue('カタカナ＝カタカナ', { script: 'katakana' }), '')
  assert.equal(shortAnswerIssue('一〇〇', { script: 'kanji' }), '')
  assert.match(shortAnswerIssue('合成', { exact_length: 3 }), /3字/)
  assert.match(shortAnswerIssue('合成あ', { script: 'kanji' }), /漢字/)
  assert.match(shortAnswerIssue('合成語', { script: 'katakana' }), /カタカナ/)
  assert.match(shortAnswerIssue('', {}), /入力/)
  assert.match(shortAnswerIssue('語'.repeat(1001), {}), /1000字/)
  assert.equal(inputConstraintLabel({ script: 'kanji', exact_length: 3 }), '漢字・3字')
})

test('book-only sources are displayed without a fabricated URL and unsafe links stay text', () => {
  assert.deepEqual(presentSources([{ kind: 'book', title: '合成資料', publisher: '合成出版社', edition: '第2版', locator: 'PDF 10頁' }]), [{ label: '合成資料・合成出版社・第2版・確認用語：未確認', url: null }])
  assert.equal(presentSources([{ kind: 'web', title: '合成資料', url: 'https://user:secret@example.test/path' }])[0]?.url, null)
  assert.equal(presentSources([{ kind: 'web', title: '合成資料', url: 'javascript:alert(1)' }])[0]?.url, null)
  assert.deepEqual(presentSources([], '既存資料 | https://example.test/reference'), [{ label: '既存資料', url: 'https://example.test/reference' }])
})

test('book sources show verified terms or an explicit unverified state without exposing captured PDF positions', () => {
  const source = { kind: 'book' as const, title: '合成資料', publisher: '合成出版社', edition: '第2版', section: '確認事項：合成分野、関連分野', locator: 'PDF 14頁（印刷10頁）' }
  assert.deepEqual(presentSources([source]), [{ label: '合成資料・合成出版社・第2版・確認事項：合成分野、関連分野', url: null }])
  assert.equal(source.locator, 'PDF 14頁（印刷10頁）')
  assert.equal(presentSources([{ ...source, section: '合成見出し' }])[0]!.label, '合成資料・合成出版社・第2版・合成見出し')
  assert.equal(presentSources([{ ...source, section: '  ' }])[0]!.label, '合成資料・合成出版社・第2版・確認用語：未確認')
  assert.match(presentSources([{ kind: 'web', title: '合成Web資料', section: '確認事項：合成分野', locator: '第2段落' }])[0]!.label, /第2段落/)
})

test('explanation citations omit private capture positions while retaining source names and historical details', () => {
  const blocks = [
    { type: 'text', text: '合成資料は1910年の記録。詳説日本史 PDF 14頁（印刷10頁）。' },
    { type: 'table', headers: ['根拠'], rows: [['日本史用語集 PDF 17頁、日本史用語集 PDF 18頁、詳説日本史 PDF 20頁（印刷16頁）']] },
  ]
  const original = structuredClone(blocks)
  assert.deepEqual(presentExplanationBlocks(blocks), [
    { type: 'text', text: '合成資料は1910年の記録。詳説日本史。' },
    { type: 'table', headers: ['根拠'], rows: [['日本史用語集、詳説日本史']] },
  ])
  assert.deepEqual(blocks, original)
})

test('legacy authoring grade and review route are hidden without removing learner explanations or mutating saved blocks', () => {
  const blocks = [
    { type: 'text', text: '合成問題の解説。他問という語を含む学習用の説明。' },
    { type: 'table', headers: ['判定', '理由'], rows: [['正しい', '合成の根拠']] },
    { type: 'text', text: '難度の再評価：知識要求 K0／判断・処理 P2。' },
    { type: 'text', text: '作問時の最短解法と他問からの情報供給の評価。' },
    { type: 'text', text: '参考採点：因果関係を説明できているか。' },
  ]
  const original = structuredClone(blocks)
  assert.deepEqual(presentExplanationBlocks(blocks), [blocks[0], blocks[1], blocks[4]])
  assert.deepEqual(blocks, original)
  const unmatched = [
    { type: 'text', text: '難度の再評価という語を説明する通常の文。' },
    { type: 'text', text: '難度の再評価：知識要求 K1／判断・処理 P1。', id: 'learner-note' },
    { type: 'text', text: '関連する説明。' },
    { type: 'text', text: '難度の再評価：知識要求 K1／判断・処理 P1。' },
  ]
  assert.deepEqual(presentExplanationBlocks(unmatched), unmatched)
  assert.deepEqual(presentExplanationBlocks([
    { type: 'text', text: '難度の再評価：知識要求 K1／判断・処理 P1。' },
    { type: 'quote', text: '引用は対として削除しない。' },
  ]).length, 2)
})

test('legacy material citations keep original works and every editing note while hiding management tags', () => {
  for (const kind of ['primary_quote', 'author_summary', 'authored_table']) {
    const note = '『合成史料』所収。中略を明示し、句読点は作問者が補った。訓読・表記を変更した。'
    const blocks = [{ type: 'text', text: `資料の出典・性格：${note}／${kind}。詳説日本史 PDF 14頁（印刷10頁）、日本史用語集 PDF 20頁。` }]
    const original = structuredClone(blocks)
    assert.deepEqual(presentExplanationBlocks(blocks), [{ type: 'text', text: `資料の出典：${note}` }])
    assert.deepEqual(presentExplanationBlocks(presentExplanationBlocks(blocks)), presentExplanationBlocks(blocks))
    assert.deepEqual(blocks, original)
  }
  const unknown = [{ type: 'text', text: '資料の出典・性格：合成資料。／unknown_kind。その他資料。' }]
  assert.deepEqual(presentExplanationBlocks(unknown), unknown)
})
