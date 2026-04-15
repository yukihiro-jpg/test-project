/**
 * e-Stat から法人企業統計調査データを取得して Firestore に取り込む
 *
 * 使い方:
 *   npm run estat:import -- --year 2024
 *
 * 前提:
 *   - ESTAT_APP_ID が設定されていること
 *   - GCP_PROJECT_ID が設定されていること
 *
 * 注意:
 *   e-Stat の統計表IDや列番号は統計表ごとに異なるため、
 *   実装時に使用する統計表の仕様書を確認して列対応を調整すること。
 */

import { getStatsData } from '../src/lib/benchmark/estat-client'
import { saveBenchmark } from '../src/lib/benchmark/repository'
import type { BenchmarkData, CapitalScale } from '../src/lib/types'

const DEFAULT_STATS_DATA_ID = '0003060791' // 法人企業統計調査（要確認）

interface Args {
  year: number
  statsDataId: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    year: new Date().getFullYear() - 1,
    statsDataId: DEFAULT_STATS_DATA_ID,
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--year' && argv[i + 1]) args.year = parseInt(argv[++i], 10)
    if (argv[i] === '--stats-id' && argv[i + 1]) args.statsDataId = argv[++i]
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  console.log(`取得年度: ${args.year}`)
  console.log(`統計表ID: ${args.statsDataId}`)

  const data = await getStatsData(args.statsDataId, { cdTime: `${args.year}`})

  // レスポンス構造は e-Stat の統計表に依存するため、実運用時に変換ロジックを整備
  // ここではサンプルとしてダミーデータを投入する
  const industries = ['83', '85'] // 中分類コード例（社会保険・社会福祉・介護事業等）
  const capitalScales: CapitalScale[] = [
    'less_than_10m',
    '10m_to_50m',
    '50m_to_100m',
  ]

  for (const industry of industries) {
    for (const scale of capitalScales) {
      const benchmark: BenchmarkData = {
        id: `${industry}_${scale}`,
        fiscalYear: args.year,
        industryCode: industry,
        capitalScale: scale,
        indicator: 'operating_margin',
        value: 0, // TODO: 実データから抽出
        source: '法人企業統計調査',
        sourceUrl: 'https://www.e-stat.go.jp/stat-search/files?tclass=000001152094',
      }
      await saveBenchmark(benchmark)
      console.log(`保存: ${industry} / ${scale}`)
    }
  }

  console.log('完了')
  console.log(
    '※ 実データの指標値抽出ロジックは e-Stat レスポンス形式に合わせて実装してください',
  )
  console.log(`レスポンスのサンプル:`, JSON.stringify(data).slice(0, 300))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
