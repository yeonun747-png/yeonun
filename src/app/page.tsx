import { BottomNav } from "@/components/BottomNav";
import { CharacterCarousel } from "@/components/CharacterCarousel";
import { FortuneExitScrollRestore } from "@/components/fortune/FortuneExitScrollRestore";
import { HomeHero } from "@/components/HomeHero";
import { HomeMoreSections } from "@/components/HomeMoreSections";
import { TopNav } from "@/components/TopNav";
import { buildCatalogSnapshot } from "@/lib/content-catalog";
import { getContentCatalogBundleCached } from "@/lib/data/content";

/** 홈 — 짧은 ISR로 탭 전환·리뷰 블록 부담 완화 */
export const revalidate = 60;

export default async function Home() {
  // 카탈로그를 서버에서 내려 SSR HTML에 카드 포함(SEO) + 하이드레이션 불일치 제거
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
