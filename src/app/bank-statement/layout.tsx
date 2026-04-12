import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '会計大将インポートデータ変換 - 会計大将インポート',
  description: '通帳PDF/Excelデータから会計大将へインポート可能なCSVファイルを作成します',
}

export default function BankStatementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
