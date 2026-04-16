import { useState } from 'react'

interface Props {
  onExport: () => Promise<string | null>
  label?: string
}

export default function ExportButton({ onExport, label = '今月分をダウンロード' }: Props) {
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    setResult(null)
    try {
      const filePath = await onExport()
      if (filePath) {
        setResult(`保存しました: ${filePath}`)
        setTimeout(() => setResult(null), 5000)
      }
    } catch {
      setResult('エラーが発生しました')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 transition-colors"
      >
        <span>📥</span>
        {exporting ? '出力中...' : label}
      </button>
      {result && (
        <p className="text-xs text-green-600 mt-1">{result}</p>
      )}
    </div>
  )
}
