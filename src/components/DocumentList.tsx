'use client'

import { DOCUMENT_TYPES } from '@/lib/document-types'
import DocumentCapture from './DocumentCapture'

interface Props {
  capturedImages: Record<string, string[]>
  onCapture: (docTypeId: string, file: File) => void
  onRemoveAt: (docTypeId: string, index: number) => void
}

export default function DocumentList({
  capturedImages,
  onCapture,
  onRemoveAt,
}: Props) {
  const totalImages = Object.values(capturedImages).reduce(
    (sum, arr) => sum + arr.length,
    0,
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">書類を撮影</h2>
        <span className="text-sm text-gray-500">合計 {totalImages}枚</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        該当する書類のみ撮影してください。複数枚ある場合は同じ書類で続けて撮影できます。該当する書類が一切ない場合は撮影せずそのまま送信してください。
      </p>
      <div className="space-y-3">
        {DOCUMENT_TYPES.map((docType) => (
          <DocumentCapture
            key={docType.id}
            docType={docType}
            capturedImages={capturedImages[docType.id] || []}
            onCapture={onCapture}
            onRemoveAt={onRemoveAt}
          />
        ))}
      </div>
    </div>
  )
}
