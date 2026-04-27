import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { ModalLayer } from "@/components/ModalLayer";

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
        {children}
        <Suspense fallback={null}>
          <ModalLayer />
        </Suspense>
      </body>
    </html>
  );
}
