import { FortuneExitScrollRestore } from "@/components/fortune/FortuneExitScrollRestore";
import { SheetBackdropFrame } from "@/components/my/MySheetBackdropFrame";
import { YeonunRoutedBottomSheetPortal } from "@/components/YeonunRoutedBottomSheetPortal";
import { CharacterDetailExtensions } from "@/components/characters/CharacterDetailExtensions";
import { CharacterDetailShell } from "@/components/characters/CharacterDetailShell";
import type { Character } from "@/lib/data/characters";

export function CharacterSheetRoute({
  c,
  closeHref,
  contentLinkExtra,
}: {
  c: Character;
  closeHref: string;
  contentLinkExtra: string;
}) {
  return (
    <>
      <SheetBackdropFrame />
      <YeonunRoutedBottomSheetPortal backHref={closeHref} ariaLabel={c.name} title={c.name}>
        <main style={{ paddingBottom: 180 }}>
          <FortuneExitScrollRestore />
          <CharacterDetailShell c={c} />
          <CharacterDetailExtensions c={c} contentLinkExtra={contentLinkExtra} />
        </main>
      </YeonunRoutedBottomSheetPortal>
    </>
  );
}
