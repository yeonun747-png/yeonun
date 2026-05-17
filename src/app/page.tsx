export const dynamic = "force-dynamic";

import { BottomNav } from "@/components/BottomNav";
import { CharacterCarousel } from "@/components/CharacterCarousel";
import { FortuneExitScrollRestore } from "@/components/fortune/FortuneExitScrollRestore";
import { HomeHero } from "@/components/HomeHero";
import { HomeMoreSections } from "@/components/HomeMoreSections";
import { TopNav } from "@/components/TopNav";

export default function Home() {
  return (
    <div className="yeonunPage">
      <FortuneExitScrollRestore />
      <TopNav />
      <main>
        <HomeHero />
        <CharacterCarousel />
        <HomeMoreSections />
        <div style={{ height: 80 }} />
      </main>
      <BottomNav />
    </div>
  );
}
