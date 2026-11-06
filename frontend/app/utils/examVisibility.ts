/**
 * Temporary display policy for the home page and desktop/mobile sidebar.
 * This is navigation filtering, not API authorization or DB publication control.
 * Keep config/exam.json and the stored exams unchanged so later sets can be restored.
 */
export const VISIBLE_EXAM_NUMBERS: readonly number[] = Object.freeze([1, 2, 3, 4])

const visibleExamNumbers = new Set<number>(VISIBLE_EXAM_NUMBERS)

export const isVisibleExam = (exam: { exam_number: number }): boolean => (
  visibleExamNumbers.has(exam.exam_number)
)
