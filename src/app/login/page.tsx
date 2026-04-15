/**
 * ログイン画面
 *
 * Google ログインボタンを表示。クリックで OAuth フローを開始する。
 */

export default function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string; error?: string }
}) {
  const from = searchParams.from || '/'
  const loginUrl = `/api/auth/login?from=${encodeURIComponent(from)}`

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">月次財務報告アプリ</h1>
        <p className="text-sm text-gray-600 mb-6">
          Google アカウントでログインしてください。
        </p>

        {searchParams.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
            {searchParams.error === 'not_allowed'
              ? 'このメールアドレスはアプリへのアクセスが許可されていません。'
              : 'ログインに失敗しました。もう一度お試しください。'}
          </div>
        )}

        <a
          href={loginUrl}
          className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded transition"
        >
          Google でログイン
        </a>
      </div>
    </main>
  )
}
