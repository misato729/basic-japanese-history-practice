import type { EssayElementResult, EssayGrade, EssayPattern, EssayRuleElement, EssayScoringProfile } from '../../shared/types/essay.ts'

export const ESSAY_SCORING_ENGINE_VERSION = 'literal-rules-v3'
export const MAX_ESSAY_CHARACTERS = 1000
const MAX_RAW_CHARACTERS = 4000
const MAX_OPERATIONS = 100000
const DEFAULT_MAX_GAP = 24

const normalized = (value: string) => value.normalize('NFKC').replace(/\s/gu, '')
const withoutReadingCommas = (value: string) => value.replace(/[、，,]/gu, '')
/** Matches the manuscripts: punctuation counts; all whitespace and line breaks do not. */
export function countEssayCharacters(value: string): number {
  return Array.from(value.replace(/\s/gu, '')).length
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = (value: unknown, maximum = 200): value is string => typeof value === 'string' && normalized(value).length > 0 && Array.from(value).length <= maximum
const isInteger = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
function invalidProfile(): never { throw new TypeError('論述の採点ルールを確認してください') }

function validatePatterns(value: unknown, required: boolean): asserts value is EssayPattern[] {
  if (value === undefined && !required) return
  if (!Array.isArray(value) || value.length > 64 || (required && value.length < 1)) invalidProfile()
  for (const pattern of value) {
    if (!isRecord(pattern) || !Array.isArray(pattern.sequence) || pattern.sequence.length < 1 || pattern.sequence.length > 12) invalidProfile()
    if (pattern.exact !== undefined && (typeof pattern.exact !== 'boolean' || (pattern.exact && pattern.sequence.length !== 1))) invalidProfile()
    if (pattern.ignore_commas !== undefined && (typeof pattern.ignore_commas !== 'boolean' || (pattern.ignore_commas && pattern.sequence.length !== 1))) invalidProfile()
    if (pattern.scope !== undefined && !['sentence', 'answer'].includes(String(pattern.scope))) invalidProfile()
    if (pattern.max_gap !== undefined && !isInteger(pattern.max_gap, 0, MAX_ESSAY_CHARACTERS)) invalidProfile()
    for (const alternatives of pattern.sequence) {
      if (!Array.isArray(alternatives) || alternatives.length < 1 || alternatives.length > 32 || !alternatives.every(word => isText(word, 160))) invalidProfile()
      if (pattern.ignore_commas && alternatives.some(word => !withoutReadingCommas(normalized(String(word))).length)) invalidProfile()
    }
  }
}

function validatePositiveGroups(value: unknown): asserts value is EssayPattern[][] | undefined {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) invalidProfile()
  for (const group of value) {
    if (!Array.isArray(group) || group.length < 1 || group.length > 8) invalidProfile()
    validatePatterns(group, true)
    // Joining independent facts is explicit at the group level, never through
    // an answer-wide token sequence or an unbounded gap across sentences.
    if (group.some(pattern => pattern.sequence.length !== 1 || (pattern.scope !== undefined && pattern.scope !== 'sentence'))) invalidProfile()
  }
}

/** Validate catalog data and reject malformed/unbounded rule definitions. */
export function validateEssayProfile(value: unknown): asserts value is EssayScoringProfile {
  if (!isRecord(value) || !isText(value.id, 100) || !/^[a-zA-Z0-9_-]+$/.test(value.id) || !isText(value.title)) invalidProfile()
  if (!isInteger(value.version, 1, 1000000) || !isInteger(value.max_characters, 1, MAX_ESSAY_CHARACTERS)) invalidProfile()
  if (!Array.isArray(value.required_terms) || value.required_terms.length > 20 || !value.required_terms.every(term => isText(term, 100))) invalidProfile()
  if (new Set(value.required_terms.map(term => normalized(term))).size !== value.required_terms.length) invalidProfile()
  if (value.required_term_variants !== undefined) {
    if (!isRecord(value.required_term_variants)) invalidProfile()
    for (const [term, variants] of Object.entries(value.required_term_variants)) {
      if (!value.required_terms.includes(term) || !Array.isArray(variants) || variants.length < 1 || variants.length > 32 || !variants.every(variant => isText(variant, 100))) invalidProfile()
      const forms = [term, ...variants].map(form => normalized(form as string))
      if (new Set(forms).size !== forms.length) invalidProfile()
    }
  }
  if (!Array.isArray(value.elements) || value.elements.length < 1 || value.elements.length > 8) invalidProfile()
  let points = 0
  const ids = new Set<string>()
  for (const element of value.elements) {
    if (!isRecord(element) || !isText(element.id, 100) || !isText(element.label, 500) || !isInteger(element.points, 1, 8) || ids.has(element.id)) invalidProfile()
    ids.add(element.id)
    points += element.points
    validatePositiveGroups(element.positive_all)
    if (!Array.isArray(element.positive)) invalidProfile()
    validatePatterns(element.positive, element.positive_all === undefined)
    validatePatterns(element.negative, false)
  }
  if (points !== 8) invalidProfile()
  if (value.allowed_negation_phrases !== undefined && (!Array.isArray(value.allowed_negation_phrases) || value.allowed_negation_phrases.length > 32 || !value.allowed_negation_phrases.every(phrase => isText(phrase, 160)))) invalidProfile()
  if (value.allowed_context_phrases !== undefined) {
    if (!Array.isArray(value.allowed_context_phrases) || value.allowed_context_phrases.length > 64 || !value.allowed_context_phrases.every(phrase => isText(phrase, 160))) invalidProfile()
    const phrases = value.allowed_context_phrases.map(phrase => normalized(phrase as string))
    if (new Set(phrases).size !== phrases.length) invalidProfile()
    const profile = value as unknown as EssayScoringProfile
    if (phrases.some(phrase => !singleSlotContext(profile, phrase))) invalidProfile()
  }
  validatePatterns(value.caution_patterns, false)
}

type Segment = { raw: string; text: string }
type Budget = { remaining: number }
type ApprovedContext = { text: string; ignoreCommas: boolean }
class ComparisonLimit extends Error {}
function spend(budget: Budget) { if (--budget.remaining < 0) throw new ComparisonLimit() }

function singleSlotContext(profile: EssayScoringProfile, phrase: string): ApprovedContext | undefined {
  for (const element of profile.elements) {
    for (const pattern of [...element.positive, ...(element.positive_all ?? []).flat()]) {
      if (pattern.sequence.length !== 1) continue
      const ignoreCommas = pattern.ignore_commas === true
      const comparable = (value: string) => ignoreCommas ? withoutReadingCommas(value) : value
      if (pattern.sequence[0]!.some(word => comparable(normalized(word)) === comparable(phrase))) return { text: phrase, ignoreCommas }
    }
  }
  return undefined
}

/** Preserve offsets so a registered assertion cannot hide its surrounding text. */
function unprotectedParts(text: string, contexts: ApprovedContext[], budget: Budget): string[] {
  if (!contexts.length) return [text]
  const ranges: Array<[number, number]> = []
  for (const context of contexts) {
    spend(budget)
    const offsets: number[] = []
    let comparable = ''
    for (let index = 0; index < text.length; index++) {
      if (context.ignoreCommas && /[、，,]/u.test(text[index]!)) continue
      comparable += text[index]
      offsets.push(index)
    }
    const token = context.ignoreCommas ? withoutReadingCommas(context.text) : context.text
    let position = comparable.indexOf(token)
    while (position !== -1) {
      spend(budget)
      ranges.push([offsets[position]!, offsets[position + token.length - 1]! + 1])
      position = comparable.indexOf(token, position + 1)
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  const parts: string[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(text.slice(cursor, start))
    cursor = Math.max(cursor, end)
  }
  parts.push(text.slice(cursor))
  return parts
}

/** Dynamic endpoints avoid exponential backtracking when a word occurs repeatedly. */
function matches(text: string, pattern: EssayPattern, budget: Budget): boolean {
  if (pattern.ignore_commas) text = withoutReadingCommas(text)
  if (pattern.exact) return pattern.sequence[0]!.some(word => {
    spend(budget)
    const token = normalized(word)
    return text === (pattern.ignore_commas ? withoutReadingCommas(token) : token)
  })
  const gap = pattern.max_gap ?? DEFAULT_MAX_GAP
  let ends = new Set<number>()
  for (const word of pattern.sequence[0]!) {
    const token = pattern.ignore_commas ? withoutReadingCommas(normalized(word)) : normalized(word)
    let position = text.indexOf(token)
    while (position !== -1) {
      spend(budget)
      ends.add(position + token.length)
      position = text.indexOf(token, position + 1)
    }
  }
  for (const alternatives of pattern.sequence.slice(1)) {
    const next = new Set<number>()
    for (const end of ends) {
      for (const word of alternatives) {
        const token = normalized(word)
        let position = text.indexOf(token, end)
        while (position !== -1 && Array.from(text.slice(end, position)).length <= gap) {
          spend(budget)
          next.add(position + token.length)
          position = text.indexOf(token, position + 1)
        }
        spend(budget)
      }
    }
    ends = next
    if (!ends.size) return false
  }
  return ends.size > 0
}

function matchingSegments(patterns: EssayPattern[] | undefined, segments: Segment[], whole: Segment, budget: Budget, protectedContexts: ApprovedContext[] = []): Segment[] {
  const result = new Map<string, Segment>()
  for (const pattern of patterns ?? []) {
    for (const segment of pattern.scope === 'answer' ? [whole] : segments) {
      spend(budget)
      if (unprotectedParts(segment.text, protectedContexts, budget).some(text => matches(text, pattern, budget))) result.set(segment.raw, segment)
    }
  }
  return [...result.values()]
}

function positiveSegments(element: EssayRuleElement, segments: Segment[], whole: Segment, budget: Budget): Segment[] {
  const result = new Map<string, Segment>(matchingSegments(element.positive, segments, whole, budget).map(segment => [segment.raw, segment]))
  for (const group of element.positive_all ?? []) {
    const evidence: Segment[] = []
    let complete = true
    for (const pattern of group) {
      const matched = matchingSegments([pattern], segments, whole, budget)
      if (!matched.length) { complete = false; break }
      evidence.push(...matched)
    }
    if (complete) for (const segment of evidence) result.set(segment.raw, segment)
  }
  return [...result.values()]
}

// These constructions may quote, reject, hypothesize or qualify an otherwise matching
// claim. They are held rather than silently interpreted by a bag-of-words rule.
const UNCERTAIN_CONTEXT = [
  '仮に', 'もし', 'ならば', 'だったら', 'と仮定', 'という仮定', 'かもしれ', 'だろう',
  '誤り', '誤答', '誤っ', '誤解', '虚偽', '正しくない', '正しく無い', '正しくなかった', '正しくありません', '正反対', '事実と異な', '事実ではな', '事実ではありません', 'でたらめ', '出鱈目',
  '間違い', '間違っ', '嘘', '偽り', 'ではなく', 'でなく', 'を否定', 'と否定', 'は否定', '?', '本当ですか', '本当か', '正しいですか', '正しいか',
  'を批判', 'と批判', 'という説', 'という意見', 'と言えるか', 'といえるか', 'かどうか',
]
const NEGATIVE_PHRASES = [
  'ない', '無い', 'なかった', 'なかっ', 'なかろ', 'ません', 'まい', 'ず', 'ぬ', 'せん', 'ではありません', 'とは限ら',
  'わけでは', 'とはいえ', 'とは言え', '未だ', '不可能', '無関係',
]

function uncertain(text: string, contexts: ApprovedContext[], budget: Budget): boolean {
  // A historical repeal is an assertion, not the student's retraction of an answer.
  const selfCorrection = /(?:前述|上述|以上|上記|この|先の|私の)(?:の)?(?:発言|答案|解答|説明|内容|文|記述)?(?:を|は)?(?:撤回|取消|取り消|訂正)|(?:説明|発言|答案|解答)(?:を|は)(?:撤回|取消|取り消|訂正)|訂正(?:する|します)/u.test(text)
  return selfCorrection || unprotectedParts(text, contexts, budget).some(part => UNCERTAIN_CONTEXT.some(phrase => part.includes(phrase)))
}
function hasUnscopedNegation(text: string, profile: EssayScoringProfile, contexts: ApprovedContext[], budget: Budget): boolean {
  return unprotectedParts(text, contexts, budget).some(part => {
    let remaining = part
    // Only remove ambiguous lexical words at a clause boundary: globally removing
    // まず or わずか would also erase the negation in 望まず or 負わずかつ.
    remaining = remaining.split('必ず').join('')
    remaining = remaining.replace(/(^|[、，,：:])(?:まず|わずか|いずれ|みずから)/gu, '$1')
    // A particle before these forms is a lexical boundary; a verb stem in
    // 負わずかなり / 望まず remains untouched and still requires confirmation.
    remaining = remaining.replace(/(^|[、，,：:はがをにでとのもへ])(?:わずか(?=な|に|[0-9一二三四五六七八九十百千万])|いずれ(?=も|か))/gu, '$1')
    for (const phrase of profile.allowed_negation_phrases ?? []) remaining = remaining.split(normalized(phrase)).join('')
    return NEGATIVE_PHRASES.some(phrase => remaining.includes(phrase))
  })
}

function elementResult(profile: EssayScoringProfile, answer: string, segments: Segment[], whole: Segment, budget: Budget): EssayElementResult[] {
  const contexts = (profile.allowed_context_phrases ?? []).map(phrase => singleSlotContext(profile, normalized(phrase))!)
  const caution = uncertain(whole.text, contexts, budget) || matchingSegments(profile.caution_patterns, segments, whole, budget).length > 0
  return profile.elements.map(element => {
    const base = { id: element.id, label: element.label, points: element.points }
    if (caution) return { ...base, status: 'pending', awarded_points: null, evidence: [], reason: '仮定・否定する対象・発言の主体など、文脈の確認が必要です。' }
    const positive = positiveSegments(element, segments, whole, budget)
    const negative = matchingSegments(element.negative, segments, whole, budget, contexts)
    if (positive.length && negative.length) return { ...base, status: 'pending', awarded_points: null, evidence: [...new Set([...positive, ...negative].map(s => s.raw))], reason: '対応する説明と矛盾する説明の両方があり、確認が必要です。' }
    if (negative.length) {
      if (negative.some(segment => hasUnscopedNegation(segment.text, profile, contexts, budget))) return { ...base, status: 'pending', awarded_points: null, evidence: negative.map(s => s.raw), reason: '誤りのパターンに似た説明が否定されており、そのかかり先の確認が必要です。' }
      return { ...base, status: 'contradicted', awarded_points: 0, evidence: negative.map(s => s.raw), reason: '登録した誤りのパターンに一致しました。' }
    }
    if (positive.length) {
      if (positive.some(segment => hasUnscopedNegation(segment.text, profile, contexts, budget))) return { ...base, status: 'pending', awarded_points: null, evidence: positive.map(s => s.raw), reason: '一致した説明に否定・限定の表現があり、そのかかり先の確認が必要です。' }
      return { ...base, status: 'matched', awarded_points: element.points, evidence: positive.map(s => s.raw), reason: '登録した表現・語句の対応・順序に一致しました。' }
    }
    return { ...base, status: 'pending', awarded_points: null, evidence: [], reason: answer.trim() ? '登録ルールではこの要素を確認できません。表現の違いと記述不足を区別するため判定を保留します。' : '答案が未入力のため判定を保留します。' }
  })
}

export function gradeEssay(profile: EssayScoringProfile, answer: string): EssayGrade {
  validateEssayProfile(profile)
  if (typeof answer !== 'string') throw new TypeError('論述答案は文字列で指定してください')
  const characterCount = countEssayCharacters(answer)
  const tooLarge = answer.length > MAX_RAW_CHARACTERS || characterCount > MAX_ESSAY_CHARACTERS
  const whole = { raw: answer.trim(), text: tooLarge ? '' : normalized(answer) }
  const constraints = {
    character_count: characterCount,
    max_characters: profile.max_characters,
    within_limit: characterCount > 0 && characterCount <= profile.max_characters && !tooLarge,
    missing_required_terms: profile.required_terms.filter(term => ![term, ...(profile.required_term_variants?.[term] ?? [])].some(form => whole.text.includes(normalized(form)))),
  }
  let elements: EssayElementResult[]
  try {
    const segments = tooLarge ? [] : answer.split(/[。．.！？!?;；]+/u).filter(part => part.trim()).map(raw => ({ raw: raw.trim(), text: normalized(raw) }))
    elements = tooLarge ? profile.elements.map(element => ({ id: element.id, label: element.label, points: element.points, awarded_points: null, status: 'pending', evidence: [], reason: '入力が長すぎるため判定していません。' })) : elementResult(profile, answer, segments, whole, { remaining: MAX_OPERATIONS })
  } catch (error) {
    if (!(error instanceof ComparisonLimit)) throw error
    elements = profile.elements.map(element => ({ id: element.id, label: element.label, points: element.points, awarded_points: null, status: 'pending', evidence: [], reason: '安全に比較できる回数を超えたため判定を保留しました。' }))
  }
  const confirmedPoints = elements.reduce((total, element) => total + (element.awarded_points ?? 0), 0)
  const pendingPoints = elements.reduce((total, element) => total + (element.status === 'pending' ? element.points : 0), 0)
  const invalid = !constraints.within_limit || constraints.missing_required_terms.length > 0
  return {
    engine_version: ESSAY_SCORING_ENGINE_VERSION, profile_id: profile.id, profile_version: profile.version,
    max_points: profile.elements.reduce((total, element) => total + element.points, 0),
    confirmed_points: confirmedPoints, pending_points: pendingPoints,
    score: invalid || pendingPoints > 0 ? null : confirmedPoints,
    grading_status: invalid ? 'invalid' : pendingPoints > 0 ? 'pending' : 'complete',
    elements, constraints, reference_only: true,
  }
}
