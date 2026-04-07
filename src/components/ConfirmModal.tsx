'use client'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{message}</p>
        </div>
        <div className="p-4 border-t border-gray-200 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg active:bg-gray-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 bg-blue-600 text-white text-sm font-bold rounded-lg active:bg-blue-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
