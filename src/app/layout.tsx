import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "相続税 保険資産分類",
  description: "保険証券PDFから相続税の保険資産区分を自動判定し、評価額を算出するツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
