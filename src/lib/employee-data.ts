/**
 * JDL年末調整CSVから読み込む従業員データの型定義
 *
 * CSVの具体的なカラムマッピングは後日JDLのフォーマット確認後に調整する。
 * 現在は一般的なJDL年末調整データの形式を想定。
 */

export interface Dependent {
  name: string
  birthday: string
  address: string
  relationship: string
  disability: string
}

export interface EmployeeData {
  code: string
  name: string
  birthday: string
  address: string
  disability: string
  widowSingleParent: string
  dependents: Dependent[]
}

/**
 * CSVテキストをパースして従業員データ配列に変換する。
 *
 * 現在の想定カラム順（JDLフォーマット確認後に調整）:
 *   0: 従業員コード
 *   1: 氏名
 *   2: 生年月日
 *   3: 住所
 *   4: 障碍者区分
 *   5: 寡婦ひとり親区分
 *   6〜: 扶養親族1氏名, 扶養親族1生年月日, 扶養親族1住所, 扶養親族1続柄, 扶養親族1障碍者区分,
 *        扶養親族2氏名, ... (5列ごとに繰り返し)
 *
 * ヘッダー行ありを想定（1行目はスキップ）。
 */
export function parseCsv(csvText: string): EmployeeData[] {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)

  if (lines.length < 2) return []

  // ヘッダー行をスキップ
  const dataLines = lines.slice(1)
  const employees: EmployeeData[] = []

  for (const line of dataLines) {
    const cols = parseCSVLine(line)
    if (cols.length < 3) continue

    const code = cols[0]?.trim() || ''
    const name = cols[1]?.trim() || ''
    const birthday = cols[2]?.trim() || ''
    const address = cols[3]?.trim() || ''
    const disability = cols[4]?.trim() || ''
    const widowSingleParent = cols[5]?.trim() || ''

    if (!code || !name) continue

    // 扶養親族をパース（6列目以降、5列ごと）
    const dependents: Dependent[] = []
    const depStartIdx = 6
    const depFieldCount = 5

    for (let i = depStartIdx; i + depFieldCount - 1 < cols.length; i += depFieldCount) {
      const depName = cols[i]?.trim() || ''
      if (!depName) continue

      dependents.push({
        name: depName,
        birthday: cols[i + 1]?.trim() || '',
        address: cols[i + 2]?.trim() || '',
        relationship: cols[i + 3]?.trim() || '',
        disability: cols[i + 4]?.trim() || '',
      })
    }

    employees.push({
      code,
      name,
      birthday,
      address,
      disability,
      widowSingleParent,
      dependents,
    })
  }

  return employees
}

/**
 * CSV行をパース（ダブルクォート囲み・カンマ含み対応）
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current)

  return result
}
