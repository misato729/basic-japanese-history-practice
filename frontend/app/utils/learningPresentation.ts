import type { InputConstraints, LearningBlock, SourceReference } from '../../shared/types/learning.ts'

export const passageAnchorId = (passageId: number, anchorId?: string | null) => (
  anchorId ? `passage-${passageId}-${anchorId}` : `passage-${passageId}`
)

export const shortAnswerIssue = (value: string, constraints: InputConstraints = {}) => {
  const text = value.normalize('NFKC').trim()
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
