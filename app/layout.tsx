import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "daily study",
  description: "AIが毎日出題し添削する学習サイト",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
