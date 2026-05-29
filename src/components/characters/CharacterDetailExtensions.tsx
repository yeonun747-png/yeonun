import Link from "next/link";

import { MeetCallButton } from "@/components/meet/MeetCallButton";
import { HomeContentGrid } from "@/components/HomeContentGrid";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import type { Character } from "@/lib/data/characters";
import { getCharacterPersonaCached } from "@/lib/data/characters";
import { getProductsByCharacterKeyCached } from "@/lib/data/content";
import { readProductThumbnailsForSlugs } from "@/lib/data/product-thumbnails";
import { listPublishedReviewsByCharacterKeyCached } from "@/lib/reviews";
import type { CharacterReviewKey } from "@/lib/reviews-types";
import { parseCharacterReviewKey } from "@/lib/reviews-types";

const DEFAULT_SPECIALTIES = [
  { name: "재회 분석", desc: "이별 후 인연이 다시 닿을 자리" },
  { name: "짝사랑 풀이", desc: "그 사람의 본심과 행동 가이드" },
  { name: "사주 궁합", desc: "두 사람의 합·충·형·파·해" },
  { name: "미래 배우자", desc: "언제, 어떤 결의 사람을 만날지" },
];

export async function CharacterDetailExtensions({
  c,
  contentLinkExtra,
  voiceCallFullPage = false,
}: {
  c: Character;
  contentLinkExtra: string;
  /** 인터셉트 바텀시트에서 음성 상담 — /call-dcc 전체 화면 전환 */
  voiceCallFullPage?: boolean;
}) {
  const charReviewKey = (parseCharacterReviewKey(c.key) ?? "yeon") as CharacterReviewKey;

  const [catalog, persona, reviews] = await Promise.all([
    getProductsByCharacterKeyCached(c.key),
    getCharacterPersonaCached(c.key),
    listPublishedReviewsByCharacterKeyCached(charReviewKey, { limit: 12 }),
  ]);

  const thumbFallback = await readProductThumbnailsForSlugs(
    catalog.filter((p) => !p.thumbnail_svg).map((p) => p.slug),
  );

  const specialties = persona?.specialties?.length ? persona.specialties : DEFAULT_SPECIALTIES;
  const reviewsPreview = reviews.slice(0, 3);

  return (
    <>
      <div className="y-section-head" style={{ padding: "18px 22px 0" }}>
        <h2 className="y-section-title">전문 영역</h2>
      </div>
      <section className="y-chd-skills" aria-label="전문 영역">
        {specialties.map((s) => (
          <div key={s.name} className="y-chd-skill">
            <div className="y-chd-skill-name">{s.name}</div>
            <div className="y-chd-skill-desc">{s.desc}</div>
          </div>
        ))}
      </section>

      <div className="y-section-head" style={{ padding: "0 22px 14px" }}>
        <h2 className="y-section-title">{c.name}에 대해</h2>
      </div>
      <section className="y-chd-persona" aria-label="페르소나">
        <div className="y-chd-persona-row">
          <div className="y-chd-persona-label">성정</div>
          <div className="y-chd-persona-value">
            {persona?.temperament ?? "차분하고 다정하지만, 흐릿한 감정은 단호히 짚어드립니다."}
          </div>
        </div>
        <div className="y-chd-persona-row">
          <div className="y-chd-persona-label">말투</div>
          <div className="y-chd-persona-value">{persona?.speech_style ?? "존댓말 · 조곤조곤 · 가끔 시적인 비유"}</div>
        </div>
        <div className="y-chd-persona-row">
          <div className="y-chd-persona-label">강점</div>
          <div className="y-chd-persona-value">{persona?.strengths ?? "감정의 결을 읽는 깊이. 행동 가이드의 구체성."}</div>
        </div>
        <div className="y-chd-persona-row">
          <div className="y-chd-persona-label">대표 키워드</div>
          <div className="y-chd-persona-value">
            {persona?.keywords?.join(" ") || "#재회 #짝사랑 #이별후 #그사람마음 #속궁합"}
          </div>
        </div>
      </section>

      <div className="y-chd-catalog-head">
        <h2 className="y-section-title">
          <span className="hash">#</span> {c.name}의 풀이
        </h2>
        <Link href="/content" className="y-section-more">
          전체
        </Link>
      </div>
      <section style={{ paddingBottom: 24 }} aria-label="캐릭터별 풀이 상품">
        {catalog.length === 0 ? (
          <p
            style={{
              padding: "0 22px 16px",
              fontSize: 13,
              color: "var(--y-mute)",
              lineHeight: 1.55,
            }}
          >
            이 안내자(<strong>{c.name}</strong>)에 연결된 풀이가 아직 없습니다. 어드민 상품에서 캐릭터를 맞춰 주세요.
          </p>
        ) : (
          <HomeContentGrid
            items={catalog}
            fallbackSvgBySlug={thumbFallback}
            extraSearchParams={contentLinkExtra}
            hanDisplayChar={c.han}
            fullPageNav={voiceCallFullPage}
          />
        )}
      </section>

      <div className="y-chd-catalog-head">
        <h2 className="y-section-title">{c.name}의 리뷰 ({reviews.length.toLocaleString("ko-KR")}개)</h2>
        <Link href={`/reviews?character=${encodeURIComponent(charReviewKey)}`} className="y-section-more">
          전체
        </Link>
      </div>
      <section className="y-review-stack" style={{ padding: "0 22px 80px" }} aria-label={`${c.name}의 리뷰`}>
        {reviewsPreview.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--y-mute)", lineHeight: 1.55, padding: "4px 0" }}>
            아직 등록된 리뷰가 없습니다.
          </p>
        ) : (
          reviewsPreview.map((r) => <ReviewCard key={r.id} review={r} variant="home" />)
        )}
      </section>

      <div className="y-chd-foot">
        <MeetCallButton className="y-chd-call-btn" characterKey={c.key} fullPageTransition={voiceCallFullPage}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
          </svg>
          {c.name}와 음성 상담 · 무료 3분
        </MeetCallButton>
      </div>
    </>
  );
}
