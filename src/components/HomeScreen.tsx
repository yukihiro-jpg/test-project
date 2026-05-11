import { useEffect, useState } from "react";
import { deleteSession, listSessions, type ImportSession } from "../lib/db";

interface Props {
  onNewImport: () => void;
  onResume: (session: ImportSession) => void;
  onOpenSettings: () => void;
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countRemaining(session: ImportSession): number {
  let n = 0;
  for (const row of session.rows) {
    if (row.needsReview && row.editedSummary.trim() === "") n++;
  }
  return n;
}

export function HomeScreen({ onNewImport, onResume, onOpenSettings }: Props) {
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const all = await listSessions();
      setSessions(all.filter((s) => s.status === "in_progress"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("この途中保存セッションを削除しますか？")) return;
    await deleteSession(id);
    await refresh();
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">銀行CSV修正ツール</h1>
            <p className="mt-0.5 text-xs text-gray-600">
              摘要欄が空欄の取引を効率的に補完するためのデスクトップアプリ
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            設定
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">新規取込</h2>
            <p className="mt-1 text-xs text-gray-600">
              新しいCSVファイルを読み込んで作業を開始します。
            </p>
            <button
              type="button"
              onClick={onNewImport}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              CSVを取込
            </button>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                途中の作業を再開
              </h2>
              <span className="text-[11px] text-gray-500">
                {sessions.length} 件
              </span>
            </div>

            {loading ? (
              <p className="mt-4 text-xs text-gray-500">読み込み中...</p>
            ) : sessions.length === 0 ? (
              <p className="mt-4 text-xs text-gray-500">
                途中保存された作業はありません。
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100">
                {sessions.map((session) => {
                  const remaining = countRemaining(session);
                  return (
                    <li
                      key={session.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {session.bankInfo.bankName}
                          {session.bankInfo.accountName && (
                            <span className="ml-1 text-gray-500">
                              / {session.bankInfo.accountName}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-gray-500">
                          {session.imported.fileName} · {session.rows.length}行 ·
                          未処理 {remaining}件 · 更新{" "}
                          {formatDateTime(session.updatedAt)}
                        </div>
                      </div>
                      <div className="ml-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => onResume(session)}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          再開
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(session.id)}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-red-50 hover:text-red-700"
                        >
                          削除
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
