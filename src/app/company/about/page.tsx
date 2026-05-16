import { AboutPageClient } from "@/components/about/AboutPageClient";

export const metadata = {
  title: "연운 소개 | 연운 緣運",
  description:
    "천 년의 명리학과 4명의 인연 안내자. 연운 서비스 철학, 기술, 캐릭터, 운영사 정보를 안내합니다.",
  openGraph: {
    title: "연운 소개 | 연운 緣運",
    description:
      "천 년의 명리학과 4명의 인연 안내자. 카드 등록 없이, 필요한 만큼만 운명을 듣는 곳.",
    locale: "ko_KR",
    type: "website",
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}
