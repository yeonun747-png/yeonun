import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FortunePage } from "@/components/fortune/FortunePage";
import { getCharactersCached } from "@/lib/data/characters";
import { getProductBySlugCached } from "@/lib/data/content";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ ck?: string; back?: string }>;
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

export default async function FortuneProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const product = await getProductBySlugCached(slug);
  if (!product) notFound();

  const chars = await getCharactersCached();
  const charRow = chars.find((c) => c.key === product.character_key);

  return (
    <FortunePage
      product={product}
      character={charRow ?? null}
      themeKey={typeof sp.ck === "string" ? sp.ck : ""}
      backRaw={typeof sp.back === "string" ? sp.back : undefined}
    />
  );
}
