'use client'

import { useRef } from 'react'
import type { DocumentType } from '@/lib/document-types'

interface Props {
  docType: DocumentType
  capturedImage: string | null
  onCapture: (docTypeId: string, file: File) => void
  onRemove: (docTypeId: string) => void
}

export default function DocumentCapture({
  docType,
  capturedImage,
  onCapture,
  onRemove,
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-700 mb-3">{docType.label}</p>

      {capturedImage ? (
        <div className="relative">
          <img
            src={capturedImage}
            alt={docType.label}
            className="w-full h-40 object-cover rounded-md"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex-1 py-2 px-3 text-sm bg-gray-100 text-gray-700 rounded-md active:bg-gray-200"
            >
              撮り直す
            </button>
            <button
              type="button"
              onClick={() => onRemove(docType.id)}
              className="py-2 px-3 text-sm bg-red-50 text-red-600 rounded-md active:bg-red-100"
            >
              削除
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-6 border-2 border-dashed border-gray-300 rounded-md text-gray-500 active:border-blue-400 active:text-blue-600"
        >
          <span className="block text-2xl mb-1">📷</span>
          <span className="text-sm">タップして撮影</span>
        </button>
      )}

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
