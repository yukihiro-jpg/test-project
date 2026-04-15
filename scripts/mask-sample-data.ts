/**
 * サンプルCSVの実データをマスキングして開発用テストデータを生成する
 *
 * 使い方:
 *   npm run mask:sample -- --input samples/original --output samples/masked
 *
 * 機能:
 * - 取引先名、個人名、地名を架空のものに置換
 * - 金額はランダムに ±20% 変動させる（構造は保ったまま）
 * - 科目コード・勘定科目名は変更しない
 */

import * as fs from 'fs'
import * as path from 'path'

interface Args {
  input: string
  output: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = { input: 'samples/original', output: 'samples/masked' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) args.input = argv[++i]
    if (argv[i] === '--output' && argv[i + 1]) args.output = argv[++i]
  }
  return args
}

// 置換マッピング（固有名詞 → ダミー）
const NAME_MAPPINGS: [RegExp, string][] = [
  // 会社名・取引先
  [/高橋商事株式会社?/g, 'ダミー商事株式会社'],
  [/株式会社?ウェルファン/g, '株式会社サンプル物販'],
  [/セントラルメディカル株式会社?/g, 'ダミー医療資材株式会社'],
  [/株式会社?アンビション/g, '株式会社テスト商会'],
  [/株式会社?電算システム/g, '株式会社テストシステム'],
  [/茨城県国保連合会?/g, 'テスト県国保連合会'],
  [/水戸市高齢福祉課?/g, 'テスト市高齢福祉課'],
  [/茨城県長寿福祉課?/g, 'テスト県長寿福祉課'],
  [/筑波銀行/g, 'テスト銀行'],
  [/水戸信用金庫/g, 'テスト信用金庫'],
  [/常陽銀行/g, 'サンプル銀行'],
  [/日下部税理士事務所/g, 'サンプル税理士事務所'],
  [/大泉社労士/g, 'サンプル社労士'],
  [/明治安田生命/g, 'テスト生命保険'],
  [/第一生命保険/g, 'テスト生命2'],
  [/三井住友海上保険/g, 'テスト損害保険'],
  [/福祉医療機構/g, 'テスト医療機構'],
  [/出光クレジット/g, 'テストクレジット'],
  [/オリックス株式会社?/g, 'テストリース株式会社'],
  [/三井住友(FL|オートリース|リース)/g, 'テストリース$1'],
  [/リコーリース/g, 'テストリース2'],
  [/エースオートリース/g, 'テストオートリース'],
  [/ジャックス/g, 'テストカード'],
  [/アプラス/g, 'テストローン'],
  [/セゾンリース/g, 'テストリース3'],
  // 個人名
  [/鈴木京子/g, 'サンプル太郎'],
  [/塚本訓章/g, 'テスト花子'],
  [/上村芳子/g, 'ダミー三郎'],
  [/田川/g, 'サンプル'],
  [/久保田/g, 'テスト'],
  [/大高/g, 'ダミー'],
  [/菱沼/g, 'サンプル子'],
  [/大月/g, 'テスト男'],
  [/須藤/g, 'ダミー夫'],
  // 事業所名
  [/一期一笑/g, 'テスト事業所A'],
  [/笑がお/g, 'テスト事業所B'],
  [/一笑カフェ/g, 'テスト事業所C'],
  [/リハビリデイサービス/g, 'デイサービス事業所'],
  // 地名
  [/水戸市(?!高齢福祉|税務署)/g, 'テスト市'],
  [/笠間市/g, 'サンプル市'],
  [/茨城県?/g, 'テスト県'],
]

function maskText(text: string): string {
  let result = text
  for (const [pattern, replacement] of NAME_MAPPINGS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

function maskAmount(amountStr: string): string {
  // カンマ・マイナスを保持してランダム変動（±20%）
  const trimmed = amountStr.trim()
  if (!trimmed) return amountStr
  const num = Number(trimmed.replace(/,/g, ''))
  if (isNaN(num) || num === 0) return amountStr
  const variance = 0.8 + Math.random() * 0.4 // 0.8 〜 1.2
  const masked = Math.round(num * variance)
  return String(masked)
}

function maskCsvLine(line: string, amountColumnIndexes: number[]): string {
  const cols = line.split(',')
  // テキスト列をマスキング
  for (let i = 0; i < cols.length; i++) {
    if (!amountColumnIndexes.includes(i)) {
      cols[i] = maskText(cols[i])
    } else {
      cols[i] = maskAmount(cols[i])
    }
  }
  return cols.join(',')
}

function processFile(inputPath: string, outputPath: string): void {
  const content = fs.readFileSync(inputPath, 'utf-8')
  const lines = content.split(/\r?\n/)

  // 金額列を推定（ヘッダに「金額」「借方」「貸方」「残高」を含む列）
  const header = lines[0].split(',')
  const amountCols = header
    .map((h, idx) => ({ h, idx }))
    .filter(({ h }) => /金額|借方|貸方|残高/.test(h))
    .map(({ idx }) => idx)

  const maskedLines = lines.map((line, idx) => {
    if (idx === 0) return line // ヘッダはそのまま
    return maskCsvLine(line, amountCols)
  })

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, maskedLines.join('\n'), 'utf-8')
  console.log(`  ✓ ${path.basename(inputPath)} → ${outputPath}`)
}

function main(): void {
  const { input, output } = parseArgs(process.argv.slice(2))

  if (!fs.existsSync(input)) {
    console.error(`Error: 入力ディレクトリが見つかりません: ${input}`)
    process.exit(1)
  }

  const files = fs.readdirSync(input).filter((f) => f.endsWith('.csv'))
  console.log(`マスキング対象: ${files.length} ファイル`)
  console.log(`入力: ${input}`)
  console.log(`出力: ${output}`)
  console.log('---')

  for (const file of files) {
    processFile(path.join(input, file), path.join(output, file))
  }

  console.log('---')
  console.log('完了しました。マスキング済みデータは開発中のテストのみに使用してください。')
}

main()
