'use client'

interface Props {
  disabled: boolean
  loading: boolean
  capturedCount: number
  onClick: () => void
}

export default function SubmitButton({
  disabled,
  loading,
  capturedCount,
  onClick,
}: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 p-4 z-40"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-lg mx-auto">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className={`w-full py-4 rounded-lg text-lg font-bold transition-colors ${
            disabled || loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white active:bg-blue-700'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              送信中...
            </span>
          ) : capturedCount > 0 ? (
            `送信する（${capturedCount}枚）`
          ) : (
            '送信する（書類なし）'
          )}
        </button>
      </div>
    </div>
  )
}
