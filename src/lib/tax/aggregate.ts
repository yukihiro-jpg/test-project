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
