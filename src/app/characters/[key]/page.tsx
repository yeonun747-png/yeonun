import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/TopNav";
import { HomeContentGrid } from "@/components/HomeMoreSections";
import { getCharacterPersonaCached, getCharactersCached } from "@/lib/data/characters";
import { getProductsByCharacterKeyCached, getReviewsByProductSlugCached } from "@/lib/data/content";
import { readProductThumbnailsForSlugs } from "@/lib/data/product-thumbnails";

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

  const sp = (((await searchParams?.catch?.(() => ({}))) ?? {}) as { sheet?: string; from?: string });
  const asSheet = sp.sheet === "1";
  const from = sp.from;
  const closeHref = from === "meet" ? "/meet" : "/";

  const catalog = await getProductsByCharacterKeyCached(c.key);
  const thumbFallback = await readProductThumbnailsForSlugs(catalog.map((p) => p.slug));
  const reviews = await getReviewsByProductSlugCached(catalog[0]?.slug ?? "reunion-maybe", { limit: 6 });
  const backToCharacter = `/characters/${c.key}?sheet=1&from=${from ?? "home"}`;
  const contentLinkExtra = `&ck=${encodeURIComponent(c.key)}&back=${encodeURIComponent(backToCharacter)}`;
  const persona = await getCharacterPersonaCached(c.key);
  const specialties = persona?.specialties?.length
    ? persona.specialties
    : [
        { name: "재회 분석", desc: "이별 후 인연이 다시 닿을 자리" },
        { name: "짝사랑 풀이", desc: "그 사람의 본심과 행동 가이드" },
        { name: "사주 궁합", desc: "두 사람의 합·충·형·파·해" },
        { name: "미래 배우자", desc: "언제, 어떤 결의 사람을 만날지" },
      ];

  const Body = (
    <main style={{ paddingBottom: 180 }}>
      <section className={`y-chd-hero ${c.key}`} aria-label="인연 안내자">
        <div className="y-chd-status-pulse">
          <span className="pulse" aria-hidden="true" />
          지금 상담 가능
        </div>
        <div className="y-chd-han" aria-hidden="true">
          {c.han}
        </div>
        <div className="y-chd-name-block">
          <span className="y-chd-spec">{c.spec}</span>
          <h1 className="y-chd-name">{c.name}</h1>
          <div className="y-chd-name-en">
            {c.en} · {c.han}
          </div>
        </div>
      </section>

        <section className="y-chd-quote-section" aria-label="시그니처 한 마디">
          <div className="y-chd-quote-mark">"</div>
          <p className="y-chd-quote">{c.greeting}</p>
          <div className="y-chd-quote-by">— {c.name}의 첫 마디</div>
        </section>

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
            <div className="y-chd-persona-value">{persona?.temperament ?? "차분하고 다정하지만, 흐릿한 감정은 단호히 짚어드립니다."}</div>
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
            <div className="y-chd-persona-value">{persona?.keywords?.join(" ") || "#재회 #짝사랑 #이별후 #그사람마음 #속궁합"}</div>
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
            />
          )}
        </section>

        <div className="y-chd-catalog-head">
          <h2 className="y-section-title">{c.name}의 후기 ({(reviews.length || 0).toLocaleString("ko-KR")}개)</h2>
          <Link href="/reviews" className="y-section-more">
            전체
          </Link>
        </div>
        <section className="y-review-stack" style={{ padding: "0 22px 80px" }} aria-label="후기">
          {(reviews ?? []).slice(0, 3).map((r) => (
            <div key={r.id} className="y-review-card">
              <div className="y-review-head">
                <div className="y-review-meta-left">
                  <div className={`y-review-avatar ${c.key}`}>{c.han}</div>
                  <div>
                    <div className="y-review-name">{r.user_mask}</div>
                    <div className="y-review-prod">음성 상담 · 30분</div>
                  </div>
                </div>
                <div className="y-review-stars-row">
                  <div className="y-review-stars">{"★".repeat(Math.round(Number(r.stars) || 5))}</div>
                  <div className="y-review-time">방금</div>
                </div>
              </div>
              <p className="y-review-text">{r.body}</p>
            </div>
          ))}
        </section>

      <div className="y-chd-foot">
        <Link className="y-chd-call-btn" href={`/call-dcc?character_key=${encodeURIComponent(c.key)}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
          </svg>
          {c.name}와 음성 상담 · 무료 3분
        </Link>
      </div>
    </main>
  );

  if (asSheet) {
    return (
      <div className="y-modal open" role="dialog" aria-modal="true" aria-label="인연 안내자">
        <div className="y-modal-sheet">
          <div className="y-modal-handle" />
          <div className="y-modal-head">
            <Link className="y-modal-back" href={closeHref} scroll={false} aria-label="뒤로">
              <svg viewBox="0 0 24 24">
                <path d="M15 18 L9 12 L15 6" />
              </svg>
            </Link>
            <div className="y-modal-title">인연 안내자</div>
            <Link className="y-modal-close" href={closeHref} scroll={false} aria-label="닫기">
              ×
            </Link>
          </div>
          <div className="y-modal-scroll">{Body}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="yeonunPage">
      <TopNav />
      {Body}
    </div>
  );
}

