export type SummaryPattern = {
  id: string
  label: string
  text: string
  builtIn?: boolean
}

export const BUILT_IN_PATTERNS: SummaryPattern[] = [
  {
    id: 'standard',
    label: '標準（短文）',
    builtIn: true,
    text:
      '被相続人の預貯金等について調査・確認を行った結果、特筆すべき取引とそのお内容は以下の通りです。下記表以外の被相続人の預貯金等の取引については財産性があると考えられるものはありませんでした。'
  },
  {
    id: 'detailed-cash-withdrawal',
    label: '詳細（生活費等の現金引出を含む）',
    builtIn: true,
    text:
      '　被相続人の預貯金等について調査・確認を行った結果、特筆すべき取引とそのお内容は以下の通りです。\n　下記表以外の被相続人の預貯金等の取引については財産性があると考えられるものはありませんでした。\n　被相続人については、生前において現金を随時引き出して生活費、交際費その他私的支出に充てる傾向が認められ、当該出金についても領収書その他その使途を裏付ける資料は確認できなかったものの、預貯金の滞留状況、親族からの聴取内容及び被相続人の金銭使用状況等を総合勘案し、相続開始時点において残存していた財産には該当しないものと判断した。'
  }
]

export const DEFAULT_SUMMARY_PATTERN_ID = 'standard'

const SELECTED_KEY = 'bank-analyzer-summary-pattern-id'
const CUSTOM_KEY = 'bank-analyzer-summary-patterns-custom'

export function loadSummaryPatternId(): string {
  if (typeof window === 'undefined') return DEFAULT_SUMMARY_PATTERN_ID
  try {
    return window.localStorage.getItem(SELECTED_KEY) || DEFAULT_SUMMARY_PATTERN_ID
  } catch {
    return DEFAULT_SUMMARY_PATTERN_ID
  }
}

export function saveSummaryPatternId(id: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SELECTED_KEY, id)
  } catch {}
}

export function loadCustomPatterns(): SummaryPattern[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p) => p && typeof p.id === 'string' && typeof p.label === 'string' && typeof p.text === 'string')
      .map((p) => ({ id: p.id, label: p.label, text: p.text }))
  } catch {
    return []
  }
}

export function saveCustomPatterns(patterns: SummaryPattern[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(patterns))
  } catch {}
}

export function getAllPatterns(customs: SummaryPattern[]): SummaryPattern[] {
  return [...BUILT_IN_PATTERNS, ...customs]
}

export function findSummaryPattern(allPatterns: SummaryPattern[], id: string): SummaryPattern {
  return allPatterns.find((p) => p.id === id) || allPatterns[0]
}

export function generatePatternId(): string {
  return `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}
