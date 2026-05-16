import type { Metadata } from "next";

import { FortuneProductClient } from "@/components/fortune/FortuneProductClient";
import { getProductBySlugCached } from "@/lib/data/content";

type Props = {
  params: Promise<{ slug: string }>;
  /** `mc=1`: 추천 풀이 메뉴 카드에서 진입 — 마스코트 표시 */
  searchParams?: Promise<{ ck?: string; back?: string; mc?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlugCached(slug);
  if (!product) return { title: "연운 緣運" };
  const desc = product.quote?.trim().slice(0, 155) || "천 년의 명리학과 인연 안내자.";
  return {
    title: `${product.title} · 무료 체험 · 연운`,
    description: desc,
    openGraph: {
      title: `${product.title} · 연운`,
      description: desc,
      locale: "ko_KR",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

/** 서버 대기 없이 클라이언트 캐시·API로 즉시 진입 */
export default async function FortuneProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};

  return (
    <FortuneProductClient
      slug={slug}
      themeKey={typeof sp.ck === "string" ? sp.ck : ""}
      backRaw={typeof sp.back === "string" ? sp.back : undefined}
      menuCardEntry={sp.mc === "1"}
    />
  );
}
