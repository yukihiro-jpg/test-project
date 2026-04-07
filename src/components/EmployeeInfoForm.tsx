'use client'

import { useState } from 'react'
import ConfirmModal from './ConfirmModal'

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
  // 本人情報
  const [personalEditing, setPersonalEditing] = useState(false)
  const [personalConfirmed, setPersonalConfirmed] = useState(false)
  const [personalChanged, setPersonalChanged] = useState(false)
  const [address, setAddress] = useState(employee.address)
  const [disability, setDisability] = useState(employee.disability)
  const [widowSingleParent, setWidowSingleParent] = useState(employee.widowSingleParent)

  // 扶養親族
  const [depEditing, setDepEditing] = useState(false)
  const [depConfirmed, setDepConfirmed] = useState(false)
  const [depChanged, setDepChanged] = useState(false)
  const [dependents, setDependents] = useState<DependentInfo[]>(
    employee.dependents.map((d) => ({ ...d }))
  )

  // 年収未入力警告モーダル
  const [incomeWarningPending, setIncomeWarningPending] = useState<'noChange' | 'edit' | null>(null)

  const noDeps = employee.dependents.length === 0

  // 両方確認済みなら親に通知
  const finalize = (pChanged: boolean, dChanged: boolean) => {
    onConfirm({
      employeeCode: employee.code,
      employeeName: employee.name,
      isNewHire: false,
      infoChanged: pChanged || dChanged,
      confirmedAt: new Date().toISOString(),
      employee: pChanged
        ? { address, disability, widowSingleParent }
        : {
            address: employee.address,
            disability: employee.disability,
            widowSingleParent: employee.widowSingleParent,
          },
      dependents: dependents.map((d) => ({ ...d })),
    })
  }

  // 本人情報「相違なし」
  const handlePersonalNoChange = () => {
    setPersonalChanged(false)
    setPersonalConfirmed(true)
    setPersonalEditing(false)
    if (noDeps || depConfirmed) {
      finalize(false, depChanged)
    }
  }

  // 本人情報「相違あり」→ 編集モード
  const handlePersonalEdit = () => {
    setPersonalEditing(true)
  }

  // 本人情報の編集を確定
  const handlePersonalConfirmEdits = () => {
    setPersonalChanged(true)
    setPersonalConfirmed(true)
    setPersonalEditing(false)
    if (noDeps || depConfirmed) {
      finalize(true, depChanged)
    }
  }

  // 扶養親族「相違なし」
  const handleDepNoChange = () => {
    if (dependents.some((d) => !d.annualIncome.trim())) {
      setIncomeWarningPending('noChange')
      return
    }
    finalizeDep(false)
  }

  // 扶養親族「相違あり」→ 編集モード
  const handleDepEdit = () => {
    setDepEditing(true)
  }

  // 扶養親族の編集を確定
  const handleDepConfirmEdits = () => {
    if (dependents.some((d) => !d.annualIncome.trim())) {
      setIncomeWarningPending('edit')
      return
    }
    finalizeDep(true)
  }

  // 警告モーダルOK後の処理
  const handleIncomeWarningProceed = () => {
    const pending = incomeWarningPending
    setIncomeWarningPending(null)
    if (pending === 'noChange') finalizeDep(false)
    else if (pending === 'edit') finalizeDep(true)
  }

  const finalizeDep = (changed: boolean) => {
    if (changed) {
      setDepChanged(true)
    } else {
      setDepChanged(false)
    }
    setDepConfirmed(true)
    setDepEditing(false)
    if (personalConfirmed) {
      finalize(personalChanged, changed)
    }
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
      {/* ===== 本人情報セクション ===== */}
      <div className={`bg-white rounded-lg border p-4 ${personalConfirmed ? 'border-green-300' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-gray-800">① 本人情報の確認</h3>
          {personalConfirmed && (
            <span className={`px-2 py-0.5 text-xs font-bold rounded ${personalChanged ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
              {personalChanged ? '訂正済み' : '相違なし'}
            </span>
          )}
        </div>

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
              {personalEditing ? (
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                />
              ) : (
                (personalConfirmed && personalChanged ? address : employee.address) || '—'
              )}
            </dd>
          </div>
          <div className="flex items-start">
            <dt className="text-gray-500 w-28 shrink-0">障碍者区分</dt>
            <dd className="text-gray-800 flex-1">
              {personalEditing ? (
                <input
                  type="text"
                  value={disability}
                  onChange={(e) => setDisability(e.target.value)}
                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                />
              ) : (
                (personalConfirmed && personalChanged ? disability : employee.disability) || '非該当'
              )}
            </dd>
          </div>
          <div className="flex items-start">
            <dt className="text-gray-500 w-28 shrink-0">寡婦/ひとり親</dt>
            <dd className="text-gray-800 flex-1">
              {personalEditing ? (
                <input
                  type="text"
                  value={widowSingleParent}
                  onChange={(e) => setWidowSingleParent(e.target.value)}
                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                />
              ) : (
                (personalConfirmed && personalChanged ? widowSingleParent : employee.widowSingleParent) || '非該当'
              )}
            </dd>
          </div>
        </dl>

        {!personalConfirmed && !personalEditing && (
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={handlePersonalNoChange}
              className="flex-1 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg active:bg-green-700"
            >
              前年と相違ありません
            </button>
            <button
              type="button"
              onClick={handlePersonalEdit}
              className="flex-1 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-lg active:bg-orange-600"
            >
              相違があります（訂正する）
            </button>
          </div>
        )}

        {personalEditing && (
          <button
            type="button"
            onClick={handlePersonalConfirmEdits}
            className="mt-4 w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg active:bg-blue-700"
          >
            訂正内容を確定する
          </button>
        )}

        {personalConfirmed && (
          <button
            type="button"
            onClick={() => {
              setPersonalConfirmed(false)
              setPersonalChanged(false)
              setPersonalEditing(false)
            }}
            className="mt-3 text-xs text-gray-500 underline"
          >
            やり直す
          </button>
        )}
      </div>

      {/* ===== 扶養親族セクション ===== */}
      {!noDeps && (
        <div className={`bg-white rounded-lg border p-4 ${depConfirmed ? 'border-green-300' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-gray-800">② 扶養親族・配偶者の確認</h3>
            {depConfirmed && (
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${depChanged ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                {depChanged ? '訂正済み' : '相違なし'}
              </span>
            )}
          </div>

          {/* 年収未入力警告 */}
          {dependents.some((d) => !d.annualIncome.trim()) && (
            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              <p className="font-bold">扶養親族の年収を入力してください</p>
              <p>未入力の場合、正しい年末調整計算ができない可能性があります。給与が0円の場合は0と入力してください。</p>
            </div>
          )}

          <div className="space-y-3">
            {dependents.map((dep, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm relative">
                {depEditing && (
                  <button
                    type="button"
                    onClick={() => removeDependent(i)}
                    className="absolute top-2 right-2 text-xs text-red-500 underline"
                  >
                    削除
                  </button>
                )}

                {depEditing ? (
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

          {depEditing && (
            <button
              type="button"
              onClick={addDependent}
              className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 active:border-blue-400"
            >
              + 扶養親族を追加
            </button>
          )}

          {!depConfirmed && !depEditing && (
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleDepNoChange}
                className="flex-1 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg active:bg-green-700"
              >
                前年と相違ありません
              </button>
              <button
                type="button"
                onClick={handleDepEdit}
                className="flex-1 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-lg active:bg-orange-600"
              >
                相違があります（訂正する）
              </button>
            </div>
          )}

          {depEditing && (
            <button
              type="button"
              onClick={handleDepConfirmEdits}
              className="mt-4 w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg active:bg-blue-700"
            >
              訂正内容を確定する
            </button>
          )}

          {depConfirmed && (
            <button
              type="button"
              onClick={() => {
                setDepConfirmed(false)
                setDepChanged(false)
                setDepEditing(false)
              }}
              className="mt-3 text-xs text-gray-500 underline"
            >
              やり直す
            </button>
          )}
        </div>
      )}

      {/* 進行状況 */}
      {!(personalConfirmed && (noDeps || depConfirmed)) && (
        <div className="text-center text-sm text-gray-500 py-2">
          {!personalConfirmed && '本人情報を確認してください'}
          {personalConfirmed && !depConfirmed && !noDeps && '扶養親族・配偶者を確認してください'}
        </div>
      )}

      <ConfirmModal
        open={incomeWarningPending !== null}
        title="年収が未入力です"
        message={'年収が未入力の扶養親族がいます。\nこのまま進みますか？\n\n（給与が0円の場合は0と入力してください）'}
        confirmLabel="このまま進む"
        cancelLabel="戻って入力する"
        onConfirm={handleIncomeWarningProceed}
        onCancel={() => setIncomeWarningPending(null)}
      />
    </div>
  )
}
