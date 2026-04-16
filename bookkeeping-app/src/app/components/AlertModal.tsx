interface Props {
  title: string
  messages: string[]
  type: 'warning' | 'info'
  onClose: () => void
}

export default function AlertModal({ title, messages, type, onClose }: Props) {
  const bgColor = type === 'warning' ? 'bg-yellow-50' : 'bg-blue-50'
  const borderColor = type === 'warning' ? 'border-yellow-300' : 'border-blue-300'
  const iconColor = type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
  const icon = type === 'warning' ? '!' : 'i'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className={`${bgColor} border ${borderColor} rounded-xl p-6 max-w-md w-full mx-4 shadow-lg`}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full ${type === 'warning' ? 'bg-yellow-200' : 'bg-blue-200'} flex items-center justify-center flex-shrink-0`}>
            <span className={`font-bold text-sm ${iconColor}`}>{icon}</span>
          </div>
          <h3 className="font-bold text-gray-800">{title}</h3>
        </div>
        <ul className="space-y-2 mb-6 ml-11">
          {messages.map((msg, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">-</span>
              <span>{msg}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-medium"
          >
            確認しました
          </button>
        </div>
      </div>
    </div>
  )
}
