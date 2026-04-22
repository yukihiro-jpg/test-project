'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/common/currency-input';
import { toWareki } from '@/lib/dates/wareki';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type {
  FundsMovement,
  FundsMovementEntry,
  FundsMovementTransaction,
  CashDepositAsset,
} from '@/types';

const inputClass =
  'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';


function buildEmptyTransactions(
  accounts: CashDepositAsset[],
): FundsMovementTransaction[] {
  return accounts.map(account => ({
    accountId: account.id,
    deposit: 0,
    withdrawal: 0,
  }));
}

function reconcileTransactions(
  existing: FundsMovementTransaction[],
  accounts: CashDepositAsset[],
): FundsMovementTransaction[] {
  return accounts.map(account => {
    const found = existing.find(t => t.accountId === account.id);
    return (
      found || {
        accountId: account.id,
        deposit: 0,
        withdrawal: 0,
      }
    );
  });
}

export default function FundsMovementPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const updateFundsMovement = useCaseStore(s => s.updateFundsMovement);

  // Initialize fundsMovement if not set yet.
  useEffect(() => {
    if (currentCase && !currentCase.fundsMovement) {
      const initial: FundsMovement = {
        id: uuidv4(),
        caseId: currentCase.id,
        movements: [],
      };
      updateFundsMovement(initial);
    }
  }, [currentCase, updateFundsMovement]);

  const introKey = `funds-intro-${currentCase?.id}`;
  const defaultIntro = `被相続人の預貯金等について調査・確認を行った結果、特筆すべき取引とその内容は以下の通りです。\n下記表以外の被相続人の預貯金等の取引については財産性があると考えられるものはありませんでした。\n被相続人については、生前において現金を随時引き出して生活費、交際費その他私的支出に充てる傾向が認められ、当該出金についても領収書その他の使途を裏付ける資料は確認できなかったものの、\n預貯金の滞留状況、親族からの聴取内容及び被相続人の金銭使用状況等を総合勘案し、相続開始時点において残存していた財産には該当しないものと判断した。`;
  const [introText, setIntroText] = useState('');
  useEffect(() => {
    const saved = localStorage.getItem(introKey);
    setIntroText(saved || defaultIntro);
  }, [introKey]);
  const handleIntroChange = (text: string) => {
    setIntroText(text);
    localStorage.setItem(introKey, text);
  };

  if (!currentCase) {
    return <p className="text-gray-500">案件を選択してください</p>;
  }

  const accounts = currentCase.assets.cashDeposits;
  const fundsMovement: FundsMovement = currentCase.fundsMovement ?? {
    id: '',
    caseId: currentCase.id,
    movements: [],
  };
  const movements = fundsMovement.movements;

  const persist = (next: FundsMovementEntry[]) => {
    updateFundsMovement({
      ...fundsMovement,
      id: fundsMovement.id || uuidv4(),
      caseId: currentCase.id,
      movements: next,
    });
  };

  const handleAddRow = () => {
    const newEntry: FundsMovementEntry = {
      id: uuidv4(),
      date: '',
      transactions: buildEmptyTransactions(accounts),
      inheritanceAmount: 0,
      note: '',
    };
    persist([...movements, newEntry]);
  };

  const handleRemoveRow = (id: string) => {
    persist(movements.filter(m => m.id !== id));
  };

  const handleUpdateEntry = (
    id: string,
    updates: Partial<FundsMovementEntry>,
  ) => {
    persist(
      movements.map(m => (m.id === id ? { ...m, ...updates } : m)),
    );
  };

  const handleUpdateTransaction = (
    entryId: string,
    accountId: string,
    updates: Partial<FundsMovementTransaction>,
  ) => {
    persist(
      movements.map(entry => {
        if (entry.id !== entryId) return entry;
        const reconciled = reconcileTransactions(
          entry.transactions,
          accounts,
        );
        return {
          ...entry,
          transactions: reconciled.map(t =>
            t.accountId === accountId ? { ...t, ...updates } : t,
          ),
        };
      }),
    );
  };

  // Totals per account and overall inheritance amount.
  const totals = useMemo(() => {
    const perAccount: Record<string, { deposit: number; withdrawal: number }> =
      {};
    accounts.forEach(a => {
      perAccount[a.id] = { deposit: 0, withdrawal: 0 };
    });
    let inheritanceTotal = 0;
    movements.forEach(entry => {
      entry.transactions.forEach(t => {
        if (!perAccount[t.accountId]) return;
        perAccount[t.accountId].deposit += t.deposit || 0;
        perAccount[t.accountId].withdrawal += t.withdrawal || 0;
      });
      inheritanceTotal += entry.inheritanceAmount || 0;
    });
    return { perAccount, inheritanceTotal };
  }, [movements, accounts]);

  const totalColumns = 1 + accounts.length * 2 + 2 + 1; // date + (deposit/withdrawal)*N + conclusion + note + delete

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">金融資産異動一覧表</h1>
        <Button onClick={handleAddRow} disabled={accounts.length === 0}>
          <Plus size={18} className="mr-2" />
          行を追加
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded p-4">
        <textarea
          className="w-full border border-gray-300 rounded p-2 text-sm"
          rows={5}
          value={introText}
          onChange={e => handleIntroChange(e.target.value)}
        />
      </div>

      {accounts.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-800">
          まず預金口座を登録してください
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th
                  rowSpan={2}
                  className="p-2 text-left border border-gray-300 align-middle min-w-[140px]"
                >
                  日付
                </th>
                {accounts.map(account => (
                  <th
                    key={account.id}
                    colSpan={2}
                    className="p-2 text-center border border-gray-300 align-top min-w-[220px]"
                  >
                    <div className="font-semibold">
                      {(account.institutionName || '（金融機関名未設定）') +
                        (account.branchName ? ` ${account.branchName}` : '')}
                    </div>
                    {account.accountNumber && (
                      <div className="text-xs text-gray-600">
                        No.{account.accountNumber}
                      </div>
                    )}
                    {account.note && (
                      <div className="text-xs text-gray-500 mt-1">
                        {account.note}
                      </div>
                    )}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="p-2 text-right border border-gray-300 align-middle min-w-[140px]"
                >
                  結論（相続財産計上額）
                </th>
                <th
                  rowSpan={2}
                  className="p-2 text-left border border-gray-300 align-middle min-w-[180px]"
                >
                  備考
                </th>
                <th
                  rowSpan={2}
                  className="p-2 text-center border border-gray-300 align-middle w-12"
                ></th>
              </tr>
              <tr className="bg-gray-100">
                {accounts.map(account => (
                  <React.Fragment key={account.id}>
                    <th className="p-2 text-right border border-gray-300 min-w-[110px]">
                      入金
                    </th>
                    <th className="p-2 text-right border border-gray-300 min-w-[110px]">
                      出金
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td
                    colSpan={totalColumns}
                    className="p-4 text-center text-gray-500 border border-gray-300"
                  >
                    行を追加してください
                  </td>
                </tr>
              ) : (
                movements.map((entry, i) => {
                  const reconciled = reconcileTransactions(
                    entry.transactions,
                    accounts,
                  );
                  return (
                    <tr
                      key={entry.id}
                      className={i % 2 === 0 ? '' : 'bg-gray-50'}
                    >
                      <td className="p-2 border border-gray-300 align-top">
                        <input
                          type="date"
                          value={entry.date}
                          onChange={e =>
                            handleUpdateEntry(entry.id, {
                              date: e.target.value,
                            })
                          }
                          className={inputClass}
                        />
                        {entry.date && (
                          <div className="text-xs text-gray-500 mt-1">
                            {toWareki(entry.date)}
                          </div>
                        )}
                      </td>
                      {accounts.map(account => {
                        const tx =
                          reconciled.find(t => t.accountId === account.id) ?? {
                            accountId: account.id,
                            deposit: 0,
                            withdrawal: 0,
                          };
                        return (
                          <React.Fragment key={account.id}>
                            <td className="p-2 border border-gray-300 align-top">
                              <input
                                type="number"
                                value={tx.deposit || ''}
                                onChange={e =>
                                  handleUpdateTransaction(
                                    entry.id,
                                    account.id,
                                    {
                                      deposit: Number(e.target.value) || 0,
                                    },
                                  )
                                }
                                className={`${inputClass} text-right`}
                                min={0}
                              />
                            </td>
                            <td className="p-2 border border-gray-300 align-top">
                              <input
                                type="number"
                                value={tx.withdrawal || ''}
                                onChange={e =>
                                  handleUpdateTransaction(
                                    entry.id,
                                    account.id,
                                    {
                                      withdrawal:
                                        Number(e.target.value) || 0,
                                    },
                                  )
                                }
                                className={`${inputClass} text-right`}
                                min={0}
                              />
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="p-2 border border-gray-300 align-top">
                        <input
                          type="number"
                          value={entry.inheritanceAmount || ''}
                          onChange={e =>
                            handleUpdateEntry(entry.id, {
                              inheritanceAmount:
                                Number(e.target.value) || 0,
                            })
                          }
                          className={`${inputClass} text-right`}
                          min={0}
                        />
                      </td>
                      <td className="p-2 border border-gray-300 align-top">
                        <input
                          type="text"
                          value={entry.note}
                          onChange={e =>
                            handleUpdateEntry(entry.id, {
                              note: e.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </td>
                      <td className="p-2 border border-gray-300 text-center align-top">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(entry.id)}
                          className="text-red-600 hover:text-red-800"
                          aria-label="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold border-t-2">
                <td className="p-2 text-right border border-gray-300">合計</td>
                {accounts.map(account => {
                  const sums = totals.perAccount[account.id] ?? {
                    deposit: 0,
                    withdrawal: 0,
                  };
                  return (
                    <React.Fragment key={account.id}>
                      <td className="p-2 text-right border border-gray-300">
                        {formatCurrency(sums.deposit)}
                      </td>
                      <td className="p-2 text-right border border-gray-300">
                        {formatCurrency(sums.withdrawal)}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="p-2 text-right border border-gray-300">
                  {formatCurrency(totals.inheritanceTotal)}
                </td>
                <td className="border border-gray-300" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
