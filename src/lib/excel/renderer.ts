/**
 * ExcelJS による Excel 資料生成
 *
 * 社長が自分で数字を加工できるよう、数値セルは数値型・式セルは式として埋め込む。
 * グラフは Excel ネイティブの series として出力する（将来実装）。
 */

import ExcelJS from 'exceljs'
import type { ReportSection } from '../types'

export interface ExcelRenderOptions {
  clientName: string
  year: number
  month: number
  sections: ReportSection[]
}

export async function renderReportExcel(opts: ExcelRenderOptions): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = '月次財務報告アプリ'
  wb.created = new Date()

  // 表紙シート
  const cover = wb.addWorksheet('表紙')
  cover.addRow([`${opts.clientName} 月次財務報告`])
  cover.addRow([`${opts.year}年${opts.month}月`])
  cover.getRow(1).font = { bold: true, size: 16 }
  cover.getRow(2).font = { size: 12 }

  // 各セクションをシートに展開
  for (const section of opts.sections) {
    const sheet = wb.addWorksheet(shortTitle(section.type))
    sheet.addRow([section.title])
    sheet.getRow(1).font = { bold: true, size: 14 }
    renderSectionToSheet(sheet, section)
  }

  return Buffer.from(await wb.xlsx.writeBuffer())
}

function shortTitle(type: string): string {
  const map: Record<string, string> = {
    executive_summary: 'サマリー',
    performance: '業績',
    trend: 'トレンド',
    variance_analysis: '増減要因',
    cash_flow: '資金繰り',
    segment: '部門別',
    advisories: '論点',
    action_items: 'アクション',
  }
  return map[type] ?? type.slice(0, 12)
}

function renderSectionToSheet(sheet: ExcelJS.Worksheet, section: ReportSection): void {
  sheet.addRow([])

  switch (section.type) {
    case 'performance': {
      const content = section.content as {
        pl: Array<{ code: string; name: string; amount: number; ratio?: number }>
        bs: Array<{ code: string; name: string; amount: number; ratio?: number }>
      }
      sheet.addRow(['■ 損益計算書'])
      sheet.addRow(['コード', '科目名', '金額', '構成比'])
      for (const r of content.pl) {
        sheet.addRow([r.code, r.name, r.amount, r.ratio ?? null])
      }
      sheet.addRow([])
      sheet.addRow(['■ 貸借対照表'])
      sheet.addRow(['コード', '科目名', '残高', '構成比'])
      for (const r of content.bs) {
        sheet.addRow([r.code, r.name, r.amount, r.ratio ?? null])
      }
      break
    }
    case 'advisories': {
      const content = section.content as {
        items: Array<{
          accountCode: string
          accountName: string
          type: string
          direction: string
          changeRatio: number
          currentAmount: number
          comparisonAmount: number
        }>
      }
      sheet.addRow(['科目', '比較', '当月', '比較対象', '変動率'])
      for (const item of content.items) {
        sheet.addRow([
          item.accountName,
          item.type === 'mom' ? '前月比' : '前年同月比',
          item.currentAmount,
          item.comparisonAmount,
          item.changeRatio,
        ])
      }
      break
    }
    default:
      // フォールバック：JSON を1セルに貼る
      sheet.addRow([JSON.stringify(section.content)])
  }

  // 数値セルに書式設定
  sheet.columns.forEach((col) => {
    col.width = 20
  })
}
