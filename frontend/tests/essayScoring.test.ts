import assert from 'node:assert/strict'
import test from 'node:test'
import { countEssayCharacters, gradeEssay, validateEssayProfile } from '../server/services/essay-scoring.ts'
import type { EssayScoringProfile } from '../shared/types/essay.ts'

const profile = (): EssayScoringProfile => ({
  id: 'synthetic-quantities', version: 1, title: '合成したルール検証用の論述', max_characters: 200,
  required_terms: [], allowed_negation_phrases: ['避けられない'],
  elements: [
    { id: 'food', label: '数量甲の増え方', points: 2,
      positive: [{ sequence: [['数量甲'], ['算術級数', '等差数列'], ['増える', '増加']] }],
      negative: [{ sequence: [['数量甲'], ['幾何級数', '等比数列'], ['増える', '増加']] }] },
    { id: 'population', label: '数量乙の増え方', points: 2,
      positive: [{ sequence: [['数量乙'], ['幾何級数', '等比数列'], ['増える', '増加']] }],
      negative: [{ sequence: [['数量乙'], ['算術級数', '等差数列'], ['増える', '増加']] }] },
    { id: 'cause', label: '数量乙増加と差の拡大の関係', points: 2,
      positive: [{ sequence: [['数量乙増加'], ['数量甲増加'], ['上回る'], ['ため'], ['差']] }],
      negative: [{ sequence: [['数量甲増加'], ['数量乙増加'], ['上回る'], ['ため'], ['差']] }] },
    { id: 'policy', label: '数量乙を抑える方法', points: 2,
      positive: [{ sequence: [['調整策'], ['数量乙'], ['抑制', '抑える']] }],
      negative: [{ sequence: [['調整策'], ['数量乙'], ['増やす', '増加させる']] }] },
  ],
})
const fullAnswer = '数量甲は算術級数的に増える。数量乙は幾何級数的に増加する。数量乙増加が数量甲増加を上回るため差が拡大する。調整策として数量乙の抑制を説いた。'

test('registered relationships yield reference points and an exact input sentence as evidence', () => {
  const result = gradeEssay(profile(), fullAnswer)
  assert.equal(result.grading_status, 'complete')
  assert.equal(result.score, 8)
  assert.equal(result.confirmed_points, 8)
  assert.equal(result.pending_points, 0)
  assert.equal(result.reference_only, true)
  assert.equal(result.engine_version, 'literal-rules-v3')
  assert.ok(result.elements.every(element => element.status === 'matched'))
  assert.equal(result.elements[0]!.evidence[0], '数量甲は算術級数的に増える')
})

test('registered alternative wording and full-width notation match without changing character count', () => {
  const result = gradeEssay(profile(), fullAnswer.replace('算術級数', '等差数列').replace('幾何級数', '等比数列').replace('抑制', '抑える'))
  assert.equal(result.score, 8)
  assert.equal(countEssayCharacters('Ａ １\n😀。'), 4)
  assert.equal(countEssayCharacters('ｶﾞ'), 2)
  const wrapped = fullAnswer.replace('算術級数', '算術\n級数').replace('数量乙の抑制', '数量\r\n乙の抑制')
  assert.equal(gradeEssay(profile(), wrapped).score, 8)
  assert.equal(gradeEssay(profile(), wrapped).elements[0]!.evidence[0], '数量甲は算術\n級数的に増える')
})

test('mere keyword enumeration remains pending, rather than receiving a false zero or full score', () => {
  const result = gradeEssay(profile(), '数量乙　数量甲　幾何級数　算術級数　差の拡大　抑制')
  assert.equal(result.confirmed_points, 0)
  assert.equal(result.pending_points, 8)
  assert.equal(result.score, null)
  assert.equal(result.grading_status, 'pending')
})

test('swapped subjects are detected by registered negative relationships', () => {
  const result = gradeEssay(profile(), '数量甲は幾何級数的に増加する。数量乙は算術級数的に増える。数量乙増加が数量甲増加を上回るため差が拡大する。調整策として数量乙の抑制を説いた。')
  assert.equal(result.score, 4)
  assert.equal(result.elements[0]!.status, 'contradicted')
  assert.equal(result.elements[1]!.status, 'contradicted')
  assert.equal(result.elements[0]!.awarded_points, 0)
})

test('reversed cause is not awarded as the correct relationship', () => {
  const result = gradeEssay(profile(), fullAnswer.replace('数量乙増加が数量甲増加を上回る', '数量甲増加が数量乙増加を上回る'))
  assert.equal(result.elements[2]!.status, 'contradicted')
  assert.equal(result.score, 6)
})

test('an unknown paraphrase is pending, including when the remaining elements match', () => {
  const result = gradeEssay(profile(), fullAnswer.replace('調整策として数量乙の抑制を説いた', '別の手順で調整すべきだと考えた'))
  assert.equal(result.confirmed_points, 6)
  assert.equal(result.pending_points, 2)
  assert.equal(result.score, null)
})

test('unscoped negation does not produce a false positive', () => {
  const result = gradeEssay(profile(), fullAnswer.replace('数量甲は算術級数的に増える', '数量甲は算術級数的に増えると主張しなかった'))
  assert.equal(result.elements[0]!.status, 'pending')
  assert.equal(result.confirmed_points, 6)
})

test('a literal zu negation is held while lexical zu words keep valid matches', () => {
  const negated = gradeEssay(profile(), fullAnswer.replace('数量甲は算術級数的に増える', '数量甲の算術級数による増加を認めず'))
  assert.equal(negated.elements[0]!.status, 'pending')
  assert.equal(negated.score, null)
  for (const prefix of ['まず', '必ず', 'いずれ']) assert.equal(gradeEssay(profile(), prefix + fullAnswer).score, 8)
  for (const ending of ['増えることを望まず', '増加の責任を負わずかつ放置した']) {
    const answer = fullAnswer.replace('数量甲は算術級数的に増える', `数量甲は算術級数的に${ending}`)
    assert.equal(gradeEssay(profile(), answer).elements[0]!.status, 'pending')
    assert.equal(gradeEssay(profile(), answer).score, null)
  }
})

test('negating a registered wrong claim is pending rather than an incorrect assertion', () => {
  const result = gradeEssay(profile(), '数量甲は幾何級数的に増加しない。')
  assert.equal(result.elements[0]!.status, 'pending')
  assert.equal(result.elements[0]!.awarded_points, null)
  assert.match(result.elements[0]!.reason, /否定/)
})

test('polite and alternative negative spellings cannot earn positive points', () => {
  for (const phrase of ['増加しません', '増加することは無い', '増加するまい', '増加することはなかろう', '増加することはあり得ぬ']) {
    const result = gradeEssay(profile(), `数量甲は算術級数的に${phrase}。`)
    assert.equal(result.elements[0]!.status, 'pending', phrase)
    assert.equal(result.elements[0]!.awarded_points, null, phrase)
  }
})

test('an explicitly allowed negative construction does not block a valid positive claim', () => {
  const result = gradeEssay(profile(), fullAnswer.replace('差が拡大する', '差の拡大は避けられない'))
  assert.equal(result.score, 8)
  const stillNegative = gradeEssay(profile(), fullAnswer.replace('差が拡大する', '差の拡大は避けられないと主張しなかった'))
  assert.equal(stillNegative.elements[2]!.status, 'pending')
})

test('simultaneously matching positive and negative claims requires confirmation', () => {
  const result = gradeEssay(profile(), fullAnswer + '数量甲は幾何級数的に増える。')
  assert.equal(result.elements[0]!.status, 'pending')
  assert.equal(result.elements[0]!.evidence.length, 2)
  assert.equal(result.pending_points, 2)
  assert.equal(result.score, null)
})

test('hypothesis, quoted false examples and explicit corrections are not treated as assertions', () => {
  for (const prefix of ['仮に', 'もし', '誤りの例として', 'これは嘘であり', '訂正する。']) {
    const result = gradeEssay(profile(), prefix + fullAnswer)
    assert.equal(result.confirmed_points, 0, prefix)
    assert.equal(result.pending_points, 8, prefix)
  }
  for (const suffix of ['上記を撤回する。', 'この説明を取り消す。', '前述の内容を訂正する。']) {
    assert.equal(gradeEssay(profile(), fullAnswer + suffix).confirmed_points, 0)
  }
  assert.equal(gradeEssay(profile(), fullAnswer + '担当者は運用規則を撤回した。').score, 8)
  for (const prefix of ['以下は誤った説明である。', '以下は事実と異なる。']) {
    assert.equal(gradeEssay(profile(), prefix + fullAnswer).confirmed_points, 0)
  }
  for (const suffix of ['以上はすべて正しくない。', '以上の説明は正しくありません。', '上記は事実ではありません。', '実際は正反対である。', '本当ですか？', '本当か?', '正しいですか。']) {
    const result = gradeEssay(profile(), fullAnswer + suffix)
    assert.equal(result.confirmed_points, 0, suffix)
    assert.equal(result.score, null, suffix)
  }
})

test('question-specific caution patterns prevent unsupported attribution from earning points', () => {
  const p = profile()
  p.caution_patterns = [{ sequence: [['人物甲', '対象人物甲'], ['主張']] }]
  const result = gradeEssay(p, '人物甲が主張した。' + fullAnswer)
  assert.equal(result.confirmed_points, 0)
  assert.equal(result.pending_points, 8)
})

test('sentence scope and maximum gap prevent joining unrelated statements', () => {
  assert.equal(gradeEssay(profile(), '数量甲。算術級数。増える。').elements[0]!.status, 'pending')
  assert.equal(gradeEssay(profile(), '数量甲.算術級数.増える.').elements[0]!.status, 'pending')
  assert.equal(gradeEssay(profile(), '数量甲' + 'あ'.repeat(25) + '算術級数的に増加する。').elements[0]!.status, 'pending')
  const p = profile()
  p.elements[0]!.positive = [{ sequence: [['数量甲'], ['算術級数'], ['増加']], scope: 'answer', max_gap: 30 }]
  assert.equal(gradeEssay(p, '数量甲。算術級数。増加。').elements[0]!.status, 'matched')
})

test('all matching elements cannot turn an out-of-limit or missing-required-term answer into a score', () => {
  const p = profile()
  p.max_characters = 20
  const over = gradeEssay(p, fullAnswer)
  assert.equal(over.grading_status, 'invalid')
  assert.equal(over.score, null)
  assert.equal(over.constraints.within_limit, false)
  p.max_characters = 200
  p.required_terms = ['指定語']
  const missing = gradeEssay(p, fullAnswer)
  assert.equal(missing.grading_status, 'invalid')
  assert.deepEqual(missing.constraints.missing_required_terms, ['指定語'])
  assert.equal(missing.score, null)
  assert.equal(gradeEssay(p, '指定語。' + fullAnswer).score, 8)
})

test('blank and excessive raw/visible input are invalid and cannot exhaust the matcher', () => {
  for (const answer of ['', ' \n\t', 'あ'.repeat(1001), ' '.repeat(4001) + fullAnswer]) {
    const result = gradeEssay(profile(), answer)
    assert.equal(result.grading_status, 'invalid')
    assert.equal(result.score, null)
    assert.equal(result.confirmed_points, 0)
  }
})

test('pattern matching explores later occurrences without exponential recursion', () => {
  const p = profile()
  p.elements[0]!.positive = [{ sequence: [['甲'], ['乙'], ['丙']], max_gap: 1 }]
  assert.equal(gradeEssay(p, '甲乙乙丙').elements[0]!.status, 'matched')
  const repetitive = gradeEssay(p, ('甲乙'.repeat(450) + '丙'))
  assert.equal(repetitive.score, null)
  assert.ok(['invalid', 'pending'].includes(repetitive.grading_status))
})

test('profile definitions are bounded, unique, total eight points, and literal-only', () => {
  assert.doesNotThrow(() => validateEssayProfile(profile()))
  for (const mutate of [
    (p: any) => { p.elements[0].points = 3 },
    (p: any) => { p.elements[1].id = p.elements[0].id },
    (p: any) => { p.elements[0].positive[0].max_gap = 1001 },
    (p: any) => { p.elements[0].positive[0].sequence = [[]] },
    (p: any) => { p.elements[0].positive[0].sequence = [['']] },
    (p: any) => { p.elements[0].positive[0].sequence = '.*' },
    (p: any) => { p.max_characters = 1001 },
  ]) {
    const p = profile()
    mutate(p)
    assert.throws(() => validateEssayProfile(p), TypeError)
  }
  const p = profile()
  p.elements[0]!.positive = [{ sequence: [['(a+)+$']] }]
  assert.equal(gradeEssay(p, 'aaaaaaaaaaaaa!').elements[0]!.status, 'pending')
  assert.throws(() => gradeEssay(profile(), null as any), TypeError)
})

const relationshipProfile = (): EssayScoringProfile => ({
  id: 'synthetic-assertions', version: 1, title: '合成した完全関係句', max_characters: 200,
  required_terms: [],
  elements: [{ id: 'relation', label: '主体と対象の対応', points: 8,
    positive: [{ sequence: [['主体甲が対象乙を統治した']], max_gap: 0 }],
    negative: [{ sequence: [['対象乙が主体甲を統治した']], max_gap: 0 }],
  }],
})

test('reading commas are optional only in explicitly approved single-slot relationship phrases', () => {
  const p = relationshipProfile()
  p.elements[0]!.positive[0]!.ignore_commas = true
  for (const answer of ['主体甲が対象乙を統治した。', '主体甲が、対象乙を、統治した。', '主体甲が，対象乙を,統治した。']) {
    assert.equal(gradeEssay(p, answer).score, 8)
  }
  for (const answer of ['主体甲が。対象乙を統治した。', '主体甲が；対象乙を統治した。', '主体甲が・対象乙を統治した。', '主体甲を対象乙が統治した。', '主体甲が報告し、別の主体が対象乙を統治した。']) {
    assert.notEqual(gradeEssay(p, answer).elements[0]!.status, 'matched')
  }
  delete p.elements[0]!.positive[0]!.ignore_commas
  assert.equal(gradeEssay(p, '主体甲が、対象乙を統治した。').elements[0]!.status, 'pending')
})

test('a complete approved contrast protects only its own wording, including reading commas', () => {
  const p = relationshipProfile()
  const assertion = '主体甲が対象乙を統治したのではなく主体丙が対象乙を統治した'
  p.elements[0]!.positive = [{ sequence: [[assertion]], ignore_commas: true, max_gap: 0 }]
  p.elements[0]!.negative = [{ sequence: [['主体甲が対象乙を統治した']], max_gap: 0 }]
  p.allowed_context_phrases = [assertion]
  for (const answer of [assertion, assertion.replace('ではなく', 'ではなく、').replace('主体丙が', '主体丙が，')]) {
    const result = gradeEssay(p, answer)
    assert.equal(result.score, 8)
    assert.equal(result.elements[0]!.evidence[0], answer)
  }
  for (const answer of [
    `もし${assertion}ならば。`, `${assertion}と仮定する。`,
    `${assertion}という説明は誤りである。`, `${assertion}とは言えない。`,
    `${assertion}と主張しなかった。`, `${assertion}。この説明を撤回する。`,
    `${assertion}。主体甲が対象乙を統治した。`,
    `${assertion.replace('ではなく', 'ではなく、')}とは言えない。`,
  ]) {
    assert.equal(gradeEssay(p, answer).elements[0]!.status, 'pending')
    assert.equal(gradeEssay(p, answer).score, null)
  }
})

test('ordinary wa-zuka and izure forms are not confused with a verb ending in zu', () => {
  for (const addition of ['わずかな範囲で', 'わずかに', 'いずれも']) {
    assert.equal(gradeEssay(profile(), fullAnswer.replace('数量甲は', '数量甲は'+addition)).score, 8)
  }
  const answer = fullAnswer.replace('数量甲は算術級数的に増える', '数量甲は算術級数的に増加の責任を負わずかなり放置した')
  assert.equal(gradeEssay(profile(), answer).elements[0]!.status, 'pending')
})

test('required-term writing variants require a complete registered variant containing both terms', () => {
  const p = relationshipProfile()
  p.required_terms = ['対象甲・対象乙']
  p.required_term_variants = { '対象甲・対象乙': ['対象甲と対象乙', '対象甲や対象乙'] }
  for (const form of ['対象甲・対象乙', '対象甲と対象乙', '対象甲や対象乙']) {
    assert.deepEqual(gradeEssay(p, `${form}。主体甲が対象乙を統治した。`).constraints.missing_required_terms, [])
  }
  for (const form of ['対象甲だけ', '対象乙だけ', '対象甲。対象乙', '対象甲と別の対象乙']) {
    const result = gradeEssay(p, `${form}。主体甲が対象乙を統治した。`)
    assert.deepEqual(result.constraints.missing_required_terms, ['対象甲・対象乙'])
    assert.equal(result.grading_status, 'invalid')
  }
})

test('new optional settings reject broad or unbounded definitions and retain old catalog defaults', () => {
  assert.doesNotThrow(() => validateEssayProfile(relationshipProfile()))
  for (const mutate of [
    (p: any) => { p.elements[0].positive[0].ignore_commas = 'yes' },
    (p: any) => { p.elements[0].positive[0].exact = 'yes' },
    (p: any) => { p.elements[0].positive[0] = { sequence: [['主体甲'], ['統治した']], exact: true } },
    (p: any) => { p.elements[0].positive[0] = { sequence: [['主体甲'], ['統治した']], ignore_commas: true } },
    (p: any) => { p.elements[0].positive[0] = { sequence: [['、，,']], ignore_commas: true } },
    (p: any) => { p.allowed_context_phrases = ['ではなく'] },
    (p: any) => { p.allowed_context_phrases = Array(65).fill('主体甲が対象乙を統治した') },
    (p: any) => { p.allowed_context_phrases = ['主体甲が対象乙を統治した', '主体甲が 対象乙を統治した'] },
    (p: any) => { p.required_term_variants = { 未指定: ['対象甲と対象乙'] } },
    (p: any) => { p.required_term_variants = { '対象甲・対象乙': [] } },
    (p: any) => { p.required_term_variants = { '対象甲・対象乙': Array(33).fill('対象甲と対象乙') } },
    (p: any) => { p.required_term_variants = { '対象甲・対象乙': ['対象甲・対象乙'] } },
    (p: any) => { p.required_term_variants = { '対象甲・対象乙': ['対象甲と対象乙', '対象甲と 対象乙'] } },
    (p: any) => { p.required_term_variants = { '対象甲・対象乙': ['あ'.repeat(101)] } },
    (p: any) => { p.required_term_variants = { '対象甲・対象乙': [123] } },
  ]) {
    const p = relationshipProfile()
    p.required_terms = ['対象甲・対象乙']
    mutate(p)
    assert.throws(() => validateEssayProfile(p), TypeError)
  }
})

const groupedProfile = (): EssayScoringProfile => ({
  id: 'synthetic-independent-facts', version: 1, title: '合成した独立事実の組合せ', max_characters: 200,
  required_terms: [], elements: [{
    id: 'two-facts', label: '独立した二事実', points: 8, positive: [],
    positive_all: [
      [
        { sequence: [['主体甲が対象乙を統治した']], max_gap: 0, ignore_commas: true },
        { sequence: [['主体甲が制度丙を廃止した']], max_gap: 0, ignore_commas: true },
      ],
      [
        { sequence: [['対象乙は主体甲に統治された']], max_gap: 0 },
        { sequence: [['制度丙は主体甲に廃止された']], max_gap: 0 },
      ],
    ],
    negative: [{ sequence: [['対象乙が主体甲を統治した']], max_gap: 0 }],
  }],
})

test('a complete OR group awards an element for full independent facts across separate sentences', () => {
  const p = groupedProfile()
  const first = '主体甲が対象乙を統治した'
  const second = '主体甲が制度丙を廃止した'
  for (const answer of [`${first}。${second}。`, `${second}。${first}。`, '対象乙は主体甲に統治された。制度丙は主体甲に廃止された。']) {
    const result = gradeEssay(p, answer)
    assert.equal(result.score, 8)
    assert.equal(result.elements[0]!.evidence.length, 2)
  }
  const joined = gradeEssay(p, `${first}し、${second}。`)
  assert.equal(joined.score, 8)
  assert.equal(joined.elements[0]!.evidence.length, 1)
  assert.equal(gradeEssay(p, '主体甲が、対象乙を統治した。主体甲が、制度丙を廃止した。').score, 8)
})

test('partial groups, facts from different subjects or targets, and unrelated words cannot earn the element', () => {
  const p = groupedProfile()
  for (const answer of [
    '主体甲が対象乙を統治した。', '主体甲が制度丙を廃止した。',
    '主体甲が対象乙を統治した。主体丁が制度丙を廃止した。',
    '主体甲が対象丁を統治した。主体甲が制度丙を廃止した。',
    '主体甲が別件を報告した。対象乙を統治した。制度丙を廃止した。',
    '主体甲。対象乙。統治した。主体甲。制度丙。廃止した。',
  ]) {
    const result = gradeEssay(p, answer)
    assert.equal(result.elements[0]!.status, 'pending')
    assert.equal(result.confirmed_points, 0)
    assert.equal(result.elements[0]!.evidence.length, 0)
  }
})

test('grouped facts retain hypothesis, later negation, withdrawal and conflicting-answer guards', () => {
  const p = groupedProfile()
  const first = '主体甲が対象乙を統治した'
  const second = '主体甲が制度丙を廃止した'
  for (const answer of [
    `もし${first}ならば。${second}。`, `${first}。${second}と仮定する。`,
    `${first}。${second}とは言えない。`, `${first}。${second}と主張しなかった。`,
    `${first}。${second}。上記の説明を撤回する。`,
    `${first}。${second}。対象乙が主体甲を統治した。`,
  ]) {
    const result = gradeEssay(p, answer)
    assert.equal(result.elements[0]!.status, 'pending')
    assert.equal(result.score, null)
  }
})

test('an approved full contrast can belong to a grouped fact without hiding external negation', () => {
  const p = groupedProfile()
  const contrast = '主体丁ではなく主体甲が対象乙を統治した'
  p.elements[0]!.positive_all![0]![0] = { sequence: [[contrast]], ignore_commas: true, max_gap: 0 }
  p.allowed_context_phrases = [contrast]
  const answer = `${contrast.replace('ではなく', 'ではなく、')}。主体甲が制度丙を廃止した。`
  assert.equal(gradeEssay(p, answer).score, 8)
  assert.equal(gradeEssay(p, answer+'上記は誤りである。').elements[0]!.status, 'pending')
})

test('group definitions are bounded and accept only sentence-scoped complete literal clauses', () => {
  for (const groups of [[], [[]], Array(33).fill([{ sequence: [['合成句']] }]), [Array(9).fill({ sequence: [['合成句']] })], [[{ sequence: [['主体甲'], ['統治した']] }]], [[{ sequence: [['合成句']], scope: 'answer' }]]]) {
    const p = groupedProfile()
    p.elements[0]!.positive_all = groups as any
    assert.throws(() => validateEssayProfile(p), TypeError)
  }
  const empty = groupedProfile()
  delete empty.elements[0]!.positive_all
  assert.throws(() => validateEssayProfile(empty), TypeError)
})

test('an exact answer pattern recognizes only the whole reviewed multi-sentence wording', () => {
  const p = relationshipProfile()
  const answer = '主体甲が対象乙を統治した。その後制度丙を廃止した。'
  p.elements[0]!.positive = [{ sequence: [[answer]], scope: 'answer', exact: true, ignore_commas: true, max_gap: 0 }]
  assert.equal(gradeEssay(p, answer).score, 8)
  assert.equal(gradeEssay(p, answer.replace('主体甲が', '主体甲が、')).score, 8)
  for (const modified of [
    '主体丁が別の政策を行った。'+answer,
    answer+'主体丁が別の政策を行った。',
    answer.replace('その後', '主体丁が別の政策を行った。その後'),
    'もし'+answer+'ならば。',
    answer+'という説明は誤りである。',
    answer+'上記の説明を撤回する。',
    answer+'実施したとは言えない。',
    '主体甲。対象乙。統治。その後。制度丙。廃止。',
  ]) {
    const result = gradeEssay(p, modified)
    assert.equal(result.elements[0]!.status, 'pending')
    assert.equal(result.score, null)
  }
})

test('sentence exactness prevents a reviewed phrase from matching under an added subject', () => {
  const p = relationshipProfile()
  p.elements[0]!.positive = [{ sequence: [['制度丙を廃止した']], exact: true, max_gap: 0 }]
  assert.equal(gradeEssay(p, '制度丙を廃止した。').score, 8)
  assert.equal(gradeEssay(p, '主体丁は制度丙を廃止した。').elements[0]!.status, 'pending')
})
