'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/common/currency-input';
import { MoneyInput } from '@/components/common/money-input';
import { Plus, Trash2 } from 'lucide-react';

const inputClass =
  'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

const ACCOUNT_TYPES = ['現金', '普通預金', '定期預金', '通常貯金', '定期貯金', 'その他'];

export default function CashPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const items = currentCase.assets.cashDeposits;
  const totalBalance = items.reduce((sum, item) => sum + (item.balance || 0), 0);
  const totalAccruedInterest = items.reduce(
    (sum, item) => sum + (item.accruedInterest || 0),
    0,
  );

  const handleAdd = () => {
    addAsset('cashDeposits', {
      institutionName: '',
      branchName: '',
      accountType: '普通預金',
      accountNumber: '',
      balance: 0,
      accruedInterest: 0,
      hasBalanceCertificate: false,
      note: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">預金</h1>
        <Button onClick={handleAdd}>
          <Plus size={18} className="mr-2" />
          追加
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-center border border-gray-300">銀行名</th>
              <th className="p-2 text-center border border-gray-300">支店名</th>
              <th className="p-2 text-center border border-gray-300">種類</th>
              <th className="p-2 text-center border border-gray-300">口座番号</th>
              <th className="p-2 text-center border border-gray-300">金額</th>
              <th className="p-2 text-center border border-gray-300">経過利息</th>
              <th className="p-2 text-center border border-gray-300">残証有無</th>
              <th className="p-2 text-center border border-gray-300">備考</th>
              <th className="p-2 text-center border border-gray-300 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    value={item.institutionName}
                    onChange={e =>
                      updateAsset('cashDeposits', item.id, {
                        institutionName: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    value={item.branchName || ''}
                    onChange={e =>
                      updateAsset('cashDeposits', item.id, {
                        branchName: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <select
                    value={item.accountType}
                    onChange={e =>
                      updateAsset('cashDeposits', item.id, {
                        accountType: e.target.value,
                      })
                    }
                    className={`${inputClass} pr-6 appearance-auto`}
                  >
                    {ACCOUNT_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    value={item.accountNumber || ''}
                    onChange={e =>
                      updateAsset('cashDeposits', item.id, {
                        accountNumber: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <MoneyInput
                    value={item.balance || ''}
                    onChange={v =>
                      updateAsset('cashDeposits', item.id, {
                        balance: v,
                      })
                    }
                    className={`${inputClass} text-right`}
                    min={0}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <MoneyInput
                    value={item.accruedInterest || ''}
                    onChange={v =>
                      updateAsset('cashDeposits', item.id, {
                        accruedInterest: v,
                      })
                    }
                    className={`${inputClass} text-right`}
                    min={0}
                  />
                </td>
                <td className="p-2 border border-gray-300 text-center">
                  <input
                    type="checkbox"
                    checked={item.hasBalanceCertificate || false}
                    onChange={e =>
                      updateAsset('cashDeposits', item.id, {
                        hasBalanceCertificate: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    value={item.note}
                    onChange={e =>
                      updateAsset('cashDeposits', item.id, { note: e.target.value })
                    }
                    className={inputClass}
                  />
                </td>
                <td className="p-2 border border-gray-300 text-center">
                  <button
                    type="button"
                    onClick={() => removeAsset('cashDeposits', item.id)}
                    className="text-red-600 hover:text-red-800"
                    aria-label="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2">
              <td colSpan={4} className="p-2 text-right border border-gray-300">
                合計
              </td>
              <td className="p-2 text-right border border-gray-300">
                {formatCurrency(totalBalance)}
              </td>
              <td className="p-2 text-right border border-gray-300">
                {formatCurrency(totalAccruedInterest)}
              </td>
              <td className="border border-gray-300" colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
