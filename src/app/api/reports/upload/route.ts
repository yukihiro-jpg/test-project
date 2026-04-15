/**
 * CSV アップロード API
 *
 * multipart/form-data で 4 種類の CSV を受け取り、
 * 文字コード変換・パース・帳票間バリデーションを行う。
 * 成功時は GCS に原本保存＆ Firestore にレポートを登録して返す。
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  decodeBuffer,
  parseGeneralLedger,
  parseThreePeriod,
  parseTransition,
  parseTrialBalance,
} from '@/lib/parsers'
import { upsertReport } from '@/lib/firestore/reports-repo'
import { uploadFile } from '@/lib/storage/gcs'
import { runCrossCheck } from '@/lib/validation/cross-check'
import type { MonthlyReport } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const clientId = formData.get('clientId')?.toString()
    const yearStr = formData.get('year')?.toString()
    const monthStr = formData.get('month')?.toString()

    if (!clientId || !yearStr || !monthStr) {
      return NextResponse.json(
        { error: 'clientId, year, month は必須です' },
        { status: 400 },
      )
    }
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)

    const trialBalanceFile = formData.get('trialBalance') as File | null
    const transitionFile = formData.get('transition') as File | null
    const threePeriodFile = formData.get('threePeriod') as File | null
    const generalLedgerFile = formData.get('generalLedger') as File | null

    if (!trialBalanceFile || !transitionFile || !threePeriodFile || !generalLedgerFile) {
      return NextResponse.json(
        { error: '4種類の CSV 全てが必要です' },
        { status: 400 },
      )
    }

    // パース
    const tb = parseTrialBalance(decodeBuffer(Buffer.from(await trialBalanceFile.arrayBuffer())))
    const tr = parseTransition(decodeBuffer(Buffer.from(await transitionFile.arrayBuffer())))
    const tp = parseThreePeriod(decodeBuffer(Buffer.from(await threePeriodFile.arrayBuffer())))
    const gl = parseGeneralLedger(decodeBuffer(Buffer.from(await generalLedgerFile.arrayBuffer())))

    // バリデーション
    const validation = runCrossCheck({
      trialBalance: tb,
      transition: tr,
      threePeriod: tp,
      generalLedger: gl,
      targetYear: year,
      targetMonth: month,
    })

    // GCS へ原本保存（バリデーション通過に関わらず保存）
    const prefix = `clients/${clientId}/reports/${year}_${String(month).padStart(2, '0')}/source`
    const [tbPath, trPath, tpPath, glPath] = await Promise.all([
      saveRaw(trialBalanceFile, `${prefix}/trial-balance.csv`),
      saveRaw(transitionFile, `${prefix}/transition.csv`),
      saveRaw(threePeriodFile, `${prefix}/three-period.csv`),
      saveRaw(generalLedgerFile, `${prefix}/general-ledger.csv`),
    ])

    // Firestore にレポート雛形を保存
    const report: MonthlyReport = {
      id: `${year}_${String(month).padStart(2, '0')}`,
      clientId,
      year,
      month,
      status: 'draft',
      createdAt: new Date(),
      sourceData: {
        uploadedAt: new Date(),
        trialBalanceFile: tbPath,
        transitionFile: trPath,
        threePeriodFile: tpPath,
        generalLedgerFile: glPath,
      },
      sections: [],
      validation,
    }
    await upsertReport(report)

    return NextResponse.json({
      report,
      warnings: [
        ...tb.warnings,
        ...tr.warnings,
        ...tp.warnings,
        ...gl.warnings,
      ],
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

async function saveRaw(file: File, path: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer())
  return uploadFile(path, buf, 'text/csv')
}
