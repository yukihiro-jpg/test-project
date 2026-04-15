/**
 * ベンチマークデータ（業界平均）の Firestore リポジトリ
 *
 * コレクション構造:
 *   benchmark/{fiscalYear}/indicators/{industryCode}_{capitalScale}
 */

import type { BenchmarkData, CapitalScale } from '../types'
import { getFirestore } from '../firestore/client'

function benchmarkDocPath(
  fiscalYear: number,
  industryCode: string,
  capitalScale: CapitalScale,
): string[] {
  return ['benchmark', String(fiscalYear), 'indicators', `${industryCode}_${capitalScale}`]
}

export async function saveBenchmark(data: BenchmarkData): Promise<void> {
  const [col, docId, subcol, subdoc] = benchmarkDocPath(
    data.fiscalYear,
    data.industryCode,
    data.capitalScale,
  )
  await getFirestore()
    .collection(col)
    .doc(docId)
    .collection(subcol)
    .doc(subdoc)
    .set(data, { merge: true })
}

export async function getBenchmark(
  fiscalYear: number,
  industryCode: string,
  capitalScale: CapitalScale,
): Promise<BenchmarkData | null> {
  const [col, docId, subcol, subdoc] = benchmarkDocPath(fiscalYear, industryCode, capitalScale)
  const doc = await getFirestore()
    .collection(col)
    .doc(docId)
    .collection(subcol)
    .doc(subdoc)
    .get()
  return doc.exists ? (doc.data() as BenchmarkData) : null
}

/**
 * 最新年度のベンチマークを取得（年度指定なし）
 */
export async function getLatestBenchmark(
  industryCode: string,
  capitalScale: CapitalScale,
): Promise<BenchmarkData | null> {
  const col = await getFirestore().collection('benchmark').orderBy('__name__', 'desc').get()
  for (const yearDoc of col.docs) {
    const data = await getBenchmark(
      parseInt(yearDoc.id, 10),
      industryCode,
      capitalScale,
    )
    if (data) return data
  }
  return null
}
