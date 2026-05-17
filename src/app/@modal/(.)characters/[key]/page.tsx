import { notFound } from "next/navigation";

import { CharacterSheetRoute } from "@/components/characters/CharacterSheetRoute";
import { carouselCharacterAsDb, isCarouselCharKey } from "@/lib/characters/character-carousel-static";
import { characterContentLinkExtra, characterSheetCloseHref } from "@/lib/characters/character-sheet-route";
import { getCharactersCached } from "@/lib/data/characters";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ key: string }>;
  searchParams?: Promise<{ sheet?: string; from?: string }>;
};

/** 홈·만남 소프트 네비 — 데이터 준비 후 시트 1회 슬라이드업 */
export default async function CharacterSheetInterceptPage({ params, searchParams }: Props) {
  const { key } = await params;
  const sp = ((await searchParams?.catch?.(() => ({}))) ?? {}) as { sheet?: string; from?: string };

  const c = isCarouselCharKey(key)
    ? carouselCharacterAsDb(key)
    : (await getCharactersCached()).find((x) => x.key === key);
  if (!c) notFound();

  const closeHref = characterSheetCloseHref(sp.from);
  const contentLinkExtra = characterContentLinkExtra(c, sp.from);

  return <CharacterSheetRoute c={c} closeHref={closeHref} contentLinkExtra={contentLinkExtra} />;
}
