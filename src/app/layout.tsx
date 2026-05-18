import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { YeonunAuthProvider } from "@/components/auth/YeonunAuthProvider";
import { ModalLayer } from "@/components/ModalLayer";
import { ContentCatalogPreloader } from "@/components/content/ContentCatalogPreloader";
import { PrimaryTabScrollClient } from "@/components/PrimaryTabScrollClient";
import { WriteReviewSheetProvider } from "@/components/reviews/WriteReviewSheetProvider";
import { YeonunToastHost } from "@/components/YeonunToastHost";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/feed.xml", title: "연운 RSS" }],
    },
  },
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
  verification: {
    google: "qNTPbhZkfGAfoSrWhFrQS1lM2LVX8601pCRzEd7Bfl4",
    other: {
      "naver-site-verification": "b5e920129914fc09f6789637ca176a3b330252c7",
      "msvalidate.01": "B050911920C2B8D7C10FC427E2B4DCB0",
    },
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
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
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
          <WriteReviewSheetProvider>
            <PrimaryTabScrollClient />
            <ContentCatalogPreloader />
            {children}
            {modal}
            <YeonunToastHost />
          </WriteReviewSheetProvider>
          <Suspense fallback={null}>
            <ModalLayer />
          </Suspense>
        </YeonunAuthProvider>
      </body>
    </html>
  );
}
