import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

const mPlusRounded1c = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-m-plus-rounded-1c",
});

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Scan.io | スマート家計簿",
  description: "レシートスキャンで割り勘を自動化するWebアプリ",
  manifest: "/manifest.json", 
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scan.io",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={mPlusRounded1c.className}>{children}</body>
    </html>
  );
}