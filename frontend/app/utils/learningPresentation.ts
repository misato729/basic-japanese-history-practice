import type { GroupPassage, InputConstraints, LearningBlock, SourceReference } from '../../shared/types/learning.ts'

export const passageAnchorId = (passageId: number, anchorId?: string | null) => (
  anchorId ? `passage-${passageId}-${anchorId}` : `passage-${passageId}`
)

export const shortAnswerIssue = (value: string, constraints: InputConstraints = {}) => {
  const normalized = value.normalize('NFKC').trim()
  const text = constraints.ignore_book_brackets ? normalized.replace(/^[『「](.*)[』」]$/u, '$1') : normalized
  if (!text) return '回答を入力してください。'
  const length = [...text].length
  if (constraints.exact_length && length !== constraints.exact_length) return `${constraints.exact_length}字で入力してください。`
  const maxLength = constraints.max_length ?? 1000
  if (length > maxLength) return `${maxLength}字以内で入力してください。`
  if (constraints.script === 'kanji' && !/^[\p{Script=Han}々〇]+$/u.test(text)) return '漢字で入力してください。'
  if (constraints.script === 'katakana' && !/^[\p{Script=Katakana}ー・＝=\s]+$/u.test(text)) return 'カタカナで入力してください。'
  return ''
}

export const inputConstraintLabel = (constraints: InputConstraints = {}) => (
  constraints.hint || [constraints.script === 'kanji' ? '漢字' : constraints.script === 'katakana' ? 'カタカナ' : '',
    constraints.exact_length ? `${constraints.exact_length}字` : constraints.max_length ? `${constraints.max_length}字以内` : ''].filter(Boolean).join('・')
)

const publicHttpsUrl = (value?: string) => {
  try {
    const url = new URL(value ?? '')
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : null
  } catch { return null }
}

const withoutCapturedBookPages = (value: string) => {
  const text = value.replace(/(詳説日本史|日本史用語集|日本史新課程用語)\s*PDF\s*\d+頁(?:（印刷\d+頁）)?/gu, '$1')
  const names = text.split('、').map(name => name.trim())
  return names.every(name => ['詳説日本史', '日本史用語集', '日本史新課程用語'].includes(name))
    ? [...new Set(names)].join('、') : text
}

const isPlainTextBlock = (block?: LearningBlock): block is LearningBlock & { text: string } => (
  block?.type === 'text' && typeof block.text === 'string' && Object.keys(block).every(key => key === 'type' || key === 'text')
)

const learnerExplanationBlocks = (blocks: LearningBlock[]) => {
  const result: LearningBlock[] = []
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!
    const next = blocks[index + 1]
    // Legacy imports placed the authoring grade and its review route in a known pair.
    if (isPlainTextBlock(block) && /^難度の再評価：知識要求 K\d+／判断・処理 P\d+。$/u.test(block.text)
      && isPlainTextBlock(next) && next.text.trim()) {
      index++
      continue
    }
    result.push(block)
  }
  return result
}

const learnerExplanationText = (value: string) => {
  const text = withoutCapturedBookPages(value)
  // Keep the original work and all quotation/editing notes; drop import-only tags and duplicate book locators.
  const provenance = text.match(/^資料の出典・性格：([\s\S]+)／(?:primary_quote|author_summary|authored_table)。(?:詳説日本史|日本史用語集|日本史新課程用語)(?:、(?:詳説日本史|日本史用語集|日本史新課程用語))*。$/u)
  return provenance ? `資料の出典：${provenance[1]}` : text
}

export const presentExplanationBlocks = (blocks: LearningBlock[] = []): LearningBlock[] => learnerExplanationBlocks(blocks).map(block => ({
  ...block,
  ...(block.text !== undefined ? { text: learnerExplanationText(block.text) } : {}),
  ...(block.source ? { source: withoutCapturedBookPages(block.source) } : {}),
  ...(block.rows ? { rows: block.rows.map(row => row.map(withoutCapturedBookPages)) } : {}),
  ...(block.inlines ? { inlines: block.inlines.map(inline => inline.type === 'blank' ? inline : { ...inline, text: withoutCapturedBookPages(inline.text) }) } : {}),
}))

export const presentSources = (references: SourceReference[] = [], legacy?: string | null): { label: string; url: string | null }[] => {
  if (references.length) return references.map(source => {
    // Book locators can be positions in a privately captured PDF, not shared book pages.
    const section = source.section?.trim() || (source.kind === 'book' ? '確認用語：未確認' : null)
    return {
      label: [source.title, source.publisher, source.edition, source.publication_year,
        section, source.kind === 'book' ? null : source.locator].filter(Boolean).join('・'),
      url: publicHttpsUrl(source.url),
    }
  })
  return (legacy ?? '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const separator = line.lastIndexOf('|')
    if (separator === -1) return { label: line, url: null }
    const url = publicHttpsUrl(line.slice(separator + 1).trim())
    return { label: url ? line.slice(0, separator).trim() || url : line, url }
  })
}

// Imported questions carry a standalone number/score before the actual stem.
export const presentQuestionBlocks = (blocks: LearningBlock[]): LearningBlock[] => {
  const first = blocks[0]
  return isPlainTextBlock(first) && /^問[0-9０-９]+[（(][0-9０-９]+点[）)]$/u.test(first.text.trim())
    ? blocks.slice(1) : blocks
}

export type PresentedPassage = GroupPassage & { heading_title?: string }

const presentMockTwoPassageText = (text: string) => text
  .replace(/[（(]本文は作問者作成[）)]/gu, '')
  .replace(/[ \t　]*[（(]作問者作成[）)]/gu, '')
  .replace(/作問者が(?=まとめた説明)/gu, '')
  .replace(/問1[〜～]9(?:・|と)問10(?![0-9])/gu, '問1〜10')
  .replace(/問1[〜～]10・6(?![0-9])/gu, '問1〜10')
  .replace(/次の問1[〜～]10に答えなさい。/gu, '')
  .replace(/次の文章を読み、問1[〜～]10に(?:答えなさい|答えよ)。/gu, '')
  .replace(/次の文章は、近世の政治・社会と文化の展開をまとめたものである[ \t　]*。/gu, '')
  .replace(/文章は教科書の記述をもとにまとめた説明であり、史料の引用ではない。/gu, '')

// Mock 1's legacy guidance names the whole group using global coordinates.
export const presentSharedPassages = (passages: GroupPassage[], examNumber: number, questionNumbers: number[]): PresentedPassage[] => {
  if (examNumber === 2) return passages.map(passage => ({
    ...passage,
    content_blocks: passage.content_blocks.flatMap(block => {
      if (block.type !== 'text') return [block]
      const text = typeof block.text === 'string' ? presentMockTwoPassageText(block.text) : undefined
      if (text !== undefined && !text.trim() && isPlainTextBlock(block)) return []
      return [{ ...block, ...(text !== undefined ? { text } : {}), ...(block.inlines ? { inlines: block.inlines.map(part => part.type === 'text'
        ? { ...part, text: presentMockTwoPassageText(part.text) } : part) } : {}) }]
    }),
  }))
  if (examNumber !== 1 || questionNumbers.length === 0) return passages
  const range = new RegExp(`問${questionNumbers[0]}[〜～]${questionNumbers.at(-1)}(?![0-9])`, 'gu')
  return passages.map(passage => passage.label === '案内' ? {
    ...passage,
    content_blocks: passage.content_blocks.map(block => isPlainTextBlock(block)
      ? { ...block, text: block.text.replace(range, `問1〜${questionNumbers.length}`) } : block),
  } : passage).map(passage => {
    const first = passage.content_blocks[0]
    if (!/^[A-Z]$/u.test(passage.label) || !isPlainTextBlock(first)) return passage
    const heading = first.text.trim().match(/^([A-Z])(?:[ \t　]+([^\r\n]+))?$/u)
    if (!heading || heading[1] !== passage.label) return passage
    return { ...passage, heading_title: heading[2]?.trim(), content_blocks: passage.content_blocks.slice(1) }
  })
}
