import * as XLSX from 'xlsx'
import type { RawTableRow } from './types'

interface ExcelPageResult {
  rows: RawTableRow[]
  sheetName: string
  htmlTable: string // HTML表示用
}

export function parseExcel(file: File): Promise<ExcelPageResult[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const results: ExcelPageResult[] = []

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          if (!sheet) continue

          // JSON形式で全行取得（ヘッダーなし）
          const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: '',
          })

          const rows: RawTableRow[] = []
          for (let i = 0; i < jsonData.length; i++) {
            const rowData = jsonData[i]
            if (!rowData || rowData.every((cell: string) => !String(cell).trim())) continue

            rows.push({
              cells: rowData.map((cell: string) => String(cell).trim()),
              rowIndex: i,
            })
          }

          // HTML表示用テーブル生成
          const htmlTable = XLSX.utils.sheet_to_html(sheet, {
            editable: false,
          })

          results.push({
            rows,
            sheetName,
            htmlTable,
          })
        }

        resolve(results)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsArrayBuffer(file)
  })
}
