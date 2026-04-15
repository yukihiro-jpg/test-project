/**
 * 月次レポート詳細画面
 *
 * - セクション一覧表示
 * - 各セクションへのコメント追加
 * - AI叩き台生成
 * - PDF / Excel ダウンロード
 * - メール送信
 */

import Link from 'next/link'
import { getClient } from '@/lib/firestore/clients-repo'
import { getReport, listComments, listSections } from '@/lib/firestore/reports-repo'
import ReportView from './ReportView'

export const dynamic = 'force-dynamic'

export default async function ReportPage({
  params,
}: {
  params: { clientId: string; reportId: string }
}) {
  const [yearStr, monthStr] = params.reportId.split('_')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  const [client, report, sections, comments] = await Promise.all([
    getClient(params.clientId),
    getReport(params.clientId, year, month),
    listSections(params.clientId, params.reportId),
    listComments(params.clientId, params.reportId),
  ])

  if (!client || !report) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p>レポートが見つかりません。</p>
        <Link href={`/clients/${params.clientId}`} className="text-blue-600 hover:underline">
          ← 戻る
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-gray-600">
            {year}年{month}月 月次財務報告 ・ ステータス: {report.status}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/reports/${params.clientId}/${params.reportId}/export-pdf`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
          >
            PDF ダウンロード
          </a>
          <a
            href={`/api/reports/${params.clientId}/${params.reportId}/export-excel`}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
          >
            Excel ダウンロード
          </a>
        </div>
      </div>

      {!report.validation.passed && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="font-bold text-red-800 mb-2">⚠ 帳票間の整合性に問題があります</h3>
          <ul className="text-sm text-red-700 space-y-1">
            {report.validation.checks
              .filter((c) => !c.passed)
              .slice(0, 5)
              .map((c, i) => (
                <li key={i}>
                  ・{c.name}
                  {c.message && <span className="text-gray-600"> ({c.message})</span>}
                </li>
              ))}
          </ul>
        </div>
      )}

      <ReportView
        clientId={params.clientId}
        reportId={params.reportId}
        sections={sections}
        initialComments={comments}
      />
    </main>
  )
}
