import { NextRequest, NextResponse } from 'next/server'
import { getClient, getClientDetail, downloadClientFile } from '@/lib/drive-report'
import { parseFinancialFile } from '@/lib/excel-parser'
import { generateReportHtml } from '@/lib/report-html'
import type { ReportData, FiscalYearData } from '@/types/report'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { reportMonth, reportYear, yearLabels } = body
    // yearLabels: 使用する期ラベルの配列 例: ["R5", "R6", "R7"]
    // 指定がなければ全アップロード済みファイルを使用

    if (!reportMonth || !reportYear) {
      return NextResponse.json({ error: 'reportMonth and reportYear are required' }, { status: 400 })
    }

    const client = await getClient(params.id)
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const detail = await getClientDetail(params.id)
    if (!detail) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    let filesToUse = detail.files
    if (yearLabels && Array.isArray(yearLabels) && yearLabels.length > 0) {
      filesToUse = detail.files.filter(f => yearLabels.includes(f.yearLabel))
    }

    if (filesToUse.length === 0) {
      return NextResponse.json({ error: 'No files available. Please upload financial data files first.' }, { status: 400 })
    }

    // ファイルをダウンロードしてパース
    const fiscalYears: FiscalYearData[] = []
    for (const uploadedFile of filesToUse.sort((a, b) => a.yearLabel.localeCompare(b.yearLabel))) {
      const buffer = await downloadClientFile(uploadedFile.fileId)
      const parsed = parseFinancialFile(buffer, uploadedFile.fileName)
      parsed.label = uploadedFile.yearLabel
      fiscalYears.push(parsed)
    }

    const reportData: ReportData = {
      client,
      reportMonth: Number(reportMonth),
      reportYear: String(reportYear),
      fiscalYears,
      generatedAt: new Date().toISOString(),
    }

    const html = generateReportHtml(reportData)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="report_${reportYear}_${reportMonth}.html"`,
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
