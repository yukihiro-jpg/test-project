/**
 * 顧問先一覧画面
 */

import Link from 'next/link'
import { listClients } from '@/lib/firestore/clients-repo'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const clients = await listClients()

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">顧問先一覧</h1>
        <Link
          href="/clients/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
        >
          ＋ 新規登録
        </Link>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {clients.length === 0 ? (
          <p className="p-8 text-center text-gray-500">
            まだ顧問先が登録されていません。
          </p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 text-sm font-medium">顧問先名</th>
                <th className="text-left px-4 py-2 text-sm font-medium">業種コード</th>
                <th className="text-left px-4 py-2 text-sm font-medium">決算月</th>
                <th className="text-left px-4 py-2 text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{c.industryCode}</td>
                  <td className="px-4 py-3 text-sm">{c.fiscalYearEndMonth}月</td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/clients/${c.id}/reports/upload`}
                      className="text-green-600 hover:underline"
                    >
                      今月分をアップロード →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
