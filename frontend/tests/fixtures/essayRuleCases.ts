import type { EssayScoringProfile } from '../../shared/types/essay.ts'

/** Synthetic quantities test the engine; they are never loaded by application code. */
export const syntheticEssayProfile: EssayScoringProfile = {
  id: 'synthetic-quantities', version: 1, title: '合成した数量関係の検証', max_characters: 200,
  required_terms: [], allowed_negation_phrases: ['避けられない'],
  elements: [
    { id: 'quantity_a', label: '数量甲の増え方', points: 2,
      positive: [{ sequence: [['数量甲'], ['算術級数', '等差数列'], ['増える', '増加']] }],
      negative: [{ sequence: [['数量甲'], ['幾何級数', '等比数列'], ['増える', '増加']] }] },
    { id: 'quantity_b', label: '数量乙の増え方', points: 2,
      positive: [{ sequence: [['数量乙'], ['幾何級数', '等比数列'], ['増える', '増加']] }],
      negative: [{ sequence: [['数量乙'], ['算術級数', '等差数列'], ['増える', '増加']] }] },
    { id: 'cause', label: '数量の増加と差の関係', points: 2,
      positive: [{ sequence: [['数量乙増加'], ['数量甲増加'], ['上回る'], ['ため'], ['差']] }],
      negative: [{ sequence: [['数量甲増加'], ['数量乙増加'], ['上回る'], ['ため'], ['差']] }] },
    { id: 'adjustment', label: '数量乙の調整', points: 2,
      positive: [{ sequence: [['調整策'], ['数量乙'], ['抑制', '抑える']] }],
      negative: [{ sequence: [['調整策'], ['数量乙'], ['増やす', '増加させる']] }] },
  ],
}

export const syntheticEssayModelAnswer = '数量甲は算術級数的に増える。数量乙は幾何級数的に増加する。数量乙増加が数量甲増加を上回るため差が拡大する。調整策として数量乙の抑制を提案した。'
export const essayModelAnswers: Record<string, string> = { [syntheticEssayProfile.id]: syntheticEssayModelAnswer }

type EssayRuleCase = {
  profile_id: string
  name: string
  answer: string
  expected_confirmed_points?: number
  expected_score?: number | null
  expected_grading_status?: 'complete' | 'pending' | 'invalid'
  must_match?: string[]
  must_not_match?: string[]
  must_pending?: string[]
  expect_unsettled?: boolean
}
const example = (name: string, answer: string, expected: Omit<EssayRuleCase, 'profile_id' | 'name' | 'answer'>): EssayRuleCase => ({ profile_id: syntheticEssayProfile.id, name, answer, ...expected })
export const essayRuleCases: EssayRuleCase[] = [
  example('registered relationships', syntheticEssayModelAnswer, { expected_confirmed_points: 8, expected_score: 8, expected_grading_status: 'complete', must_match: ['quantity_a', 'quantity_b', 'cause', 'adjustment'] }),
  example('registered synonyms', syntheticEssayModelAnswer.replace('算術級数', '等差数列').replace('幾何級数', '等比数列').replace('抑制', '抑える'), { expected_score: 8 }),
  example('line wrapping', syntheticEssayModelAnswer.replace('算術級数', '算術\n級数').replace('数量乙の抑制', '数量\n乙の抑制'), { expected_score: 8 }),
  example('keyword enumeration', '数量甲、数量乙、算術級数、幾何級数、上回る、差、調整策、抑制。', { expected_confirmed_points: 0, expected_score: null, must_pending: ['quantity_a', 'quantity_b', 'cause', 'adjustment'] }),
  example('reversed subject', syntheticEssayModelAnswer.replace('数量甲は算術級数', '数量甲は幾何級数').replace('数量乙は幾何級数', '数量乙は算術級数'), { expected_score: 4, must_not_match: ['quantity_a', 'quantity_b'] }),
  example('reversed cause', syntheticEssayModelAnswer.replace('数量乙増加が数量甲増加を上回る', '数量甲増加が数量乙増加を上回る'), { expected_score: 6, must_not_match: ['cause'] }),
  example('negative policy', syntheticEssayModelAnswer.replace('数量乙の抑制', '数量乙を増やすこと'), { expected_score: 6, must_not_match: ['adjustment'] }),
  example('unknown expression', syntheticEssayModelAnswer.replace('調整策として数量乙の抑制を提案した', '別の手順で調整すべきだと考えた'), { expected_confirmed_points: 6, expected_score: null, must_pending: ['adjustment'] }),
  example('negated positive', syntheticEssayModelAnswer.replace('数量甲は算術級数的に増える', '数量甲は算術級数的に増えると主張しなかった'), { expected_confirmed_points: 6, expected_score: null, must_pending: ['quantity_a'] }),
  example('contradictory pair', syntheticEssayModelAnswer + '数量甲は幾何級数的に増える。', { expected_confirmed_points: 6, expected_score: null, must_pending: ['quantity_a'] }),
  example('hypothesis', '仮に' + syntheticEssayModelAnswer, { expected_confirmed_points: 0, expected_score: null }),
  example('whole-answer retraction', syntheticEssayModelAnswer + '以上はすべて正しくない。', { expected_confirmed_points: 0, expected_score: null }),
  example('unrelated repeal', syntheticEssayModelAnswer + '担当者は運用規則を撤回した。', { expected_score: 8 }),
  example('question suffix', syntheticEssayModelAnswer + '本当ですか？', { expected_confirmed_points: 0, expected_score: null }),
  example('blank input', ' ', { expected_score: null, expected_grading_status: 'invalid' }),
]
