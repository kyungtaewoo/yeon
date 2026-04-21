import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "緣 (연) — 사주궁합 매칭",
  description: "사주명리학 기반 역방향 매칭 소개팅 플랫폼",
  applicationName: "緣",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "緣",
  },
  icons: {
    icon: "/icon-192x192.svg",
    apple: "/icon-192x192.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#8b2f3a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --font-sans: 'Noto Sans KR', sans-serif;
            --font-serif: 'Noto Serif KR', serif;
          }
        `}} />
      </head>
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-sans)" }}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
