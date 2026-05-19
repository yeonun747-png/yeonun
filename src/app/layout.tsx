import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { YeonunAuthProvider } from "@/components/auth/YeonunAuthProvider";
import { ModalLayer } from "@/components/ModalLayer";
import { ContentCatalogPreloader } from "@/components/content/ContentCatalogPreloader";
import { PrimaryTabScrollClient } from "@/components/PrimaryTabScrollClient";
import { ArchiveReviewProvider } from "@/components/reviews/ArchiveReviewProvider";
import { WriteReviewSheetProvider } from "@/components/reviews/WriteReviewSheetProvider";
import { YeonunToastHost } from "@/components/YeonunToastHost";
import { getSiteUrl } from "@/lib/site-url";

const SITE_TITLE = "연운 緣運 — 운명을, 듣다";
const SITE_DESCRIPTION =
  "천 년의 명리학과 4명의 인연 안내자. 한 번의 부름이면 운명이 답합니다.";
const OG_IMAGE_PATH = "/og/yeonun_opengraph.png";
const APP_ICON_PATH = "/logo/yeonun_app_icon_c_1024.svg";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/feed.xml", title: "연운 RSS" }],
    },
  },
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: [{ url: APP_ICON_PATH, type: "image/svg+xml" }],
    apple: [{ url: APP_ICON_PATH, type: "image/svg+xml" }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1730,
        height: 909,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
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
          <ArchiveReviewProvider>
            <WriteReviewSheetProvider>
              <PrimaryTabScrollClient />
              <ContentCatalogPreloader />
              {children}
              {modal}
              <YeonunToastHost />
            </WriteReviewSheetProvider>
          </ArchiveReviewProvider>
          <Suspense fallback={null}>
            <ModalLayer />
          </Suspense>
        </YeonunAuthProvider>
      </body>
    </html>
  );
}
