'use client'

import { DOCUMENT_TYPES } from '@/lib/document-types'
import DocumentCapture from './DocumentCapture'

interface Props {
  capturedImages: Record<string, string>
  onCapture: (docTypeId: string, file: File) => void
  onRemove: (docTypeId: string) => void
}

export default function DocumentList({
  capturedImages,
  onCapture,
  onRemove,
}: Props) {
  const capturedCount = Object.keys(capturedImages).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">書類を撮影</h2>
        <span className="text-sm text-gray-500">
          {capturedCount} / {DOCUMENT_TYPES.length} 撮影済み
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        該当する書類のみ撮影してください。すべて撮影する必要はありません。
      </p>
      <div className="space-y-3">
        {DOCUMENT_TYPES.map((docType) => (
          <DocumentCapture
            key={docType.id}
            docType={docType}
            capturedImage={capturedImages[docType.id] || null}
            onCapture={onCapture}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  )
}
