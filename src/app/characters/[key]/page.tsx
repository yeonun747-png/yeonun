import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CharacterSheetRoute } from "@/components/characters/CharacterSheetRoute";
import { CharacterDetailExtensions } from "@/components/characters/CharacterDetailExtensions";
import { CharacterDetailShell } from "@/components/characters/CharacterDetailShell";
import { FortuneExitScrollRestore } from "@/components/fortune/FortuneExitScrollRestore";
import { TopNav } from "@/components/TopNav";
import { getCharactersCached } from "@/lib/data/characters";
import { characterContentLinkExtra, characterSheetCloseHref } from "@/lib/characters/character-sheet-route";

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

  const sp = ((await searchParams?.catch?.(() => ({}))) ?? {}) as { sheet?: string; from?: string };
  const asSheet = sp.sheet === "1";
  const closeHref = characterSheetCloseHref(sp.from);
  const contentLinkExtra = characterContentLinkExtra(c, sp.from);

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
