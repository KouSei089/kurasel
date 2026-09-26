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

// アプリ名は「Kurasel」、キャッチコピーは「暮らしと精算」で統一する。
// iPhone のホーム画面に出る名前は appleWebApp.title、Android などは manifest の short_name。
// アイコンは app/icon.png（ファビコン）、app/apple-icon.png（iPhone のホーム画面）、
// public/icon-*.png（manifest）。iPhone は透明部分を黒で塗るので、どれも透明なしの正方形にしている
export const metadata: Metadata = {
  title: "Kurasel | 暮らしと精算",
  description: "レシートを撮るだけ。ふたりの日常と旅行の支出を記録して、かんたんに精算。",
  applicationName: "Kurasel",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kurasel",
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