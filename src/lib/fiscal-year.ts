/**
 * 和暦年度の定義と変換ユーティリティ
 *
 * URL形式: year=R8 (令和8年度)
 * 表示形式: 令和8年度
 * フォルダ名: 令和8年度
 */

export interface FiscalYear {
  /** URLパラメータ用ID (例: "R8") */
  id: string
  /** 表示名 (例: "令和8年度") */
  label: string
  /** 西暦 (例: 2026) */
  westernYear: number
  /** 和暦年数 (例: 8) */
  reiwaYear: number
}

/** 利用可能な年度一覧（新しい年度を追加する場合はここに追記） */
export const FISCAL_YEARS: FiscalYear[] = [
  { id: 'R8', label: '令和8年度', westernYear: 2026, reiwaYear: 8 },
  { id: 'R9', label: '令和9年度', westernYear: 2027, reiwaYear: 9 },
  { id: 'R10', label: '令和10年度', westernYear: 2028, reiwaYear: 10 },
]

export function getFiscalYear(id: string): FiscalYear | undefined {
  return FISCAL_YEARS.find((fy) => fy.id === id)
}

export function getFiscalYearLabel(id: string): string {
  return getFiscalYear(id)?.label ?? id
}

/** 現在の年度IDを推定（12月〜翌3月は当年度扱い） */
export function getCurrentFiscalYearId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const reiwaYear = year - 2018
  return `R${reiwaYear}`
}
