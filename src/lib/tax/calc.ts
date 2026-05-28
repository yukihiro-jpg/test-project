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

// 1日分のホステス報酬の源泉徴収税額
export function calcHostessDailyTax(amount: number): number {
  return calcHostessTax(amount, 1)
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

// 税理士等の報酬（所204条1項2号）: 1回の支払額が100万円以下 → 10.21%
// 100万円超 → 100万円までは10.21%、超過部分は20.42%
// 入力は税抜報酬額（消費税抜き）。
export function calcZeirishiTax(amount: number): number {
  if (amount <= 0) return 0
  if (amount <= 1000000) return Math.floor(amount * 0.1021)
  return Math.floor(1000000 * 0.1021 + (amount - 1000000) * 0.2042)
}

// 税理士報酬の税込支払額（消費税10%込）
export function calcZeirishiGross(amount: number): number {
  if (amount <= 0) return 0
  return Math.floor(amount * 1.1)
}

// 税理士報酬の差引支払額 = 税込支払額 − 源泉所得税
export function calcZeirishiNet(amount: number): number {
  return calcZeirishiGross(amount) - calcZeirishiTax(amount)
}

// 源泉所得税の納付期限
// 通常: 給与等の支払日の翌月10日
// 納期の特例: 1〜6月支払分 → 7月10日 / 7〜12月支払分 → 翌年1月20日
// いずれも土日祝日の場合は次の平日（祝日判定は省略し、土日のみ繰り下げ）
export function calcDueDate(paymentDate: Date, tokurei: boolean): Date {
  let due: Date
  if (tokurei) {
    const y = paymentDate.getFullYear()
    const m = paymentDate.getMonth() + 1
    if (m >= 1 && m <= 6) {
      due = new Date(y, 6, 10) // 7/10
    } else {
      due = new Date(y + 1, 0, 20) // 翌年1/20
    }
  } else {
    const y = paymentDate.getFullYear()
    const m = paymentDate.getMonth()
    // 翌月10日
    due = new Date(y, m + 1, 10)
  }
  // 土日繰り下げ
  while (due.getDay() === 0 || due.getDay() === 6) {
    due = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1)
  }
  return due
}

export function formatJpDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`
}

