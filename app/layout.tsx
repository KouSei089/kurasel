import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

const mPlusRounded1c = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-m-plus-rounded-1c",
});

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // ノッチ・ホームバーのある iPhone で画面いっぱいに描き、
  // 余白は env(safe-area-inset-*) で自前で取る（PageShell と下のタブ）
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Kurasel | 生活と精算",
  description: "レシートを撮るだけ。AIが解析して、生活費をスマートに精算。",
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