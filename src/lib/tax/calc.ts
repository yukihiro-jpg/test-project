// 源泉徴収税額の計算
// 注: 月額表（乙欄）の電算機計算式は国税庁公表値を使用。年度切替時は要確認。
// ホステス報酬は所得税法第204条第1項第6号に基づき (支払額 − 5,000円×日数) × 10.21%

export const HOSTESS_DAILY_DEDUCTION = 5000
export const HOSTESS_RATE = 0.1021

export function calcHostessTax(amount: number, days: number): number {
  const base = amount - HOSTESS_DAILY_DEDUCTION * days
  if (base <= 0) return 0
  return Math.floor(base * HOSTESS_RATE)
}

// 月額表 乙欄 電算機計算（令和7年分・8年分共通の主要係数）
// A = 社会保険料等控除後の給与等の金額
export function calcKoyoOtsuTax(salaryAfterInsurance: number): number {
  const A = salaryAfterInsurance
  if (A < 88000) {
    // 88,000円未満
    return Math.floor(A * 0.03063)
  } else if (A <= 740000) {
    // 88,000円以上 740,000円以下
    const t = A * 0.2242 - 17160
    return Math.max(0, Math.floor(t))
  } else if (A <= 1700000) {
    // 740,000円超 1,700,000円以下
    const t = A * 0.33693 - 102259
    return Math.max(0, Math.floor(t))
  } else if (A <= 1700000 + 1000000) {
    // 1,700,000円超 2,700,000円以下
    const t = A * 0.4084 - 222142
    return Math.max(0, Math.floor(t))
  } else if (A <= 3500000) {
    const t = A * 0.4584 - 357142
    return Math.max(0, Math.floor(t))
  } else {
    const t = A * 0.5584 - 707142
    return Math.max(0, Math.floor(t))
  }
}
