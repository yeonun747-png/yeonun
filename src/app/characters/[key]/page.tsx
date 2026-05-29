import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BottomNav } from "@/components/BottomNav";
import { CharacterCarousel } from "@/components/CharacterCarousel";
import { CharacterSheetRoute } from "@/components/characters/CharacterSheetRoute";
import { CharacterDetailExtensions } from "@/components/characters/CharacterDetailExtensions";
import { CharacterDetailShell } from "@/components/characters/CharacterDetailShell";
import { FortuneExitScrollRestore } from "@/components/fortune/FortuneExitScrollRestore";
import { HomeHero } from "@/components/HomeHero";
import { HomeMoreSections } from "@/components/HomeMoreSections";
import { MeetPageClient } from "@/components/meet/MeetPageClient";
import { TopNav } from "@/components/TopNav";
import { buildCatalogSnapshot } from "@/lib/content-catalog";
import { characterContentLinkExtra, characterSheetCloseHref } from "@/lib/characters/character-sheet-route";
import { getCharactersCached } from "@/lib/data/characters";
import { getContentCatalogBundleCached } from "@/lib/data/content";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ key: string }>;
  searchParams?: Promise<{ sheet?: string; from?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const characters = await getCharactersCached();
  const c = characters.find((x) => x.key === key);
  if (!c) return { title: "인연 안내자" };
  return {
    title: `${c.name} | 연운 緣運`,
    description: c.greeting,
    openGraph: {
      title: `${c.name} | 연운 緣運`,
      description: c.greeting,
      type: "profile",
      locale: "ko_KR",
    },
  };
}

export default async function CharacterPage({ params, searchParams }: Props) {
  const { key } = await params;
  const characters = await getCharactersCached();
  const c = characters.find((x) => x.key === key);
  if (!c) notFound();

  const sp = ((await searchParams?.catch?.(() => ({}))) ?? {}) as {
    sheet?: string;
    from?: string;
    /** 점사 복귀 등 — 본문에 시트 1개만(fc 있으면 인터셉트 아님) */
    fc?: string;
  };
  const asSheet = sp.sheet === "1";
  const closeHref = characterSheetCloseHref(sp.from);
  const contentLinkExtra = characterContentLinkExtra(c, sp.from);
  const sheetInPageBody = Boolean(sp.fc?.trim());

  // 만남/홈 인터셉트: @modal에만 시트 — 본문에 CharacterSheetRoute 중복 렌더 방지
  if (asSheet && !sheetInPageBody && (sp.from === "meet" || sp.from === "home")) {
    if (sp.from === "meet") {
      return <MeetPageClient characters={characters} />;
    }
    const { categories, products, thumbFallback } = await getContentCatalogBundleCached();
    const catalog = buildCatalogSnapshot({ categories, products, thumbFallback });
    return (
      <div className="yeonunPage">
        <FortuneExitScrollRestore />
        <TopNav />
        <main>
          <HomeHero />
          <CharacterCarousel />
          <HomeMoreSections serverCatalog={catalog} />
          <div style={{ height: 80 }} />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (asSheet) {
    return <CharacterSheetRoute c={c} closeHref={closeHref} contentLinkExtra={contentLinkExtra} />;
  }

  return (
    <div className="yeonunPage">
      <TopNav />
      <main style={{ paddingBottom: 180 }}>
        <FortuneExitScrollRestore />
        <CharacterDetailShell c={c} />
        <CharacterDetailExtensions c={c} contentLinkExtra={contentLinkExtra} />
      </main>
    </div>
  );
}
