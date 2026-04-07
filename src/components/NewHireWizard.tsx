'use client'

import { useState } from 'react'
import WidowSingleParentWizard from './WidowSingleParentWizard'
import BirthdayPicker from './BirthdayPicker'
import { validateMyNumber, isValidFurigana, normalizeMyNumber } from '@/lib/mynumber-validator'
import {
  classifySpouse,
  classifyDependent,
} from '@/lib/income-classifier'
import { lookupPostalCode } from '@/lib/postal-code-lookup'
import type { NewHireDeclaration } from '@/lib/employee-data'

interface Props {
  initialLastName?: string
  initialFirstName?: string
  fiscalYear: number
  onConfirm: (declaration: NewHireDeclaration) => void
  onCancel: () => void
}

const DISABILITY_OPTIONS = ['非該当', '一般障害者', '特別障害者']
const HOUSEHOLD_HEAD_RELATIONS = [
  '本人',
  '父',
  '母',
  '配偶者',
  '祖父',
  '祖母',
  'その他',
]
const DEPENDENT_RELATIONS = [
  '子',
  '長男',
  '長女',
  '次男',
  '次女',
  '父',
  '母',
  '祖父',
  '祖母',
  '兄',
  '姉',
  '弟',
  '妹',
  'その他',
]

const INCOME_WARNING = `⚠️ 年収は正確に入力してください
間違った金額で申告すると、年末調整の計算が誤った金額となり、
後日、追加の納税や手続きのやり直しが必要になる場合があります。
給与明細の「総支給額」を1年分合計した金額（手取りではなく税金や
社会保険料を引く前の金額）を入力してください。複数勤務先がある
場合はすべての会社の年収を合計してください。`

type Personal = NewHireDeclaration['personal']
type Spouse = NonNullable<NewHireDeclaration['spouse']>
type Dependent = NewHireDeclaration['dependents'][number]

// 生年月日YYYY-MM-DDをBirthdayPicker用のyear/month/dayに分解
function parseBirthdayString(s: string): { year: string; month: string; day: string } {
  if (!s) return { year: '', month: '', day: '' }
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return { year: '', month: '', day: '' }
  return { year: m[1], month: String(parseInt(m[2])), day: String(parseInt(m[3])) }
}

// year/month/dayをYYYY-MM-DD形式に結合
function combineBirthday(year: string, month: string, day: string): string {
  if (!year || !month || !day) return ''
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function blankPersonal(lastName: string, firstName: string): Personal {
  return {
    lastName,
    firstName,
    lastNameKana: '',
    firstNameKana: '',
    birthday: '',
    postalCode: '',
    address: '',
    householdHeadName: '',
    householdHeadRelation: '本人',
    myNumber: '',
    disability: '非該当',
  }
}

function blankSpouse(): Spouse {
  return {
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    birthday: '',
    myNumber: '',
    livesTogether: true,
    annualIncome: '',
    disability: '非該当',
    deductionType: '',
  }
}

function blankDependent(): Dependent {
  return {
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    relationToEmployee: '子',
    birthday: '',
    myNumber: '',
    livesTogether: true,
    annualIncome: '',
    disability: '非該当',
    dependentType: '',
  }
}

export default function NewHireWizard({
  initialLastName = '',
  initialFirstName = '',
  fiscalYear,
  onConfirm,
  onCancel,
}: Props) {
  const [step, setStep] = useState(1)
  const [personal, setPersonal] = useState<Personal>(
    blankPersonal(initialLastName, initialFirstName),
  )
  const [hasSpouse, setHasSpouse] = useState<boolean | null>(null)
  const [spouse, setSpouse] = useState<Spouse>(blankSpouse())
  const [dependents, setDependents] = useState<Dependent[]>([])
  const [widowSingleParent, setWidowSingleParent] = useState<string>('非該当')
  const [isWorkingStudent, setIsWorkingStudent] = useState<boolean>(false)
  const [postalLoading, setPostalLoading] = useState<boolean>(false)

  // Step1: 本人情報のバリデーション
  const personalErrors: string[] = []
  if (step === 1) {
    if (!personal.lastName.trim()) personalErrors.push('姓を入力してください')
    if (!personal.firstName.trim()) personalErrors.push('名を入力してください')
    if (!isValidFurigana(personal.lastNameKana))
      personalErrors.push('姓のフリガナは全角カタカナで入力してください')
    if (!isValidFurigana(personal.firstNameKana))
      personalErrors.push('名のフリガナは全角カタカナで入力してください')
    if (!personal.birthday) personalErrors.push('生年月日を入力してください')
    if (!personal.address.trim()) personalErrors.push('住所を入力してください')
    if (!personal.householdHeadName.trim())
      personalErrors.push('世帯主の氏名を入力してください')
    if (personal.myNumber && !validateMyNumber(personal.myNumber))
      personalErrors.push('マイナンバーが正しくありません（12桁・チェックデジット不一致）')
    if (!personal.myNumber)
      personalErrors.push('マイナンバーを入力してください')
  }

  // Step2: 配偶者バリデーション
  const spouseErrors: string[] = []
  if (step === 2 && hasSpouse) {
    if (!spouse.lastName.trim()) spouseErrors.push('配偶者の姓を入力してください')
    if (!spouse.firstName.trim()) spouseErrors.push('配偶者の名を入力してください')
    if (!isValidFurigana(spouse.lastNameKana))
      spouseErrors.push('配偶者の姓フリガナは全角カタカナで入力してください')
    if (!isValidFurigana(spouse.firstNameKana))
      spouseErrors.push('配偶者の名フリガナは全角カタカナで入力してください')
    if (!spouse.birthday) spouseErrors.push('配偶者の生年月日を入力してください')
    if (!spouse.myNumber || !validateMyNumber(spouse.myNumber))
      spouseErrors.push('配偶者のマイナンバーが正しくありません')
    if (!spouse.annualIncome.trim())
      spouseErrors.push('配偶者の年収を入力してください')
  }

  // Step3: 扶養家族バリデーション
  const depErrors: string[] = []
  if (step === 3) {
    dependents.forEach((d, i) => {
      if (!d.lastName.trim() || !d.firstName.trim())
        depErrors.push(`扶養家族${i + 1}: 氏名を入力してください`)
      if (!isValidFurigana(d.lastNameKana) || !isValidFurigana(d.firstNameKana))
        depErrors.push(`扶養家族${i + 1}: フリガナを全角カタカナで入力してください`)
      if (!d.birthday)
        depErrors.push(`扶養家族${i + 1}: 生年月日を入力してください`)
      if (!d.myNumber || !validateMyNumber(d.myNumber))
        depErrors.push(`扶養家族${i + 1}: マイナンバーが正しくありません`)
      if (!d.annualIncome.trim())
        depErrors.push(`扶養家族${i + 1}: 年収を入力してください`)
    })
  }

  // ステップ進行
  const goNext = () => {
    if (step === 1 && personalErrors.length > 0) return
    if (step === 2 && hasSpouse === null) return
    if (step === 2 && hasSpouse && spouseErrors.length > 0) return
    if (step === 3 && depErrors.length > 0) return
    setStep((s) => Math.min(s + 1, 5))
  }
  const goBack = () => setStep((s) => Math.max(s - 1, 1))

  // 配偶者の控除区分を都度自動判定
  const updateSpouseIncome = (value: string) => {
    const num = parseInt(value.replace(/[^\d]/g, '')) || 0
    setSpouse((prev) => ({
      ...prev,
      annualIncome: value,
      deductionType: classifySpouse(num),
    }))
  }

  // 扶養家族の控除区分を都度自動判定
  const updateDependent = (
    index: number,
    field: keyof Dependent,
    value: string | boolean,
  ) => {
    setDependents((prev) => {
      const next = [...prev]
      const updated = { ...next[index], [field]: value }

      // 年収・生年月日・同居が変わったら控除区分を再計算
      if (field === 'annualIncome' || field === 'birthday' || field === 'livesTogether') {
        const inc = parseInt(String(updated.annualIncome).replace(/[^\d]/g, '')) || 0
        if (updated.birthday) {
          updated.dependentType = classifyDependent(
            updated.birthday,
            inc,
            updated.livesTogether,
            fiscalYear,
          )
        }
      }
      next[index] = updated
      return next
    })
  }

  const addDependent = () => {
    setDependents((prev) => [...prev, blankDependent()])
  }

  const removeDependent = (index: number) => {
    setDependents((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFinalConfirm = () => {
    const result: NewHireDeclaration = {
      personal,
      hasSpouse: hasSpouse === true,
      spouse: hasSpouse === true ? spouse : undefined,
      dependents,
      widowSingleParent,
      isWorkingStudent,
      previousJobWithholdingSlip: 'will_capture',
    }
    onConfirm(result)
  }

  return (
    <div className="space-y-4">
      {/* 進捗バー */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-700">
            扶養控除等申告書の入力
          </span>
          <span className="text-sm text-gray-500">ステップ {step}/5</span>
        </div>
        <div className="h-2 bg-gray-200 rounded">
          <div
            className="h-2 bg-blue-600 rounded transition-all"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {step === 1 && '① 本人情報を入力してください'}
          {step === 2 && '② 配偶者の有無と詳細'}
          {step === 3 && '③ 扶養家族の入力'}
          {step === 4 && '④ 寡婦/ひとり親・勤労学生の判定'}
          {step === 5 && '⑤ 入力内容の最終確認'}
        </p>
      </div>

      {/* ===== ステップ1: 本人情報 ===== */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-base font-bold text-gray-800">本人情報</h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">姓（漢字）</label>
              <input
                type="text"
                value={personal.lastName}
                onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-base"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">名（漢字）</label>
              <input
                type="text"
                value={personal.firstName}
                onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                姓（フリガナ・全角カナ）
              </label>
              <input
                type="text"
                value={personal.lastNameKana}
                onChange={(e) => setPersonal({ ...personal, lastNameKana: e.target.value })}
                placeholder="ヤマダ"
                className="w-full px-3 py-2 border border-gray-300 rounded text-base"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                名（フリガナ・全角カナ）
              </label>
              <input
                type="text"
                value={personal.firstNameKana}
                onChange={(e) => setPersonal({ ...personal, firstNameKana: e.target.value })}
                placeholder="タロウ"
                className="w-full px-3 py-2 border border-gray-300 rounded text-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">生年月日</label>
            {(() => {
              const { year, month, day } = parseBirthdayString(personal.birthday)
              return (
                <BirthdayPicker
                  year={year}
                  month={month}
                  day={day}
                  onChange={(y, m, d) =>
                    setPersonal({ ...personal, birthday: combineBirthday(y, m, d) })
                  }
                />
              )
            })()}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              郵便番号（7桁入力で住所自動入力）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={personal.postalCode}
                onChange={async (e) => {
                  const val = e.target.value
                  setPersonal((prev) => ({ ...prev, postalCode: val }))
                  // 7桁入力されたら住所を自動取得
                  const digits = val.replace(/[^\d]/g, '')
                  if (digits.length === 7) {
                    setPostalLoading(true)
                    try {
                      const result = await lookupPostalCode(digits)
                      if (result) {
                        // 住所欄がまだ空、または自動入力由来の場合のみ上書き
                        setPersonal((prev) => ({
                          ...prev,
                          address: result.fullAddress,
                        }))
                      }
                    } finally {
                      setPostalLoading(false)
                    }
                  }
                }}
                placeholder="例: 100-0001 または 1000001"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-base"
              />
              {postalLoading && (
                <span className="text-xs text-gray-500">検索中...</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              ※ 郵便番号を7桁入力すると、住所が自動で入ります。番地以下は手入力してください。
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">住所</label>
            <input
              type="text"
              value={personal.address}
              onChange={(e) => setPersonal({ ...personal, address: e.target.value })}
              placeholder="例: 茨城県小美玉市..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-base"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">世帯主の氏名</label>
            <input
              type="text"
              value={personal.householdHeadName}
              onChange={(e) =>
                setPersonal({ ...personal, householdHeadName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded text-base"
            />
            <p className="text-xs text-gray-400 mt-1">
              ※ 住民票の世帯の代表者です。一人暮らしの場合はあなた自身の氏名
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              あなたから見て世帯主は？
            </label>
            <select
              value={personal.householdHeadRelation}
              onChange={(e) =>
                setPersonal({ ...personal, householdHeadRelation: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded text-base bg-white"
            >
              {HOUSEHOLD_HEAD_RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              マイナンバー（12桁）
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={personal.myNumber}
              onChange={(e) =>
                setPersonal({
                  ...personal,
                  myNumber: normalizeMyNumber(e.target.value),
                })
              }
              maxLength={12}
              placeholder="123456789012"
              className="w-full px-3 py-2 border border-gray-300 rounded text-base font-mono"
            />
            {personal.myNumber.length === 12 && !validateMyNumber(personal.myNumber) && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ マイナンバーが正しくありません（チェックデジット不一致）
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">障害者区分</label>
            <select
              value={personal.disability}
              onChange={(e) => setPersonal({ ...personal, disability: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-base bg-white"
            >
              {DISABILITY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {personalErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <ul className="list-disc list-inside space-y-1">
                {personalErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ===== ステップ2: 配偶者 ===== */}
      {step === 2 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-base font-bold text-gray-800">配偶者の有無</h3>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setHasSpouse(true)}
              className={`flex-1 py-3 rounded-lg font-bold text-sm ${
                hasSpouse === true
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              配偶者あり
            </button>
            <button
              type="button"
              onClick={() => setHasSpouse(false)}
              className={`flex-1 py-3 rounded-lg font-bold text-sm ${
                hasSpouse === false
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              配偶者なし
            </button>
          </div>

          {hasSpouse === true && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">姓（漢字）</label>
                  <input
                    type="text"
                    value={spouse.lastName}
                    onChange={(e) => setSpouse({ ...spouse, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">名（漢字）</label>
                  <input
                    type="text"
                    value={spouse.firstName}
                    onChange={(e) => setSpouse({ ...spouse, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-base"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    姓（フリガナ）
                  </label>
                  <input
                    type="text"
                    value={spouse.lastNameKana}
                    onChange={(e) => setSpouse({ ...spouse, lastNameKana: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    名（フリガナ）
                  </label>
                  <input
                    type="text"
                    value={spouse.firstNameKana}
                    onChange={(e) => setSpouse({ ...spouse, firstNameKana: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-base"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">生年月日</label>
                {(() => {
                  const { year, month, day } = parseBirthdayString(spouse.birthday)
                  return (
                    <BirthdayPicker
                      year={year}
                      month={month}
                      day={day}
                      onChange={(y, m, d) =>
                        setSpouse({ ...spouse, birthday: combineBirthday(y, m, d) })
                      }
                    />
                  )
                })()}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  マイナンバー（12桁）
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={spouse.myNumber}
                  onChange={(e) =>
                    setSpouse({ ...spouse, myNumber: normalizeMyNumber(e.target.value) })
                  }
                  maxLength={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-base font-mono"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={spouse.livesTogether}
                    onChange={(e) =>
                      setSpouse({ ...spouse, livesTogether: e.target.checked })
                    }
                  />
                  あなたと同居している
                </label>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  配偶者の本年の年収（見込み・円）
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={spouse.annualIncome}
                  onChange={(e) => updateSpouseIncome(e.target.value)}
                  placeholder="例: 1230000"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-base"
                />
                <p className="text-xs text-red-600 mt-1 whitespace-pre-line">
                  {INCOME_WARNING}
                </p>
                {spouse.deductionType && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-900 font-bold">
                    自動判定: {spouse.deductionType}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  配偶者の障害者区分
                </label>
                <select
                  value={spouse.disability}
                  onChange={(e) => setSpouse({ ...spouse, disability: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-base bg-white"
                >
                  {DISABILITY_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              {spouseErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  <ul className="list-disc list-inside space-y-1">
                    {spouseErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== ステップ3: 扶養家族 ===== */}
      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-base font-bold text-gray-800">扶養家族</h3>
          <p className="text-xs text-gray-500">
            生計を一にしている家族（子・親など）を入力してください。配偶者は前のステップで入力済みです。
          </p>

          {dependents.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              まだ追加されていません
            </p>
          )}

          {dependents.map((dep, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">
                  扶養家族 {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeDependent(i)}
                  className="text-xs text-red-500 underline"
                >
                  削除
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">姓</label>
                  <input
                    type="text"
                    value={dep.lastName}
                    onChange={(e) => updateDependent(i, 'lastName', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">名</label>
                  <input
                    type="text"
                    value={dep.firstName}
                    onChange={(e) => updateDependent(i, 'firstName', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">姓フリガナ</label>
                  <input
                    type="text"
                    value={dep.lastNameKana}
                    onChange={(e) => updateDependent(i, 'lastNameKana', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">名フリガナ</label>
                  <input
                    type="text"
                    value={dep.firstNameKana}
                    onChange={(e) => updateDependent(i, 'firstNameKana', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  あなたから見てその人は？
                </label>
                <select
                  value={dep.relationToEmployee}
                  onChange={(e) =>
                    updateDependent(i, 'relationToEmployee', e.target.value)
                  }
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  {DEPENDENT_RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">生年月日</label>
                {(() => {
                  const { year, month, day } = parseBirthdayString(dep.birthday)
                  return (
                    <BirthdayPicker
                      year={year}
                      month={month}
                      day={day}
                      onChange={(y, m, d) =>
                        updateDependent(i, 'birthday', combineBirthday(y, m, d))
                      }
                    />
                  )
                })()}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  マイナンバー（12桁）
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={dep.myNumber}
                  onChange={(e) =>
                    updateDependent(i, 'myNumber', normalizeMyNumber(e.target.value))
                  }
                  maxLength={12}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={dep.livesTogether}
                    onChange={(e) =>
                      updateDependent(i, 'livesTogether', e.target.checked)
                    }
                  />
                  あなたと同居している
                </label>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  この人の本年の年収（見込み・円）
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={dep.annualIncome}
                  onChange={(e) => updateDependent(i, 'annualIncome', e.target.value)}
                  placeholder="例: 0"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ 年収を間違えると年末調整計算が誤ります。総支給額（手取りでない）を1年分。
                </p>
                {dep.dependentType && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-900 font-bold">
                    自動判定: {dep.dependentType}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">障害者区分</label>
                <select
                  value={dep.disability}
                  onChange={(e) => updateDependent(i, 'disability', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  {[...DISABILITY_OPTIONS, '同居特別障害者'].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addDependent}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 active:border-blue-400"
          >
            + 扶養家族を追加
          </button>

          {depErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <ul className="list-disc list-inside space-y-1">
                {depErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ===== ステップ4: 寡婦/ひとり親/勤労学生 ===== */}
      {step === 4 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="text-base font-bold text-gray-800">寡婦・ひとり親・勤労学生</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              寡婦/ひとり親控除の判定
            </label>
            <WidowSingleParentWizard
              gender={
                personal.householdHeadRelation === '配偶者' ? '女' : '男'
              }
              initialResult={
                widowSingleParent === '寡婦' || widowSingleParent === 'ひとり親'
                  ? widowSingleParent
                  : '非該当'
              }
              onChange={(result) => setWidowSingleParent(result)}
            />
          </div>

          <div className="pt-3 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              勤労学生に該当しますか？
            </label>
            <p className="text-xs text-gray-500 mb-2">
              勤労学生とは、学校に通いながら働いている人で、本年の合計所得が
              85万円以下（給与年収150万円以下）の人です。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsWorkingStudent(false)}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm ${
                  !isWorkingStudent
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                該当しない
              </button>
              <button
                type="button"
                onClick={() => setIsWorkingStudent(true)}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm ${
                  isWorkingStudent
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                該当する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ステップ5: 確認 ===== */}
      {step === 5 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="text-base font-bold text-gray-800">入力内容の確認</h3>

          <section>
            <h4 className="text-sm font-bold text-gray-700 mb-2 pb-1 border-b">
              本人情報
            </h4>
            <dl className="text-sm space-y-1">
              <div className="flex">
                <dt className="text-gray-500 w-28">氏名</dt>
                <dd>
                  {personal.lastName} {personal.firstName}（
                  {personal.lastNameKana} {personal.firstNameKana}）
                </dd>
              </div>
              <div className="flex">
                <dt className="text-gray-500 w-28">生年月日</dt>
                <dd>{personal.birthday}</dd>
              </div>
              <div className="flex">
                <dt className="text-gray-500 w-28">住所</dt>
                <dd>{personal.address}</dd>
              </div>
              <div className="flex">
                <dt className="text-gray-500 w-28">世帯主</dt>
                <dd>
                  {personal.householdHeadName}（{personal.householdHeadRelation}）
                </dd>
              </div>
              <div className="flex">
                <dt className="text-gray-500 w-28">マイナンバー</dt>
                <dd className="font-mono">{personal.myNumber}</dd>
              </div>
              <div className="flex">
                <dt className="text-gray-500 w-28">障害者区分</dt>
                <dd>{personal.disability}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h4 className="text-sm font-bold text-gray-700 mb-2 pb-1 border-b">
              配偶者
            </h4>
            {hasSpouse ? (
              <dl className="text-sm space-y-1">
                <div className="flex">
                  <dt className="text-gray-500 w-28">氏名</dt>
                  <dd>
                    {spouse.lastName} {spouse.firstName}
                  </dd>
                </div>
                <div className="flex">
                  <dt className="text-gray-500 w-28">生年月日</dt>
                  <dd>{spouse.birthday}</dd>
                </div>
                <div className="flex">
                  <dt className="text-gray-500 w-28">年収</dt>
                  <dd>{spouse.annualIncome}円</dd>
                </div>
                <div className="flex">
                  <dt className="text-gray-500 w-28">控除区分</dt>
                  <dd className="font-bold text-blue-700">{spouse.deductionType}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-500">配偶者なし</p>
            )}
          </section>

          <section>
            <h4 className="text-sm font-bold text-gray-700 mb-2 pb-1 border-b">
              扶養家族（{dependents.length}人）
            </h4>
            {dependents.length === 0 ? (
              <p className="text-sm text-gray-500">扶養家族なし</p>
            ) : (
              <div className="space-y-2">
                {dependents.map((d, i) => (
                  <div key={i} className="text-sm bg-gray-50 rounded p-2">
                    <p className="font-bold">
                      {d.lastName} {d.firstName}（{d.relationToEmployee}）
                    </p>
                    <p className="text-xs text-gray-600">
                      {d.birthday} / 年収 {d.annualIncome}円 /{' '}
                      {d.livesTogether ? '同居' : '別居'}
                    </p>
                    <p className="text-xs text-blue-700 font-bold">
                      → {d.dependentType}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="text-sm font-bold text-gray-700 mb-2 pb-1 border-b">
              寡婦/ひとり親・勤労学生
            </h4>
            <dl className="text-sm space-y-1">
              <div className="flex">
                <dt className="text-gray-500 w-28">寡婦/ひとり親</dt>
                <dd>{widowSingleParent}</dd>
              </div>
              <div className="flex">
                <dt className="text-gray-500 w-28">勤労学生</dt>
                <dd>{isWorkingStudent ? '該当' : '非該当'}</dd>
              </div>
            </dl>
          </section>

          <button
            type="button"
            onClick={handleFinalConfirm}
            className="w-full py-3 bg-green-600 text-white text-base font-bold rounded-lg active:bg-green-700"
          >
            この内容で確定して書類撮影へ進む
          </button>
        </div>
      )}

      {/* ナビゲーション */}
      <div className="flex gap-2">
        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm"
          >
            ← 戻る
          </button>
        )}
        {step === 1 && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm"
          >
            キャンセル
          </button>
        )}
        {step < 5 && (
          <button
            type="button"
            onClick={goNext}
            disabled={
              (step === 1 && personalErrors.length > 0) ||
              (step === 2 && hasSpouse === null) ||
              (step === 2 && hasSpouse === true && spouseErrors.length > 0) ||
              (step === 3 && depErrors.length > 0)
            }
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:bg-gray-300"
          >
            次へ →
          </button>
        )}
      </div>
    </div>
  )
}
