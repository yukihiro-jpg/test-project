export type SummaryPattern = {
  id: string
  label: string
  text: string
}

export const SUMMARY_PATTERNS: SummaryPattern[] = [
  {
    id: 'standard',
    label: '標準（短文）',
    text:
      '被相続人の預貯金等について調査・確認を行った結果、特筆すべき取引とそのお内容は以下の通りです。下記表以外の被相続人の預貯金等の取引については財産性があると考えられるものはありませんでした。'
  },
  {
    id: 'detailed-cash-withdrawal',
    label: '詳細（生活費等の現金引出を含む）',
    text:
      '　被相続人の預貯金等について調査・確認を行った結果、特筆すべき取引とそのお内容は以下の通りです。\n　下記表以外の被相続人の預貯金等の取引については財産性があると考えられるものはありませんでした。\n　被相続人については、生前において現金を随時引き出して生活費、交際費その他私的支出に充てる傾向が認められ、当該出金についても領収書その他その使途を裏付ける資料は確認できなかったものの、\n　預貯金の滞留状況、親族からの聴取内容及び被相続人の金銭使用状況等を総合勘案し、相続開始時点において残存していた財産には該当しないものと判断した。'
  }
]

export const DEFAULT_SUMMARY_PATTERN_ID = 'standard'

const STORAGE_KEY = 'bank-analyzer-summary-pattern-id'

export function loadSummaryPatternId(): string {
  if (typeof window === 'undefined') return DEFAULT_SUMMARY_PATTERN_ID
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_SUMMARY_PATTERN_ID
  } catch {
    return DEFAULT_SUMMARY_PATTERN_ID
  }
}

export function saveSummaryPatternId(id: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {}
}

export function findSummaryPattern(id: string): SummaryPattern {
  return SUMMARY_PATTERNS.find((p) => p.id === id) || SUMMARY_PATTERNS[0]
}
