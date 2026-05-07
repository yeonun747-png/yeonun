import { BottomNav } from "@/components/BottomNav";
import { CharacterCarousel } from "@/components/CharacterCarousel";
import { HomeHero } from "@/components/HomeHero";
import { HomeMoreSections } from "@/components/HomeMoreSections";
import { TopNav } from "@/components/TopNav";
import { MascotPreloadClient } from "@/components/mascot/MascotPreloadClient";

export default function Home() {
  return (
    <div className="yeonunPage">
      <MascotPreloadClient />
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
