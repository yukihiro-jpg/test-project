export default function CompletePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">&#10004;&#65039;</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          送信が完了しました
        </h1>
        <p className="text-gray-600 mb-2">
          書類のアップロードが正常に完了しました。
        </p>
        <p className="text-gray-600">
          ご協力ありがとうございます。
        </p>
        <p className="text-sm text-gray-400 mt-8">
          このページを閉じてください。
        </p>
      </div>
    </main>
  )
}
