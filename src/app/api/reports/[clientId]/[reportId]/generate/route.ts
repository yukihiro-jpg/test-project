/**
 * レポート生成 API
 *
 * アップロード済みの4帳票データを再度パースし直し、
 * 7セクション構成のレポートコンテンツを生成して Firestore に保存する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/firestore/clients-repo'
import {
  getPreviousMonthOpenComments,
  getReport,
  listSections,
  saveSection,
} from '@/lib/firestore/reports-repo'
import {
  decodeBuffer,
  parseGeneralLedger,
  parseThreePeriod,
  parseTransition,
  parseTrialBalance,
} from '@/lib/parsers'
import { generateReport } from '@/lib/reports/generator'
import { downloadFile } from '@/lib/storage/gcs'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(
  _req: NextRequest,
  { params }: { params: { clientId: string; reportId: string } },
) {
  const [yearStr, monthStr] = params.reportId.split('_')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  const report = await getReport(params.clientId, year, month)
  if (!report) {
    return NextResponse.json({ error: 'レポートが見つかりません' }, { status: 404 })
  }

  // GCS から原本 CSV を取得して再パース
  const [tbBuf, trBuf, tpBuf, glBuf] = await Promise.all([
    downloadByGsPath(report.sourceData.trialBalanceFile),
    downloadByGsPath(report.sourceData.transitionFile),
    downloadByGsPath(report.sourceData.threePeriodFile),
    downloadByGsPath(report.sourceData.generalLedgerFile),
  ])
  const tb = parseTrialBalance(decodeBuffer(tbBuf))
  const tr = parseTransition(decodeBuffer(trBuf))
  const tp = parseThreePeriod(decodeBuffer(tpBuf))
  const gl = parseGeneralLedger(decodeBuffer(glBuf))

  const profile = await getProfile(params.clientId)

  // 前月のオープン宿題を取得
  const previousOpen = await getPreviousMonthOpenComments(params.clientId, year, month)

  const sections = generateReport({
    trialBalance: tb,
    transition: tr,
    threePeriod: tp,
    generalLedger: gl,
    profile,
    targetYear: year,
    targetMonth: month,
    previousMonthOpenItems: previousOpen.map((c) => ({
      content: c.content,
      pageNumber: c.pageNumber,
    })),
  })

  // Firestore にセクションを保存
  await Promise.all(sections.map((s) => saveSection(params.clientId, params.reportId, s)))

  const savedSections = await listSections(params.clientId, params.reportId)
  return NextResponse.json({ sections: savedSections })
}

async function downloadByGsPath(gsPath: string): Promise<Buffer> {
  // gs://bucket/path → bucket/path を path のみに
  const match = gsPath.match(/^gs:\/\/([^/]+)\/(.+)$/)
  if (!match) throw new Error(`Invalid GCS path: ${gsPath}`)
  return downloadFile(match[2])
}
