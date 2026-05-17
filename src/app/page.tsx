import { Suspense } from "react";

import { BottomNav } from "@/components/BottomNav";
import { CharacterCarousel } from "@/components/CharacterCarousel";
import { FortuneExitScrollRestore } from "@/components/fortune/FortuneExitScrollRestore";
import { HomeHero } from "@/components/HomeHero";
import { HomeMoreSections } from "@/components/HomeMoreSections";
import { HomeMoreSectionsSkeleton } from "@/components/HomeMoreSectionsSkeleton";
import { TopNav } from "@/components/TopNav";

/** 홈 — 짧은 ISR로 탭 전환·리뷰 블록 부담 완화 */
export const revalidate = 60;

export default function Home() {
  return (
    <div className="yeonunPage">
      <FortuneExitScrollRestore />
      <TopNav />
      <main>
        <HomeHero />
        <CharacterCarousel />
        <Suspense fallback={<HomeMoreSectionsSkeleton />}>
          <HomeMoreSections />
        </Suspense>
        <div style={{ height: 80 }} />
      </main>
      <BottomNav />
    </div>
  );
}
