/**
 * 月次レポート（MonthlyReport）リポジトリ
 *
 * レポートはクライアント配下のサブコレクションとして保存する：
 *   clients/{clientId}/reports/{year}_{month}
 */

import type { Comment, MonthlyReport, ReportSection } from '../types'
import { getFirestore } from './client'

function reportsCol(clientId: string): FirebaseFirestore.CollectionReference {
  return getFirestore().collection('clients').doc(clientId).collection('reports')
}

function reportId(year: number, month: number): string {
  return `${year}_${String(month).padStart(2, '0')}`
}

export async function listReports(clientId: string): Promise<MonthlyReport[]> {
  const snap = await reportsCol(clientId).orderBy('year', 'desc').orderBy('month', 'desc').get()
  return snap.docs.map((d) => d.data() as MonthlyReport)
}

export async function getReport(
  clientId: string,
  year: number,
  month: number,
): Promise<MonthlyReport | null> {
  const doc = await reportsCol(clientId).doc(reportId(year, month)).get()
  return doc.exists ? (doc.data() as MonthlyReport) : null
}

export async function upsertReport(report: MonthlyReport): Promise<void> {
  await reportsCol(report.clientId).doc(reportId(report.year, report.month)).set(report)
}

export async function updateReportStatus(
  clientId: string,
  year: number,
  month: number,
  status: MonthlyReport['status'],
): Promise<void> {
  const patch: Partial<MonthlyReport> = { status }
  if (status === 'finalized') patch.finalizedAt = new Date()
  if (status === 'sent') patch.sentAt = new Date()
  await reportsCol(clientId).doc(reportId(year, month)).update(patch)
}

// ---------------------------------------------------------------------------
// セクション
// ---------------------------------------------------------------------------

export async function saveSection(
  clientId: string,
  reportDocId: string,
  section: ReportSection,
): Promise<void> {
  await reportsCol(clientId)
    .doc(reportDocId)
    .collection('sections')
    .doc(section.type)
    .set(section)
}

export async function listSections(
  clientId: string,
  reportDocId: string,
): Promise<ReportSection[]> {
  const snap = await reportsCol(clientId)
    .doc(reportDocId)
    .collection('sections')
    .orderBy('pageNumber')
    .get()
  return snap.docs.map((d) => d.data() as ReportSection)
}

// ---------------------------------------------------------------------------
// コメント
// ---------------------------------------------------------------------------

export async function listComments(
  clientId: string,
  reportDocId: string,
): Promise<Comment[]> {
  const snap = await reportsCol(clientId)
    .doc(reportDocId)
    .collection('comments')
    .orderBy('pageNumber')
    .orderBy('createdAt')
    .get()
  return snap.docs.map((d) => d.data() as Comment)
}

export async function createComment(
  clientId: string,
  reportDocId: string,
  comment: Omit<Comment, 'id'>,
): Promise<Comment> {
  const ref = reportsCol(clientId).doc(reportDocId).collection('comments').doc()
  const full: Comment = { ...comment, id: ref.id }
  await ref.set(full)
  return full
}

export async function updateComment(
  clientId: string,
  reportDocId: string,
  commentId: string,
  patch: Partial<Comment>,
): Promise<void> {
  await reportsCol(clientId)
    .doc(reportDocId)
    .collection('comments')
    .doc(commentId)
    .update({ ...patch, updatedAt: new Date() })
}

/**
 * 前月のオープン宿題コメントを取得して引継ぎ候補として返す
 */
export async function getPreviousMonthOpenComments(
  clientId: string,
  year: number,
  month: number,
): Promise<Comment[]> {
  // 前月の年月を計算
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevReportId = reportId(prevYear, prevMonth)

  const snap = await reportsCol(clientId)
    .doc(prevReportId)
    .collection('comments')
    .where('status', '==', 'open')
    .where('tags', 'array-contains', 'next_month')
    .get()

  return snap.docs.map((d) => d.data() as Comment)
}
