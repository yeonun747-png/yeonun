import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FortuneProductClient } from "@/components/fortune/FortuneProductClient";
import { getCharactersCached } from "@/lib/data/characters";
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

/** 서버에서 상품·캐릭터 스냅샷을 내려 SSR과 하이드레이션 일치(시트→점사 하드 내비 포함) */
export default async function FortuneProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};

  const product = await getProductBySlugCached(slug);
  if (!product) notFound();
  const characters = await getCharactersCached();
  const character = characters.find((c) => c.key === product.character_key) ?? null;

  return (
    <FortuneProductClient
      slug={slug}
      themeKey={typeof sp.ck === "string" ? sp.ck : ""}
      backRaw={typeof sp.back === "string" ? sp.back : undefined}
      menuCardEntry={sp.mc === "1"}
      initialBundle={{
        v: 1,
        slug,
        product,
        character,
        fetchedAt: 0,
      }}
    />
  );
}
