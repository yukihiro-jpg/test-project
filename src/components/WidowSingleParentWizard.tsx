'use client'

import { useState } from 'react'

/**
 * 寡婦/ひとり親控除の自動判定ウィザード
 *
 * 国税庁の判定ルールに基づき、質問に答えていくと
 * 自動的に「該当しない / ひとり親 / 寡婦」を判定します。
 *
 * 判定ルール（簡略版）:
 * - 本人合計所得 500万円超 → 該当しない
 * - 婚姻中（配偶者あり）→ 該当しない
 * - 生計を一にする子（年収103万円以下）あり + 未婚/離別/死別 → ひとり親（性別問わず）
 * - 女性 + 死別 → 寡婦
 * - 女性 + 離別 + 子以外の扶養親族あり → 寡婦
 * - それ以外 → 該当しない
 */

export type WidowSingleParentResult = '非該当' | '寡婦' | 'ひとり親'

interface Props {
  gender: string // "男" or "女"
  initialResult?: WidowSingleParentResult
  onChange: (result: WidowSingleParentResult) => void
}

type MaritalStatus = '' | '婚姻中' | '死別' | '離別' | '未婚'
type YesNo = '' | 'はい' | 'いいえ'

export default function WidowSingleParentWizard({
  gender,
  initialResult,
  onChange,
}: Props) {
  const [marital, setMarital] = useState<MaritalStatus>('')
  const [hasChild, setHasChild] = useState<YesNo>('')
  const [hasOtherDependent, setHasOtherDependent] = useState<YesNo>('')
  const [incomeOver500, setIncomeOver500] = useState<YesNo>('')

  // 判定ロジック
  const determineResult = (): WidowSingleParentResult | null => {
    if (!marital) return null

    // 婚姻中は該当しない
    if (marital === '婚姻中') return '非該当'

    if (incomeOver500 === '') return null
    if (incomeOver500 === 'はい') return '非該当' // 合計所得500万超
    if (hasChild === '') return null

    // 生計を一にする子あり → ひとり親
    if (hasChild === 'はい') return 'ひとり親'

    // 子なし → 性別と婚姻状況で判定
    const isFemale = gender.includes('女')
    if (!isFemale) return '非該当'

    if (marital === '死別') return '寡婦'

    if (marital === '離別') {
      if (hasOtherDependent === '') return null
      if (hasOtherDependent === 'はい') return '寡婦'
      return '非該当'
    }

    // 未婚で子なし
    return '非該当'
  }

  const result = determineResult()

  // 結果が確定したら親に通知
  if (result && result !== initialResult) {
    setTimeout(() => onChange(result), 0)
  }

  return (
    <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p className="text-xs text-blue-900 font-bold">
        以下の質問に答えると自動判定されます
      </p>

      {/* Q1: 配偶者の有無 */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1">
          Q1. あなたの婚姻状況は？
        </label>
        <select
          value={marital}
          onChange={(e) => {
            setMarital(e.target.value as MaritalStatus)
            setHasChild('')
            setHasOtherDependent('')
            setIncomeOver500('')
          }}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white"
        >
          <option value="">-- 選択 --</option>
          <option value="婚姻中">婚姻中（配偶者あり）</option>
          <option value="死別">死別</option>
          <option value="離別">離別（離婚）</option>
          <option value="未婚">未婚</option>
        </select>
      </div>

      {/* Q2: 合計所得（婚姻中以外） */}
      {marital && marital !== '婚姻中' && (
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">
            Q2. あなたの本年の合計所得金額は500万円を超えますか？
          </label>
          <select
            value={incomeOver500}
            onChange={(e) => {
              setIncomeOver500(e.target.value as YesNo)
              setHasChild('')
              setHasOtherDependent('')
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="">-- 選択 --</option>
            <option value="いいえ">いいえ（500万円以下）</option>
            <option value="はい">はい（500万円超）</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            目安: 給与年収だけなら約688万円以下
          </p>
        </div>
      )}

      {/* Q3: 生計を一にする子 */}
      {marital && marital !== '婚姻中' && incomeOver500 === 'いいえ' && (
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">
            Q3. 生計を一にする子（年収103万円以下）はいますか？
          </label>
          <select
            value={hasChild}
            onChange={(e) => {
              setHasChild(e.target.value as YesNo)
              setHasOtherDependent('')
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="">-- 選択 --</option>
            <option value="はい">はい</option>
            <option value="いいえ">いいえ</option>
          </select>
        </div>
      )}

      {/* Q4: 子以外の扶養親族（女性・離別の場合のみ） */}
      {marital === '離別' &&
        incomeOver500 === 'いいえ' &&
        hasChild === 'いいえ' &&
        gender.includes('女') && (
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Q4. 子以外の扶養親族はいますか？
            </label>
            <select
              value={hasOtherDependent}
              onChange={(e) => setHasOtherDependent(e.target.value as YesNo)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white"
            >
              <option value="">-- 選択 --</option>
              <option value="はい">はい</option>
              <option value="いいえ">いいえ</option>
            </select>
          </div>
        )}

      {/* 判定結果 */}
      {result && (
        <div
          className={`rounded-md p-3 text-center font-bold ${
            result === '非該当'
              ? 'bg-gray-100 text-gray-700'
              : 'bg-green-100 text-green-800'
          }`}
        >
          判定結果: {result}
        </div>
      )}
    </div>
  )
}
