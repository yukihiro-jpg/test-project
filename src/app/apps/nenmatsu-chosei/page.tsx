import Link from 'next/link'

export default function NenmatsuChoseiLanding() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          年末調整書類アップロード
        </h1>
        <p className="text-gray-600 mb-6">
          QRコードまたは専用URLからアクセスしてください。
        </p>
        <p className="text-sm text-gray-400">
          管理者の方は <Link href="/admin" className="text-blue-600 underline">/admin</Link> へ
        </p>
        <p className="mt-10 text-sm">
          <Link href="/" className="text-blue-600 underline">グループウェアに戻る</Link>
        </p>
      </div>
    </main>
  )
}
