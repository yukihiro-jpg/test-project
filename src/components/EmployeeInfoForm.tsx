'use client'

import { useState } from 'react'

interface DependentInfo {
  name: string
  furigana: string
  birthday: string
  relationship: string
  dependentType: string
  disability: string
  nonResident: string
  annualIncome: string
}

interface EmployeeInfo {
  code: string
  name: string
  furigana: string
  birthday: string
  gender: string
  postalCode: string
  address: string
  disability: string
  widowSingleParent: string
  dependents: DependentInfo[]
}

interface ConfirmedResult {
  employeeCode: string
  employeeName: string
  isNewHire: boolean
  infoChanged: boolean
  confirmedAt: string
  employee: {
    address: string
    disability: string
    widowSingleParent: string
  }
  dependents: Array<DependentInfo>
}

interface Props {
  employee: EmployeeInfo
  onConfirm: (result: ConfirmedResult) => void
}

export default function EmployeeInfoForm({ employee, onConfirm }: Props) {
  const [editing, setEditing] = useState(false)
  const [address, setAddress] = useState(employee.address)
  const [disability, setDisability] = useState(employee.disability)
  const [widowSingleParent, setWidowSingleParent] = useState(employee.widowSingleParent)
  const [dependents, setDependents] = useState<DependentInfo[]>(
    employee.dependents.map((d) => ({ ...d }))
  )

  const hasIncomeWarning = dependents.length > 0 && dependents.some((d) => !d.annualIncome.trim())

  const handleNoChange = () => {
    onConfirm({
      employeeCode: employee.code,
      employeeName: employee.name,
      isNewHire: false,
      infoChanged: false,
      confirmedAt: new Date().toISOString(),
      employee: {
        address: employee.address,
        disability: employee.disability,
        widowSingleParent: employee.widowSingleParent,
      },
      dependents: dependents.map((d) => ({ ...d })),
    })
  }

  const handleConfirmEdits = () => {
    onConfirm({
      employeeCode: employee.code,
      employeeName: employee.name,
      isNewHire: false,
      infoChanged: true,
      confirmedAt: new Date().toISOString(),
      employee: { address, disability, widowSingleParent },
      dependents: dependents.map((d) => ({ ...d })),
    })
  }

  const updateDependent = (index: number, field: keyof DependentInfo, value: string) => {
    setDependents((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const addDependent = () => {
    setDependents((prev) => [
      ...prev,
      { name: '', furigana: '', birthday: '', relationship: '', dependentType: '', disability: '', nonResident: '', annualIncome: '' },
    ])
  }

  const removeDependent = (index: number) => {
    setDependents((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {/* 本人情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">本人情報（前年データ）</h3>

        <dl className="space-y-2 text-sm">
          <div className="flex">
            <dt className="text-gray-500 w-28 shrink-0">氏名</dt>
            <dd className="text-gray-800 font-medium">{employee.name}</dd>
          </div>
          <div className="flex">
            <dt className="text-gray-500 w-28 shrink-0">生年月日</dt>
            <dd className="text-gray-800">{employee.birthday}</dd>
          </div>
          <div className="flex items-start">
            <dt className="text-gray-500 w-28 shrink-0">住所</dt>
            <dd className="text-gray-800 flex-1">
              {editing ? (
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                />
              ) : (
                employee.address || '—'
              )}
            </dd>
          </div>
          <div className="flex items-start">
            <dt className="text-gray-500 w-28 shrink-0">障碍者区分</dt>
            <dd className="text-gray-800 flex-1">
              {editing ? (
                <input
                  type="text"
                  value={disability}
                  onChange={(e) => setDisability(e.target.value)}
                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                />
              ) : (
                employee.disability || '非該当'
              )}
            </dd>
          </div>
          <div className="flex items-start">
            <dt className="text-gray-500 w-28 shrink-0">寡婦/ひとり親</dt>
            <dd className="text-gray-800 flex-1">
              {editing ? (
                <input
                  type="text"
                  value={widowSingleParent}
                  onChange={(e) => setWidowSingleParent(e.target.value)}
                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                />
              ) : (
                employee.widowSingleParent || '非該当'
              )}
            </dd>
          </div>
        </dl>

        {/* 相違ボタン */}
        {!editing && (
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={handleNoChange}
              className="flex-1 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg active:bg-green-700"
            >
              前年と相違ありません
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-lg active:bg-orange-600"
            >
              相違があります（訂正する）
            </button>
          </div>
        )}
      </div>

      {/* 扶養親族 */}
      {dependents.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-base font-bold text-gray-800 mb-3">
            扶養親族・配偶者
          </h3>

          {/* 年収入力の注意 */}
          {hasIncomeWarning && (
            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              <p className="font-bold">年収が未入力の扶養親族がいます</p>
              <p>未入力の場合、正しい年末調整計算ができない可能性があります。給与が0円の場合は0と入力してください。</p>
            </div>
          )}

          <div className="space-y-3">
            {dependents.map((dep, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm relative">
                {editing && (
                  <button
                    type="button"
                    onClick={() => removeDependent(i)}
                    className="absolute top-2 right-2 text-xs text-red-500 underline"
                  >
                    削除
                  </button>
                )}

                {editing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">氏名</label>
                        <input type="text" value={dep.name} onChange={(e) => updateDependent(i, 'name', e.target.value)}
                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">続柄</label>
                        <input type="text" value={dep.relationship} onChange={(e) => updateDependent(i, 'relationship', e.target.value)}
                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">生年月日</label>
                        <input type="text" value={dep.birthday} onChange={(e) => updateDependent(i, 'birthday', e.target.value)}
                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">障碍者区分</label>
                        <input type="text" value={dep.disability} onChange={(e) => updateDependent(i, 'disability', e.target.value)}
                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">住所</label>
                      <input type="text" value={dep.furigana} onChange={(e) => updateDependent(i, 'furigana', e.target.value)}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm" />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-gray-800">
                      {dep.name}
                      {dep.relationship && (
                        <span className="text-gray-500 ml-1">（{dep.relationship}）</span>
                      )}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {dep.birthday && dep.birthday}
                      {dep.dependentType && ` / ${dep.dependentType}`}
                      {dep.disability && dep.disability !== '非該当' && ` / 障碍者: ${dep.disability}`}
                    </p>
                  </>
                )}

                {/* 年収入力（常時表示） */}
                <div className="mt-2">
                  <label className="text-xs text-gray-500">
                    年収（円）
                    {!dep.annualIncome.trim() && (
                      <span className="text-yellow-600 ml-1">※未入力</span>
                    )}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dep.annualIncome}
                    onChange={(e) => updateDependent(i, 'annualIncome', e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>

          {editing && (
            <button
              type="button"
              onClick={addDependent}
              className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 active:border-blue-400"
            >
              + 扶養親族を追加
            </button>
          )}
        </div>
      )}

      {/* 編集モードの確定ボタン */}
      {editing && (
        <button
          type="button"
          onClick={handleConfirmEdits}
          className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg active:bg-blue-700"
        >
          訂正内容を確定する
        </button>
      )}
    </div>
  )
}
