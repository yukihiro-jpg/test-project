/**
 * JDL年末調整CSVパーサー + 従業員データ型定義
 *
 * JDL CSVフォーマット:
 * - 先頭4行: ヘッダー（会社C, 会社名, 処理年, データ種別）
 * - 5行目: カラムヘッダー（156カラム）
 * - 6行目〜: データ行
 * - 末尾2行: フッター（データ終了, 出力件数）
 */

// ---------- 型定義 ----------

export interface Dependent {
  name: string
  furigana: string
  birthday: string
  relationship: string
  dependentType: string   // 年少扶養, 一般扶養, 特定扶養 etc.
  disability: string
  nonResident: string
  estimatedIncome: string // JDLの所得見積額
  annualIncome: string    // 従業員が入力する年収（アプリ用）
}

export interface EmployeeData {
  code: string
  lastName: string
  firstName: string
  name: string            // 姓+名 結合済み
  furigana: string
  birthday: string
  gender: string
  postalCode: string
  address: string
  disability: string
  widowSingleParent: string
  employmentStatus: string  // 在職/退職
  hireDate: string
  resignDate: string
  spouseRelationship: string
  spouseName: string
  spouseFurigana: string
  spouseBirthday: string
  spouseDeductionType: string
  spouseDisability: string
  spouseNonResident: string
  dependents: Dependent[]
}

export interface ConfirmedEmployeeInfo {
  employeeCode: string
  employeeName: string
  isNewHire: boolean
  infoChanged: boolean          // 旧: 全体の相違有無（後方互換用）
  personalChanged?: boolean     // 本人情報の相違
  dependentsChanged?: boolean   // 扶養親族・配偶者の相違
  confirmedAt: string
  employee: {
    address: string
    disability: string
    widowSingleParent: string
  }
  dependents: Array<{
    name: string
    furigana: string
    birthday: string
    relationship: string
    dependentType: string
    disability: string
    nonResident: string
    annualIncome: string
  }>
}

// ---------- JDL カラムインデックス ----------

const COL = {
  CODE: 0,
  LAST_NAME: 1,
  FIRST_NAME: 2,
  FURIGANA_LAST: 3,
  FURIGANA_FIRST: 4,
  BIRTHDAY: 7,
  GENDER: 8,
  POSTAL_MAIN: 9,
  POSTAL_SUB: 10,
  ADDRESS1: 11,
  ADDRESS2: 12,
  EMPLOYMENT_STATUS: 27,   // 入退状況区分
  HIRE_DATE: 28,
  RESIGN_DATE: 29,
  DISABILITY: 35,           // 本人の状態障害者区分
  WIDOW_SINGLE_PARENT: 36,  // 本人の状態寡婦／ひとり親区分
  SPOUSE_RELATIONSHIP: 48,
  SPOUSE_NAME: 49,
  SPOUSE_FURIGANA: 50,
  SPOUSE_BIRTHDAY: 51,
  SPOUSE_DEDUCTION_TYPE: 52,
  SPOUSE_DISABILITY: 53,
  SPOUSE_NON_RESIDENT: 54,
  // 扶養者1は列65から、各8カラム
  DEPENDENT_START: 65,
  DEPENDENT_FIELDS: 8,
  DEPENDENT_MAX: 10,
} as const

// ---------- CSVパーサー ----------

/**
 * JDL年末調整CSVをパースして従業員データ配列に変換する。
 * 在職者のみを返す。
 */
export function parseJdlCsv(csvText: string): EmployeeData[] {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')

  // 先頭4行（ヘッダー情報）と5行目（カラムヘッダー）をスキップ
  // 末尾の「＜社員・親族データ終了＞」「＜出力件数＞」行もスキップ
  const dataLines = lines.slice(5).filter((line) => {
    const trimmed = line.trim()
    if (trimmed.length === 0) return false
    if (trimmed.startsWith('"＜社員・親族データ終了＞"')) return false
    if (trimmed.startsWith('"＜出力件数＞"')) return false
    return true
  })

  const employees: EmployeeData[] = []

  for (const line of dataLines) {
    const cols = parseCSVLine(line)
    if (cols.length < 30) continue

    const employmentStatus = clean(cols[COL.EMPLOYMENT_STATUS])

    // 在職者のみ取り込み
    if (!employmentStatus.includes('在職')) continue

    const lastName = clean(cols[COL.LAST_NAME])
    const firstName = clean(cols[COL.FIRST_NAME])
    const name = `${lastName}　${firstName}`.replace(/\s+/g, '　').trim()

    const furiganaLast = clean(cols[COL.FURIGANA_LAST])
    const furiganaFirst = clean(cols[COL.FURIGANA_FIRST])
    const furigana = `${furiganaLast}　${furiganaFirst}`.replace(/\s+/g, '　').trim()

    const postalMain = clean(cols[COL.POSTAL_MAIN])
    const postalSub = clean(cols[COL.POSTAL_SUB])
    const postalCode = postalMain && postalSub ? `${postalMain}-${postalSub}` : ''

    const address1 = clean(cols[COL.ADDRESS1])
    const address2 = clean(cols[COL.ADDRESS2])
    const address = address2 ? `${address1} ${address2}` : address1

    // 配偶者
    const spouseName = clean(cols[COL.SPOUSE_NAME])
    const spouseRelationship = clean(cols[COL.SPOUSE_RELATIONSHIP])

    // 扶養親族をパース
    const dependents: Dependent[] = []

    // 配偶者を扶養親族として含める（氏名がある場合のみ）
    if (spouseName) {
      dependents.push({
        name: spouseName,
        furigana: clean(cols[COL.SPOUSE_FURIGANA]),
        birthday: clean(cols[COL.SPOUSE_BIRTHDAY]),
        relationship: spouseRelationship || '配偶者',
        dependentType: clean(cols[COL.SPOUSE_DEDUCTION_TYPE]),
        disability: clean(cols[COL.SPOUSE_DISABILITY]),
        nonResident: clean(cols[COL.SPOUSE_NON_RESIDENT]),
        estimatedIncome: '',
        annualIncome: '',
      })
    }

    // 扶養者1〜10
    for (let i = 0; i < COL.DEPENDENT_MAX; i++) {
      const base = COL.DEPENDENT_START + i * COL.DEPENDENT_FIELDS
      if (base + 7 >= cols.length) break

      const depName = clean(cols[base + 1])
      if (!depName) continue

      dependents.push({
        name: depName,
        furigana: clean(cols[base + 2]),
        birthday: clean(cols[base + 3]),
        relationship: clean(cols[base]),
        dependentType: clean(cols[base + 4]),
        disability: clean(cols[base + 5]),
        nonResident: clean(cols[base + 6]),
        estimatedIncome: clean(cols[base + 7]?.toString() || ''),
        annualIncome: '',
      })
    }

    employees.push({
      code: clean(cols[COL.CODE]?.toString() || ''),
      lastName,
      firstName,
      name,
      furigana,
      birthday: clean(cols[COL.BIRTHDAY]),
      gender: clean(cols[COL.GENDER]),
      postalCode,
      address,
      disability: clean(cols[COL.DISABILITY]),
      widowSingleParent: clean(cols[COL.WIDOW_SINGLE_PARENT]),
      employmentStatus,
      hireDate: clean(cols[COL.HIRE_DATE]),
      resignDate: clean(cols[COL.RESIGN_DATE]),
      spouseRelationship,
      spouseName,
      spouseFurigana: clean(cols[COL.SPOUSE_FURIGANA]),
      spouseBirthday: clean(cols[COL.SPOUSE_BIRTHDAY]),
      spouseDeductionType: clean(cols[COL.SPOUSE_DEDUCTION_TYPE]),
      spouseDisability: clean(cols[COL.SPOUSE_DISABILITY]),
      spouseNonResident: clean(cols[COL.SPOUSE_NON_RESIDENT]),
      dependents,
    })
  }

  return employees
}

// 後方互換: 旧 parseCsv も parseJdlCsv のエイリアスとして残す
export const parseCsv = parseJdlCsv

/**
 * 全角スペース・半角スペースのみの文字列を空文字に正規化
 */
function clean(value: string | undefined | null): string {
  if (!value) return ''
  const trimmed = value.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '')
  return trimmed
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
