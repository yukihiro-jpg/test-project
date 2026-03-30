import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "相続税シミュレーター",
  description: "相続税シミュレーション・遺産分割協議書作成アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 font-sans">{children}</body>
    </html>
  );
}
