import { EXAM_CONFIG } from './examConfig.ts'

// Configured slots may appear in navigation; the API controls publication and access.
export const VISIBLE_EXAM_NUMBERS: readonly number[] = Object.freeze(
  Array.from({ length: EXAM_CONFIG.exam.set_count }, (_, index) => index + 1),
)

const visibleExamNumbers = new Set<number>(VISIBLE_EXAM_NUMBERS)

export const isVisibleExam = (exam: { exam_number: number }): boolean => (
  visibleExamNumbers.has(exam.exam_number)
)
