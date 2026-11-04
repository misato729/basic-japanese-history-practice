/** Literal, bounded rules. No executable regular expression or model is stored here. */
export type EssayPattern = {
  sequence: string[][]
  max_gap?: number
  scope?: 'sentence' | 'answer'
  /** Ignore reading commas only for a single-slot, complete relationship phrase. */
  ignore_commas?: boolean
  /** Single-slot equality with the whole sentence/answer selected by scope. */
  exact?: boolean
}

export type EssayRuleElement = {
  id: string
  label: string
  points: number
  positive: EssayPattern[]
  /** OR groups of independent full clauses; every pattern in one group must match. */
  positive_all?: EssayPattern[][]
  negative?: EssayPattern[]
}

export type EssayScoringProfile = {
  id: string
  version: number
  title: string
  max_characters: number
  required_terms: string[]
  /** Explicit writing variants of required terms; not general semantic aliases. */
  required_term_variants?: Record<string, string[]>
  elements: EssayRuleElement[]
  /** Explicitly safe negative constructions, e.g. 「避けられない」. */
  allowed_negation_phrases?: string[]
  /** Complete, verified assertions also registered as single-slot positives. */
  allowed_context_phrases?: string[]
  /** Question-specific ambiguity (including unsupported attribution): hold for review. */
  caution_patterns?: EssayPattern[]
}

export type EssayQuestionConfig = {
  profile_id: string
  profile_version: number
  model_answer: string
  /** Calculated by the server; omitted by old/new clients until the first save. */
  profile_digest?: string
}

export type EssayConstraints = {
  max_characters: number
  required_terms: string[]
}

export type EssayElementResult = {
  id: string
  label: string
  points: number
  awarded_points: number | null
  status: 'matched' | 'contradicted' | 'pending'
  evidence: string[]
  reason: string
}

export type EssayGrade = {
  engine_version: string
  profile_id: string
  profile_version: number
  max_points: number
  confirmed_points: number
  pending_points: number
  score: number | null
  grading_status: 'complete' | 'pending' | 'invalid'
  elements: EssayElementResult[]
  constraints: {
    character_count: number
    max_characters: number
    within_limit: boolean
    missing_required_terms: string[]
  }
  /** Always a learning reference, including when all registered rules match. */
  reference_only: true
}
