import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { LibraryFortuneDetailPopBack } from "@/components/library/LibraryFortuneDetailPopBack";
import { LibraryFortuneReplay } from "@/components/library/LibraryFortuneReplay";
import { getProductBySlugCached } from "@/lib/data/content";
import {
  approxVisibleCharsFromFortuneHtml,
  extractSubtitleTitlesFromFortuneHtml,
} from "@/lib/fortune-saved-html-toc";
import {
  fortuneLibraryCharLabel,
  getFortuneLibraryDetail,
  isUuidRequestId,
} from "@/lib/library-fortune";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ requestId: string }>;
};

function formatKoDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Seoul",
    }).format(d);
  } catch {
    return iso;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { requestId } = await params;
  if (!isUuidRequestId(requestId)) return { title: "보관함 | 연운 緣運" };

  const detail = await getFortuneLibraryDetail(requestId);
  if (!detail) return { title: "보관함 | 연운 緣運" };

  let productTitle: string | null = null;
  const slug = detail.product_slug?.trim();
  if (slug) {
    const p = await getProductBySlugCached(slug);
    productTitle = p?.title ?? null;
  }

  const titleText =
    detail.payload.title?.trim() || productTitle || "저장된 풀이";
  const charLabel = fortuneLibraryCharLabel(detail.payload.character_key);
  const pageTitle = `${titleText} · ${charLabel} | 보관함 | 연운 緣運`;
  const desc =
    detail.summary?.trim()?.slice(0, 160) ||
    `${charLabel} 풀이 결과를 다시 읽습니다. 연운(緣運) 보관함.`;

  return {
    title: pageTitle,
    description: desc,
    openGraph: {
      title: pageTitle,
      description: desc,
      type: "article",
      locale: "ko_KR",
    },
    robots: { index: false, follow: true },
  };
}

export default async function LibraryFortuneDetailPage({ params }: Props) {
  const { requestId } = await params;
  if (!isUuidRequestId(requestId)) notFound();

  const detail = await getFortuneLibraryDetail(requestId);
  if (!detail) notFound();

  let productTitle: string | null = null;
  const slug = detail.product_slug?.trim();
  if (slug) {
    const p = await getProductBySlugCached(slug);
    productTitle = p?.title ?? null;
  }

  const heroTitle = detail.payload.title?.trim() || productTitle || "저장된 풀이";
  const charLabel = fortuneLibraryCharLabel(detail.payload.character_key);
  const profileKo = detail.payload.profile === "pair" ? "커플" : "개인";
  const savedAt = formatKoDate(detail.completed_at || detail.created_at);
  const fallbackTocTitles = extractSubtitleTitlesFromFortuneHtml(detail.html);
  const charApprox = approxVisibleCharsFromFortuneHtml(detail.html);

  const characterKey = String(detail.payload.character_key ?? "yeon").trim() || "yeon";

  return (
    <div className="yeonunPage y-lib-detail-root">
      <LibraryFortuneDetailPopBack />
      <main className="y-lib-detail-page y-lib-detail-main">
        <nav className="y-lib-back-nav" aria-label="보관함 이동">
          <Link className="y-lib-back-link" href="/library" scroll={false}>
            ‹ 보관함 목록
          </Link>
        </nav>

        <div className="y-lib-replay-viewport">
          <LibraryFortuneReplay
            heroTitle={heroTitle}
            charLabel={charLabel}
            profileKo={profileKo}
            savedAtLabel={savedAt}
            charApprox={charApprox}
            html={detail.html}
            tocSections={detail.toc_sections}
            tocGroups={detail.toc_groups}
            fallbackTocTitles={fallbackTocTitles}
            characterKey={characterKey}
            productSlug={detail.product_slug?.trim() || null}
            voiceBriefTitle={heroTitle}
            resultId={detail.result_id}
            voiceConsultSummary={detail.voice_consult_summary}
            profile={detail.payload.profile === "pair" ? "pair" : "single"}
          />
        </div>
      </main>
    </div>
  );
}
