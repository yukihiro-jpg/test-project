'use client';

import React from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatManyen } from '@/components/common/currency-input';
import { MoneyInput } from '@/components/common/money-input';
import { calculateInsuranceExemption } from '@/lib/tax/asset-valuation';
import { countLegalHeirs } from '@/lib/tax/deductions';
import { Plus, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helper: parse / serialize extra fields stored in the note field
// We store additional fields as JSON in the note field with a prefix marker.
// Format: "##JSON##{"address":"...","insured":"...",...}##END##<user note>"
// ---------------------------------------------------------------------------
interface ExtraFields {
  address?: string;       // 住所
  insured?: string;       // 被保険者
  contractor?: string;    // 契約者
  premiumPayer?: string;  // 保険料負担者
  receiveDate?: string;   // 受取日
  // Section 2 extras
  oldContractor?: string; // 旧契約者
  // Section 3 extras
  pensionType?: string;   // 年金種類
  monthlyPension?: number; // 月額年金
  remainingPeriod?: string; // 残存期間
}

const JSON_PREFIX = '##JSON##';
const JSON_SUFFIX = '##END##';

function parseNote(note: string): { extra: ExtraFields; userNote: string } {
  if (!note.startsWith(JSON_PREFIX)) {
    return { extra: {}, userNote: note };
  }
  const endIdx = note.indexOf(JSON_SUFFIX);
  if (endIdx === -1) {
    return { extra: {}, userNote: note };
  }
  try {
    const jsonStr = note.slice(JSON_PREFIX.length, endIdx);
    const extra = JSON.parse(jsonStr) as ExtraFields;
    const userNote = note.slice(endIdx + JSON_SUFFIX.length);
    return { extra, userNote };
  } catch {
    return { extra: {}, userNote: note };
  }
}

function serializeNote(extra: ExtraFields, userNote: string): string {
  const hasExtra = Object.values(extra).some(v => v !== undefined && v !== '' && v !== 0);
  if (!hasExtra && !userNote) return '';
  if (!hasExtra) return userNote;
  return `${JSON_PREFIX}${JSON.stringify(extra)}${JSON_SUFFIX}${userNote}`;
}

// ---------------------------------------------------------------------------
// Shared inline input class
// ---------------------------------------------------------------------------
const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm';
const inputClassRight = `${inputClass} text-right`;

// ---------------------------------------------------------------------------
// Section type discriminator
// ---------------------------------------------------------------------------
type SectionType = 'death' | 'life' | 'annuity';

function getSectionType(note: string, isDeathBenefit: boolean): SectionType {
  if (isDeathBenefit) return 'death';
  const { extra } = parseNote(note);
  if (extra.pensionType || extra.monthlyPension || extra.remainingPeriod) return 'annuity';
  // Default non-death-benefit to 'life' unless it has annuity fields
  return 'life';
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function InsurancePage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const items = currentCase.assets.insurances;
  const heirs = currentCase.heirs;
  const legalHeirCount = countLegalHeirs(heirs);
  const { totalAmount, exemption, taxableAmount } = calculateInsuranceExemption(items, legalHeirCount);

  // Categorise items
  const deathBenefitItems = items.filter(i => getSectionType(i.note, i.isDeathBenefit) === 'death');
  const lifeRightItems = items.filter(i => getSectionType(i.note, i.isDeathBenefit) === 'life');
  const annuityItems = items.filter(i => getSectionType(i.note, i.isDeathBenefit) === 'annuity');

  // -- Update helpers -------------------------------------------------------
  function updateExtra(id: string, currentNote: string, patch: Partial<ExtraFields>) {
    const { extra, userNote } = parseNote(currentNote);
    const newExtra = { ...extra, ...patch };
    updateAsset('insurances', id, { note: serializeNote(newExtra, userNote) });
  }

  function updateUserNote(id: string, currentNote: string, newUserNote: string) {
    const { extra } = parseNote(currentNote);
    updateAsset('insurances', id, { note: serializeNote(extra, newUserNote) });
  }

  // -- Add handlers ---------------------------------------------------------
  function handleAddDeath() {
    addAsset('insurances', {
      insuranceCompany: '',
      policyNumber: '',
      beneficiaryHeirId: '',
      amount: 0,
      isDeathBenefit: true,
      note: '',
    });
  }

  function handleAddLife() {
    addAsset('insurances', {
      insuranceCompany: '',
      policyNumber: '',
      beneficiaryHeirId: '',
      amount: 0,
      isDeathBenefit: false,
      note: '',
    });
  }

  function handleAddAnnuity() {
    const extra: ExtraFields = { pensionType: '', monthlyPension: 0, remainingPeriod: '' };
    addAsset('insurances', {
      insuranceCompany: '',
      policyNumber: '',
      beneficiaryHeirId: '',
      amount: 0,
      isDeathBenefit: false,
      note: serializeNote(extra, ''),
    });
  }

  // -- Heir name lookup -----------------------------------------------------
  function heirName(id: string): string {
    const h = heirs.find(h => h.id === id);
    return h?.name || '';
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">保険金</h1>

      {/* ================================================================= */}
      {/* Section 1: 死亡保険金                                              */}
      {/* ================================================================= */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">死亡保険金</h2>
          <Button size="sm" onClick={handleAddDeath}>
            <Plus size={16} className="mr-1" />追加
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">No</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">保険会社</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">（住所）</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">保険証書記号番号</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">被保険者</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">契約者</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">保険料負担者</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">死亡保険金受取人</th>
                <th className="p-2 text-right border border-gray-300 whitespace-nowrap">死亡保険金額</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">受取日</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">備考</th>
                <th className="p-2 text-center border border-gray-300 whitespace-nowrap w-10"></th>
              </tr>
            </thead>
            <tbody>
              {deathBenefitItems.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-4 text-center text-gray-400 border border-gray-300">
                    データがありません。「追加」ボタンで保険金を登録してください。
                  </td>
                </tr>
              )}
              {deathBenefitItems.map((item, i) => {
                const { extra, userNote } = parseNote(item.note);
                return (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-1 border border-gray-300 text-center">{i + 1}</td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={item.insuranceCompany}
                        onChange={e => updateAsset('insurances', item.id, { insuranceCompany: e.target.value })}
                        placeholder="保険会社名"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={extra.address || ''}
                        onChange={e => updateExtra(item.id, item.note, { address: e.target.value })}
                        placeholder="住所"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={item.policyNumber}
                        onChange={e => updateAsset('insurances', item.id, { policyNumber: e.target.value })}
                        placeholder="記号番号"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={extra.insured || ''}
                        onChange={e => updateExtra(item.id, item.note, { insured: e.target.value })}
                        placeholder="被保険者名"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={extra.contractor || ''}
                        onChange={e => updateExtra(item.id, item.note, { contractor: e.target.value })}
                        placeholder="契約者名"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={extra.premiumPayer || ''}
                        onChange={e => updateExtra(item.id, item.note, { premiumPayer: e.target.value })}
                        placeholder="負担者名"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <select
                        className={inputClass}
                        value={item.beneficiaryHeirId}
                        onChange={e => updateAsset('insurances', item.id, { beneficiaryHeirId: e.target.value })}
                      >
                        <option value="">選択してください</option>
                        {heirs.map(h => (
                          <option key={h.id} value={h.id}>{h.name || '（未入力）'}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1 border border-gray-300">
                      <MoneyInput
                        className={inputClassRight}
                        value={item.amount || ''}
                        onChange={v => updateAsset('insurances', item.id, { amount: v })}
                        min={0}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        type="date"
                        className={inputClass}
                        value={extra.receiveDate || ''}
                        onChange={e => updateExtra(item.id, item.note, { receiveDate: e.target.value })}
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={userNote}
                        onChange={e => updateUserNote(item.id, item.note, e.target.value)}
                        placeholder="備考"
                      />
                    </td>
                    <td className="p-1 border border-gray-300 text-center">
                      <button
                        className="text-red-500 hover:text-red-700 p-1"
                        onClick={() => removeAsset('insurances', item.id)}
                        title="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {deathBenefitItems.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-400">
                  <td colSpan={8} className="p-2 text-right border border-gray-300">合計</td>
                  <td className="p-2 text-right border border-gray-300">
                    {formatCurrency(deathBenefitItems.reduce((s, i) => s + i.amount, 0))}
                  </td>
                  <td colSpan={3} className="border border-gray-300"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Summary card: 非課税枠 */}
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">保険金合計</p>
              <p className="font-semibold">{formatManyen(totalAmount)}</p>
            </div>
            <div>
              <p className="text-gray-600">非課税枠（500万円 × {legalHeirCount}人）</p>
              <p className="font-semibold text-green-700">▲ {formatManyen(exemption)}</p>
            </div>
            <div>
              <p className="text-gray-600">課税対象額</p>
              <p className="font-semibold text-blue-700">{formatManyen(taxableAmount)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Section 2: 生命保険契約に関する権利                                 */}
      {/* ================================================================= */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">生命保険契約に関する権利</h2>
          <Button size="sm" onClick={handleAddLife}>
            <Plus size={16} className="mr-1" />追加
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">No</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">保険会社</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">保険証書記号番号</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">旧契約者</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">被保険者</th>
                <th className="p-2 text-right border border-gray-300 whitespace-nowrap">評価額</th>
                <th className="p-2 text-center border border-gray-300 whitespace-nowrap w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lifeRightItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-400 border border-gray-300">
                    データがありません。「追加」ボタンで登録してください。
                  </td>
                </tr>
              )}
              {lifeRightItems.map((item, i) => {
                const { extra, userNote } = parseNote(item.note);
                return (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-1 border border-gray-300 text-center">{i + 1}</td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={item.insuranceCompany}
                        onChange={e => updateAsset('insurances', item.id, { insuranceCompany: e.target.value })}
                        placeholder="保険会社名"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={item.policyNumber}
                        onChange={e => updateAsset('insurances', item.id, { policyNumber: e.target.value })}
                        placeholder="記号番号"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={extra.oldContractor || ''}
                        onChange={e => updateExtra(item.id, item.note, { oldContractor: e.target.value })}
                        placeholder="旧契約者名"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={extra.insured || ''}
                        onChange={e => updateExtra(item.id, item.note, { insured: e.target.value })}
                        placeholder="被保険者名"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        type="number"
                        className={inputClassRight}
                        value={item.amount || ''}
                        onChange={e => updateAsset('insurances', item.id, { amount: Number(e.target.value) || 0 })}
                        min={0}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-1 border border-gray-300 text-center">
                      <button
                        className="text-red-500 hover:text-red-700 p-1"
                        onClick={() => removeAsset('insurances', item.id)}
                        title="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {lifeRightItems.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-400">
                  <td colSpan={5} className="p-2 text-right border border-gray-300">合計</td>
                  <td className="p-2 text-right border border-gray-300">
                    {formatCurrency(lifeRightItems.reduce((s, i) => s + i.amount, 0))}
                  </td>
                  <td className="border border-gray-300"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Section 3: 定期金に関する権利                                      */}
      {/* ================================================================= */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">定期金に関する権利</h2>
          <Button size="sm" onClick={handleAddAnnuity}>
            <Plus size={16} className="mr-1" />追加
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">No</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">保険会社</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">保険証書記号番号</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">年金種類</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">年金受取人</th>
                <th className="p-2 text-right border border-gray-300 whitespace-nowrap">月額年金</th>
                <th className="p-2 text-left border border-gray-300 whitespace-nowrap">残存期間</th>
                <th className="p-2 text-right border border-gray-300 whitespace-nowrap">評価額</th>
                <th className="p-2 text-center border border-gray-300 whitespace-nowrap w-10"></th>
              </tr>
            </thead>
            <tbody>
              {annuityItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-400 border border-gray-300">
                    データがありません。「追加」ボタンで登録してください。
                  </td>
                </tr>
              )}
              {annuityItems.map((item, i) => {
                const { extra } = parseNote(item.note);
                return (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-1 border border-gray-300 text-center">{i + 1}</td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={item.insuranceCompany}
                        onChange={e => updateAsset('insurances', item.id, { insuranceCompany: e.target.value })}
                        placeholder="保険会社名"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={item.policyNumber}
                        onChange={e => updateAsset('insurances', item.id, { policyNumber: e.target.value })}
                        placeholder="記号番号"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={extra.pensionType || ''}
                        onChange={e => updateExtra(item.id, item.note, { pensionType: e.target.value })}
                        placeholder="年金種類"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <select
                        className={inputClass}
                        value={item.beneficiaryHeirId}
                        onChange={e => updateAsset('insurances', item.id, { beneficiaryHeirId: e.target.value })}
                      >
                        <option value="">選択してください</option>
                        {heirs.map(h => (
                          <option key={h.id} value={h.id}>{h.name || '（未入力）'}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        type="number"
                        className={inputClassRight}
                        value={extra.monthlyPension || ''}
                        onChange={e => updateExtra(item.id, item.note, { monthlyPension: Number(e.target.value) || 0 })}
                        min={0}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        className={inputClass}
                        value={extra.remainingPeriod || ''}
                        onChange={e => updateExtra(item.id, item.note, { remainingPeriod: e.target.value })}
                        placeholder="例: 10年"
                      />
                    </td>
                    <td className="p-1 border border-gray-300">
                      <input
                        type="number"
                        className={inputClassRight}
                        value={item.amount || ''}
                        onChange={e => updateAsset('insurances', item.id, { amount: Number(e.target.value) || 0 })}
                        min={0}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-1 border border-gray-300 text-center">
                      <button
                        className="text-red-500 hover:text-red-700 p-1"
                        onClick={() => removeAsset('insurances', item.id)}
                        title="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {annuityItems.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-400">
                  <td colSpan={7} className="p-2 text-right border border-gray-300">合計</td>
                  <td className="p-2 text-right border border-gray-300">
                    {formatCurrency(annuityItems.reduce((s, i) => s + i.amount, 0))}
                  </td>
                  <td className="border border-gray-300"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
