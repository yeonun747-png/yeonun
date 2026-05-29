import { FortuneExitScrollRestore } from "@/components/fortune/FortuneExitScrollRestore";
import { YeonunRoutedBottomSheetPortal } from "@/components/YeonunRoutedBottomSheetPortal";
import { CharacterDetailExtensions } from "@/components/characters/CharacterDetailExtensions";
import { CharacterDetailShell } from "@/components/characters/CharacterDetailShell";
import type { Character } from "@/lib/data/characters";

export function CharacterSheetRoute({
  c,
  closeHref,
  contentLinkExtra,
  dismissWithHistoryBack = false,
}: {
  c: Character;
  closeHref: string;
  contentLinkExtra: string;
  /** @modal 인터셉트(만남/홈) — X/< 시 history.back으로 parallel slot 닫기 */
  dismissWithHistoryBack?: boolean;
}) {
  return (
    <YeonunRoutedBottomSheetPortal
      backHref={closeHref}
      ariaLabel={c.name}
      title={c.name}
      dismissWithHistoryBack={dismissWithHistoryBack}
    >
      <main style={{ paddingBottom: 180 }}>
        <FortuneExitScrollRestore />
        <CharacterDetailShell c={c} />
        <CharacterDetailExtensions c={c} contentLinkExtra={contentLinkExtra} voiceCallFullPage />
      </main>
    </YeonunRoutedBottomSheetPortal>
  );
}
