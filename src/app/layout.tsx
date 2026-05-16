import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { YeonunAuthProvider } from "@/components/auth/YeonunAuthProvider";
import { ModalLayer } from "@/components/ModalLayer";
import { ContentCatalogPreloader } from "@/components/content/ContentCatalogPreloader";
import { PrimaryTabScrollClient } from "@/components/PrimaryTabScrollClient";
import { YeonunToastHost } from "@/components/YeonunToastHost";

export const metadata: Metadata = {
  title: "연운 緣運 — 운명을, 듣다",
  description:
    "천 년의 명리학과 4명의 인연 안내자. 한 번의 부름이면 운명이 답합니다.",
  openGraph: {
    title: "연운 緣運 — 운명을, 듣다",
    description:
      "천 년의 명리학과 4명의 인연 안내자. 한 번의 부름이면 운명이 답합니다.",
    locale: "ko_KR",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f1eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <YeonunAuthProvider>
          <PrimaryTabScrollClient />
          <ContentCatalogPreloader />
          {children}
          <YeonunToastHost />
          <Suspense fallback={null}>
            <ModalLayer />
          </Suspense>
        </YeonunAuthProvider>
      </body>
    </html>
  );
}
