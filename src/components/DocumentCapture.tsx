'use client'

import { useRef } from 'react'
import type { DocumentType } from '@/lib/document-types'

interface Props {
  docType: DocumentType
  capturedImages: string[]
  onCapture: (docTypeId: string, file: File) => void
  onRemoveAt: (docTypeId: string, index: number) => void
}

export default function DocumentCapture({
  docType,
  capturedImages,
  onCapture,
  onRemoveAt,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onCapture(docType.id, file)
    }
    // 同じファイルを再選択できるようにリセット
    e.target.value = ''
  }

  const hasImages = capturedImages.length > 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-700">{docType.label}</p>
        {hasImages && (
          <span className="text-xs text-gray-500">{capturedImages.length}枚</span>
        )}
      </div>

      {hasImages && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {capturedImages.map((url, i) => (
            <div key={i} className="relative">
              <img
                src={url}
                alt={`${docType.label}${i + 1}`}
                className="w-full h-24 object-cover rounded-md border border-gray-200"
              />
              <button
                type="button"
                onClick={() => onRemoveAt(docType.id, i)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center active:bg-red-600"
                aria-label="削除"
              >
                ×
              </button>
              <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/60 text-white text-xs rounded">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-full py-3 border-2 border-dashed rounded-md text-sm active:border-blue-400 active:text-blue-600 ${
          hasImages
            ? 'border-gray-300 text-gray-600'
            : 'border-gray-300 text-gray-500'
        }`}
      >
        <span className="text-xl mr-1">📷</span>
        {hasImages ? 'もう1枚追加する' : 'タップして撮影'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}
