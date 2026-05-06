import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SeatSoon",
  description: "混雑したフードコートの席ゆずり情報共有MVP"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
