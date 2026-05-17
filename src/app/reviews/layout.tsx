import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "전체 리뷰 | 연운 緣運",
  description: "연운 사용자 리뷰 — 평균 별점과 실제 이용 리뷰를 확인하세요.",
  openGraph: {
    title: "전체 리뷰 | 연운 緣運",
    description: "연운 사용자 리뷰 — 평균 별점과 실제 이용 리뷰를 확인하세요.",
    locale: "ko_KR",
    type: "website",
  },
};

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
