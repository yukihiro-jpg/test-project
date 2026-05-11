import { useEffect, useState } from "react";
import {
  clearAllData,
  deleteCounterparty,
  deleteTemplate,
  listCounterparties,
  listTemplates,
  type BankTemplate,
  type CounterpartyRecord,
} from "../lib/db";

interface Props {
  onBack: () => void;
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ja-JP");
}

export function SettingsScreen({ onBack }: Props) {
  const [templates, setTemplates] = useState<BankTemplate[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRecord[]>(
    [],
  );

  async function refresh() {
    const [tpls, cps] = await Promise.all([
      listTemplates(),
      listCounterparties(),
    ]);
    setTemplates(tpls);
    setCounterparties(cps);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDeleteTemplate(id: string) {
    if (!window.confirm("このテンプレートを削除しますか？")) return;
    await deleteTemplate(id);
    await refresh();
  }

  async function handleDeleteCounterparty(id: string) {
    if (!window.confirm("この学習履歴を削除しますか？")) return;
    await deleteCounterparty(id);
    await refresh();
  }

  async function handleClearAll() {
    if (
      !window.confirm(
        "すべてのデータ（テンプレート・途中保存・学習履歴）を削除します。よろしいですか？",
      )
    )
      return;
    if (
      !window.confirm(
        "本当に削除しますか？この操作は取り消せません。",
      )
    )
      return;
    await clearAllData();
    await refresh();
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            戻る
          </button>
          <h1 className="text-lg font-bold text-gray-900">設定</h1>
        </div>
        <button
          type="button"
          onClick={handleClearAll}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          すべてのデータを削除
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                銀行テンプレート
              </h2>
              <span className="text-[11px] text-gray-500">
                {templates.length} 件
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              CSVのヘッダー列構成を覚えています。同じ銀行のCSVを次回読み込んだとき、自動でマッピングを適用します。
            </p>
            {templates.length === 0 ? (
              <p className="mt-4 text-xs text-gray-500">
                登録済みのテンプレートはまだありません。
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {tpl.name}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-gray-500">
                        列構成: {tpl.headerSignature} · 最終使用{" "}
                        {formatDateTime(tpl.lastUsedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="ml-3 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-red-50 hover:text-red-700"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                取引先の学習履歴
              </h2>
              <span className="text-[11px] text-gray-500">
                {counterparties.length} 件
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              「金額＋日付パターン」で学習された摘要候補です。編集中に同じパターンの取引が出ると候補として提示されます。
            </p>
            {counterparties.length === 0 ? (
              <p className="mt-4 text-xs text-gray-500">
                学習履歴はまだありません。
              </p>
            ) : (
              <div className="mt-3 overflow-auto rounded-md border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">摘要</th>
                      <th className="px-3 py-2 text-right font-medium">金額</th>
                      <th className="px-3 py-2 text-right font-medium">
                        日（毎月）
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        ヒット数
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        最終使用
                      </th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {counterparties.map((cp) => (
                      <tr key={cp.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">{cp.summary}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {cp.amount.toLocaleString("ja-JP")}
                        </td>
                        <td className="px-3 py-2 text-right">{cp.dayOfMonth}</td>
                        <td className="px-3 py-2 text-right">{cp.hitCount}</td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {formatDateTime(cp.lastUsedAt)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteCounterparty(cp.id)}
                            className="text-xs text-gray-500 hover:text-red-600"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
