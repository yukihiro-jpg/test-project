import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "相続財産シミュレーション",
  description: "相続税申告の初期試算・財産整理・分割案比較・概算納税額確認",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/cases" className="text-lg font-bold text-gray-800">
              相続財産シミュレーション
            </a>
            <nav className="text-sm text-gray-500">
              税理士事務所向け業務アプリ
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
