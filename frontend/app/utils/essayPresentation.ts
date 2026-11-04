import type { EssayElementResult } from '../../shared/types/essay.ts'

export type EssayConstraints = { max_characters: number; required_terms: string[] }

/** Unknown wording stays pending and is never counted as an incorrect element. */
export function essayElementCounts(elements: Pick<EssayElementResult, 'status'>[]) {
  return {
    total: elements.length,
    matched: elements.filter(element => element.status === 'matched').length,
    pending: elements.filter(element => element.status === 'pending').length,
    contradicted: elements.filter(element => element.status === 'contradicted').length,
  }
}

// The published word limit counts punctuation and digits, but excludes whitespace.
export const essayCharacterCount = (value: string) => Array.from(value.replace(/\s/gu, '')).length

export const essayAnswerIssue = (value: string, constraints?: EssayConstraints) => {
  if (!value.trim()) return '回答を入力してください。'
  if (value.length > 4000) return '入力が長すぎます。'
  const maximum = constraints?.max_characters ?? 1000
  if (essayCharacterCount(value) > maximum) return `${maximum}字以内で入力してください。`
  return ''
}
