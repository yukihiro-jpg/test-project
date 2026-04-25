export const DEFAULT_ATM_KEYWORDS = [
  'ATM',
  'ＡＴＭ',
  'CD',
  'ＣＤ',
  'AD',
  'ＡＤ',
  'カード',
  'ｶｰﾄﾞ',
  'ATMカード',
  'CDカード',
  'CDツウチョウ',
  '通帳支払',
  'カード支払',
  '引出',
  '引き出し',
  'お引出し',
  'お引出',
  'キャッシング'
]

const STORAGE_KEY = 'bank-analyzer-atm-keywords'

export function loadAtmKeywords(): string[] {
  if (typeof window === 'undefined') return DEFAULT_ATM_KEYWORDS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_ATM_KEYWORDS
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : DEFAULT_ATM_KEYWORDS
  } catch {
    return DEFAULT_ATM_KEYWORDS
  }
}

export function saveAtmKeywords(keywords: string[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keywords))
}

export function isAtmDescription(description: string, keywords: string[]): boolean {
  if (!description) return false
  const target = description.replace(/\s/g, '')
  return keywords.some((kw) => kw && target.includes(kw))
}
