import { Employee, TaxAccountant, DailyPayment } from './storage'
import { calcHostessDailyTax, calcKoyoOtsuTax, calcZeirishiGross, calcZeirishiTax } from './calc'

export type MonthlyAggregate = {
  koyo: { people: number; amount: number; tax: number }
  hostess: { people: number; amount: number; tax: number }
  zeirishi: { people: number; amount: number; tax: number }
}

export function aggregateMonth(
  year: number,
  month: number,
  employees: Employee[],
  payments: DailyPayment[],
  accountants: TaxAccountant[],
): MonthlyAggregate {
  const result: MonthlyAggregate = {
    koyo: { people: 0, amount: 0, tax: 0 },
    hostess: { people: 0, amount: 0, tax: 0 },
    zeirishi: { people: 0, amount: 0, tax: 0 },
  }

  const koyoIds = new Set<string>()
  const hostessIds = new Set<string>()

  payments.forEach(p => {
    const dt = new Date(p.date + 'T00:00:00')
    if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) return
    const emp = employees.find(e => e.id === p.employeeId)
    if (!emp) return
    if (emp.kind === 'hostess') {
      hostessIds.add(emp.id)
      result.hostess.amount += p.amount
      result.hostess.tax += calcHostessDailyTax(p.amount)
    } else {
      koyoIds.add(emp.id)
      result.koyo.amount += p.amount
      result.koyo.tax += calcKoyoOtsuTax(p.amount)
    }
  })

  result.koyo.people = koyoIds.size
  result.hostess.people = hostessIds.size

  accountants.forEach(a => {
    if (!a.paymentMonths.includes(month)) return
    result.zeirishi.people += 1
    // 納付書「支払金額」は税込で記載
    result.zeirishi.amount += calcZeirishiGross(a.amount)
    result.zeirishi.tax += calcZeirishiTax(a.amount)
  })

  return result
}

// 納期特例の半期集計（1-6月 or 7-12月）
export function aggregateHalfYear(
  year: number,
  half: 'first' | 'second',
  employees: Employee[],
  payments: DailyPayment[],
  accountants: TaxAccountant[],
): MonthlyAggregate {
  const months = half === 'first' ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]
  const sum: MonthlyAggregate = {
    koyo: { people: 0, amount: 0, tax: 0 },
    hostess: { people: 0, amount: 0, tax: 0 },
    zeirishi: { people: 0, amount: 0, tax: 0 },
  }
  const koyoIds = new Set<string>()
  const hostessIds = new Set<string>()
  const zeirishiIds = new Set<string>()

  months.forEach(m => {
    const r = aggregateMonth(year, m, employees, payments, accountants)
    sum.koyo.amount += r.koyo.amount
    sum.koyo.tax += r.koyo.tax
    sum.hostess.amount += r.hostess.amount
    sum.hostess.tax += r.hostess.tax
    sum.zeirishi.amount += r.zeirishi.amount
    sum.zeirishi.tax += r.zeirishi.tax
  })

  // 実人員：半期中に支払のあった人の延べ重複を排除
  payments.forEach(p => {
    const dt = new Date(p.date + 'T00:00:00')
    if (dt.getFullYear() !== year) return
    if (!months.includes(dt.getMonth() + 1)) return
    const emp = employees.find(e => e.id === p.employeeId)
    if (!emp) return
    if (emp.kind === 'hostess') hostessIds.add(emp.id)
    else koyoIds.add(emp.id)
  })
  accountants.forEach(a => {
    if (months.some(m => a.paymentMonths.includes(m))) zeirishiIds.add(a.id)
  })

  sum.koyo.people = koyoIds.size
  sum.hostess.people = hostessIds.size
  sum.zeirishi.people = zeirishiIds.size

  return sum
}
