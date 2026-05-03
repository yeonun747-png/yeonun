import Link from "next/link";

import { getProductsBySlugsCached, getReviewsByProductSlugCached } from "@/lib/data/content";
import { readProductThumbnailsForSlugs } from "@/lib/data/product-thumbnails";
import { cardVariantForSlug } from "@/lib/ui/content-card-variant";
import { HomeFaq } from "@/components/HomeFaq";
import type { Product } from "@/lib/data/content";

function isProduct(x: Product | undefined): x is Product {
  return Boolean(x);
}

function weeklyMeta(slug: string): {
  han: string;
  tagOn: string;
  illust: React.ReactNode;
} {
  if (slug === "reunion-maybe") {
    return {
      han: "緣",
      tagOn: "재회 분석",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <circle cx="50" cy="60" r="6" fill="white" opacity="0.7" />
          <circle cx="155" cy="80" r="6" fill="white" opacity="0.7" />
          <path
            d="M 50 60 Q 100 30, 155 80"
            stroke="white"
            strokeWidth="1"
            fill="none"
            opacity="0.55"
            strokeDasharray="3,3"
          />
          <path d="M 50 60 Q 100 100, 155 80" stroke="white" strokeWidth="1.5" fill="none" opacity="0.85" />
        </svg>
      ),
    };
  }

  if (slug === "mind-now") {
    return {
      han: "心",
      tagOn: "마음 읽기",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <path
            d="M 100 95 C 100 75, 80 65, 70 75 C 60 65, 40 75, 40 95 C 40 110, 100 130, 100 130 C 100 130, 160 110, 160 95 C 160 75, 140 65, 130 75 C 120 65, 100 75, 100 95 Z"
            fill="currentColor"
            opacity="0.25"
            transform="translate(0,-10) scale(0.6)"
          />
        </svg>
      ),
    };
  }

  if (slug === "compat-howfar") {
    return {
      han: "合",
      tagOn: "사주 궁합",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <circle cx="80" cy="75" r="32" fill="currentColor" opacity="0.18" />
          <circle cx="120" cy="75" r="32" fill="currentColor" opacity="0.18" />
          <circle cx="100" cy="75" r="14" fill="currentColor" opacity="0.32" />
        </svg>
      ),
    };
  }

  if (slug === "future-spouse") {
    return {
      han: "緣",
      tagOn: "미래 인연",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <path d="M 50 120 L 100 50 L 150 120" stroke="currentColor" opacity="0.3" strokeWidth="1.5" fill="none" />
          <circle cx="100" cy="50" r="8" fill="currentColor" opacity="0.4" />
          <path
            d="M 95 50 L 100 40 L 105 50 L 110 45 L 105 55 L 110 50 L 100 60 L 90 50 L 95 55 L 90 45 Z"
            fill="currentColor"
            opacity="0.5"
            transform="translate(0,-5)"
          />
        </svg>
      ),
    };
  }

  return {
    han: "緣",
    tagOn: "풀이",
    illust: (
      <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
        <path d="M 20 120 Q 90 70 180 110" stroke="white" strokeWidth="1" fill="none" opacity="0.45" />
      </svg>
    ),
  };
}

type CardMeta = { han: string; tagOn: string; illust: React.ReactNode };

function cardMetaForSlug(slug: string): CardMeta {
  // Weekly
  if (["reunion-maybe", "mind-now", "compat-howfar", "future-spouse"].includes(slug)) return weeklyMeta(slug);

  // Lifetime section
  if (slug === "lifetime-master") {
    return {
      han: "命",
      tagOn: "평생 사주",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <path
            d="M 0 130 L 30 95 L 60 110 L 90 75 L 120 95 L 150 60 L 180 80 L 200 70 L 200 150 L 0 150 Z"
            fill="rgba(255,255,255,0.18)"
          />
          <path d="M 0 100 L 40 85 L 80 90 L 120 75 L 160 80 L 200 70" stroke="white" strokeWidth="0.8" fill="none" opacity="0.5" />
        </svg>
      ),
    };
  }
  if (slug === "saju-classic") {
    return {
      han: "運",
      tagOn: "정통 풀이",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <g transform="translate(70,75)" opacity="0.35">
            <rect x="-30" y="-20" width="14" height="40" fill="rgba(45, 84, 68, 0.5)" />
            <rect x="-12" y="-20" width="14" height="40" fill="rgba(45, 84, 68, 0.4)" />
            <rect x="6" y="-20" width="14" height="40" fill="rgba(45, 84, 68, 0.5)" />
            <rect x="24" y="-20" width="14" height="40" fill="rgba(45, 84, 68, 0.4)" />
          </g>
        </svg>
      ),
    };
  }
  if (slug === "wealth-graph") {
    return {
      han: "財",
      tagOn: "재물운",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <circle cx="60" cy="100" r="20" fill="rgba(133, 79, 11, 0.18)" />
          <circle cx="100" cy="80" r="24" fill="rgba(133, 79, 11, 0.22)" />
          <circle cx="145" cy="105" r="18" fill="rgba(133, 79, 11, 0.18)" />
        </svg>
      ),
    };
  }
  if (slug === "career-timing") {
    return {
      han: "職",
      tagOn: "커리어",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <path d="M 30 110 L 60 90 L 90 100 L 130 70 L 170 80 L 195 55" stroke="rgba(45, 84, 68, 0.45)" strokeWidth="1.2" fill="none" />
          <circle cx="170" cy="80" r="3" fill="rgba(45, 84, 68, 0.55)" />
          <circle cx="195" cy="55" r="4" fill="rgba(45, 84, 68, 0.7)" />
        </svg>
      ),
    };
  }

  // Season section (2026)
  if (slug === "newyear-2026") {
    return {
      han: "運",
      tagOn: "병오년 운세",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <circle cx="160" cy="40" r="22" fill="rgba(255,255,255,0.45)" />
          <g fill="white" opacity="0.6">
            <circle cx="40" cy="50" r="1.8" />
            <circle cx="80" cy="30" r="1.5" />
            <circle cx="120" cy="80" r="1.5" />
            <circle cx="50" cy="100" r="2" />
            <circle cx="180" cy="110" r="1.5" />
          </g>
        </svg>
      ),
    };
  }
  if (slug === "tojeong-2026") {
    return {
      han: "秘",
      tagOn: "토정비결",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <rect
            x="60"
            y="40"
            width="80"
            height="70"
            rx="3"
            fill="rgba(77, 61, 122, 0.2)"
            stroke="rgba(77, 61, 122, 0.4)"
            strokeWidth="0.6"
          />
          <line x1="70" y1="55" x2="130" y2="55" stroke="rgba(77, 61, 122, 0.4)" strokeWidth="0.6" />
          <line x1="70" y1="68" x2="130" y2="68" stroke="rgba(77, 61, 122, 0.4)" strokeWidth="0.6" />
          <line x1="70" y1="81" x2="130" y2="81" stroke="rgba(77, 61, 122, 0.4)" strokeWidth="0.6" />
          <line x1="70" y1="94" x2="115" y2="94" stroke="rgba(77, 61, 122, 0.4)" strokeWidth="0.6" />
        </svg>
      ),
    };
  }
  if (slug === "zimi-2026-flow") {
    return {
      han: "紫",
      tagOn: "자미두수",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <g stroke="rgba(77, 61, 122, 0.4)" strokeWidth="0.5" fill="none">
            <path d="M 100 30 L 130 70 L 100 110 L 70 70 Z" />
            <path d="M 100 30 L 70 70 M 100 30 L 130 70 M 130 70 L 100 110 M 70 70 L 100 110" />
          </g>
          <circle cx="100" cy="30" r="3" fill="rgba(77, 61, 122, 0.6)" />
          <circle cx="130" cy="70" r="3" fill="rgba(77, 61, 122, 0.5)" />
          <circle cx="100" cy="110" r="3" fill="rgba(77, 61, 122, 0.5)" />
          <circle cx="70" cy="70" r="3" fill="rgba(77, 61, 122, 0.5)" />
        </svg>
      ),
    };
  }
  if (slug === "calendar-2026") {
    return {
      han: "曆",
      tagOn: "운세 캘린더",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <rect
            x="50"
            y="40"
            width="100"
            height="80"
            rx="4"
            fill="rgba(142, 56, 18, 0.15)"
            stroke="rgba(142, 56, 18, 0.35)"
            strokeWidth="0.6"
          />
          <rect x="50" y="40" width="100" height="18" fill="rgba(142, 56, 18, 0.4)" rx="4" />
          <g fill="rgba(142, 56, 18, 0.5)">
            <circle cx="65" cy="75" r="2" />
            <circle cx="80" cy="75" r="2" />
            <circle cx="95" cy="75" r="2" />
            <circle cx="110" cy="75" r="2" />
            <circle cx="125" cy="75" r="2" />
            <circle cx="140" cy="75" r="2" />
            <circle cx="65" cy="92" r="2" />
            <circle cx="80" cy="92" r="2" />
            <circle cx="95" cy="92" r="3.5" opacity="0.9" />
            <circle cx="110" cy="92" r="2" />
            <circle cx="125" cy="92" r="2" />
            <circle cx="140" cy="92" r="2" />
          </g>
        </svg>
      ),
    };
  }
  if (slug === "zimi-chart") {
    return {
      han: "紫",
      tagOn: "자미두수",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <g stroke="rgba(77, 61, 122, 0.4)" strokeWidth="0.5" fill="none">
            <path d="M 100 30 L 130 70 L 100 110 L 70 70 Z" />
            <path d="M 100 30 L 70 70 M 100 30 L 130 70 M 130 70 L 100 110 M 70 70 L 100 110" />
          </g>
          <circle cx="100" cy="30" r="3" fill="rgba(77, 61, 122, 0.6)" />
          <circle cx="130" cy="70" r="3" fill="rgba(77, 61, 122, 0.5)" />
          <circle cx="100" cy="110" r="3" fill="rgba(77, 61, 122, 0.5)" />
          <circle cx="70" cy="70" r="3" fill="rgba(77, 61, 122, 0.5)" />
        </svg>
      ),
    };
  }

  if (slug === "naming-baby") {
    return {
      han: "名",
      tagOn: "작명",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <g stroke="white" strokeWidth="0.7" fill="none" opacity="0.5">
            <path d="M 60 50 L 90 50 M 75 50 L 75 95 M 60 75 L 90 75 M 60 95 L 90 95" />
            <path d="M 110 45 L 140 45 L 140 95 L 110 95 Z" />
            <path d="M 110 70 L 140 70" />
            <path d="M 125 45 L 125 95" />
          </g>
        </svg>
      ),
    };
  }

  if (slug === "taekil-goodday") {
    return {
      han: "日",
      tagOn: "택일",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <circle cx="100" cy="75" r="36" fill="none" stroke="rgba(42, 49, 66, 0.4)" strokeWidth="0.6" />
          <line x1="100" y1="75" x2="100" y2="50" stroke="rgba(42, 49, 66, 0.55)" strokeWidth="1.2" />
          <line x1="100" y1="75" x2="120" y2="75" stroke="rgba(42, 49, 66, 0.55)" strokeWidth="1.2" />
          <circle cx="100" cy="75" r="2.5" fill="rgba(42, 49, 66, 0.7)" />
          <g fill="rgba(42, 49, 66, 0.5)">
            <circle cx="100" cy="42" r="1.2" />
            <circle cx="133" cy="75" r="1.2" />
            <circle cx="100" cy="108" r="1.2" />
            <circle cx="67" cy="75" r="1.2" />
          </g>
        </svg>
      ),
    };
  }

  if (slug === "dream-lastnight") {
    return {
      han: "夢",
      tagOn: "꿈해몽",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <path
            d="M 30 90 Q 60 70 90 80 T 150 75 Q 175 65 195 75"
            stroke="rgba(42, 49, 66, 0.35)"
            strokeWidth="0.8"
            fill="none"
          />
          <path
            d="M 20 110 Q 55 95 95 105 T 175 100"
            stroke="rgba(42, 49, 66, 0.28)"
            strokeWidth="0.8"
            fill="none"
          />
          <circle cx="155" cy="55" r="14" fill="rgba(42, 49, 66, 0.18)" />
          <circle cx="160" cy="50" r="12" fill="rgba(255,255,255,0.4)" />
          <g fill="rgba(42, 49, 66, 0.5)">
            <circle cx="50" cy="50" r="1.2" />
            <circle cx="80" cy="35" r="1" />
            <circle cx="110" cy="55" r="1" />
          </g>
        </svg>
      ),
    };
  }

  if (slug === "child-saju") {
    return {
      han: "子",
      tagOn: "자녀 사주",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <circle cx="75" cy="72" r="22" fill="rgba(42, 49, 66, 0.12)" stroke="rgba(42, 49, 66, 0.25)" strokeWidth="0.6" />
          <circle cx="125" cy="72" r="22" fill="rgba(42, 49, 66, 0.12)" stroke="rgba(42, 49, 66, 0.25)" strokeWidth="0.6" />
          <path d="M 75 72 L 125 72" stroke="rgba(42, 49, 66, 0.2)" strokeWidth="0.8" strokeDasharray="2,2" />
          <circle cx="100" cy="95" r="5" fill="rgba(42, 49, 66, 0.35)" />
        </svg>
      ),
    };
  }

  // Deep section (fallback to keep UI stable)
  return { han: "緣", tagOn: "풀이", illust: <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" /> };
}

function badgeClassFor(badge: string | null) {
  return badge === "HOT"
    ? "hot"
    : badge === "NEW"
      ? "new"
      : badge === "SIGNATURE"
        ? "signature"
        : /^\d{4}$/.test(badge ?? "")
          ? "season"
          : "";
}

export function HomeContentGrid({
  items,
  fallbackSvgBySlug = {},
  /** `sheet=1` 뒤에 붙일 쿼리. 예: `&ck=un&back=%2Fcharacters%2Fun%3Fsheet%3D1` */
  extraSearchParams = "",
  /** 캐릭터 상세 등: 카드 워터마크 한자를 상품별이 아닌 안내자 한자로 통일 */
  hanDisplayChar,
}: {
  items: Product[];
  /** DB에 thumbnail_svg가 없을 때 `public/product-thumbnails/{slug}.svg` 등에서 채운 문자열 */
  fallbackSvgBySlug?: Record<string, string>;
  extraSearchParams?: string;
  hanDisplayChar?: string;
}) {
  const suffix = extraSearchParams.startsWith("&") ? extraSearchParams : extraSearchParams ? `&${extraSearchParams}` : "";
  return (
    <div className="y-content-grid" aria-label="추천 풀이">
      {items.map((p) => {
        const m = cardMetaForSlug(p.slug);
        const badgeClass = badgeClassFor(p.badge);
        const variant = cardVariantForSlug(p.slug, p.character_key);
        const tagLine = (p.tags?.length ? p.tags : []).slice(0, 3).join(" ");
        const inlineSvg = (p.thumbnail_svg?.trim() || fallbackSvgBySlug[p.slug]?.trim() || "").trim();
        const han = hanDisplayChar?.trim() ? hanDisplayChar : m.han;
        return (
          <Link key={p.slug} href={`/content/${p.slug}?sheet=1${suffix}`} className={`y-content-card ${variant}`}>
            <div className="y-content-visual">
              {p.badge ? <span className={`y-content-badge ${badgeClass}`}>{p.badge}</span> : null}
              <div className="y-content-han" aria-hidden="true">
                {han}
              </div>
              <div className="y-content-illust" aria-hidden="true">
                {inlineSvg ? (
                  <span className="y-content-illust-svg" dangerouslySetInnerHTML={{ __html: inlineSvg }} />
                ) : (
                  m.illust
                )}
              </div>
              <span className="y-content-tag-on">{m.tagOn}</span>
            </div>
            <div className="y-content-meta">
              <h3 className="y-content-title">{p.title}</h3>
              <p className="y-content-quote">{p.quote}</p>
              <div className="y-content-tags-row">
                <div className="y-content-tags">{tagLine || "#재회 #인연 #흐름"}</div>
                <div className="y-content-price">
                  {p.price_krw.toLocaleString("ko-KR")}
                  <span className="small">원</span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export async function HomeMoreSections() {
  // 홈에서 보여줄 대표 상품/리뷰는 우선 DB에서 가져와서 “목업 섹션”에 꽂는다.
  const weeklyOrder = ["reunion-maybe", "mind-now", "compat-howfar", "future-spouse"];
  const homeSectionSlugs = Array.from(
    new Set([
      ...weeklyOrder,
      // # 평생을 풀어드립니다
      "lifetime-master",
      "saju-classic",
      "wealth-graph",
      "career-timing",
      // # 2026 신년 특별
      "newyear-2026",
      "tojeong-2026",
      "zimi-2026-flow",
      "calendar-2026",
      // # 깊이 있는 풀이
      "zimi-chart",
      "naming-baby",
      "dream-lastnight",
      "child-saju",
    ]),
  );

  const homeProducts = await getProductsBySlugsCached(homeSectionSlugs);
  const bySlug = new Map(homeProducts.map((p) => [p.slug, p] as const));
  const featured = weeklyOrder.map((s) => bySlug.get(s)).filter(isProduct).slice(0, 4);
  const thumbFallback = await readProductThumbnailsForSlugs(homeSectionSlugs);

  const reviews = await getReviewsByProductSlugCached(featured[0]?.slug ?? "reunion-maybe", { limit: 6 });

  return (
    <>
      <div className="y-section-head">
        <h2 className="y-section-title">
          <span className="hash">#</span> 이번주 인연
        </h2>
        <Link href="/content" className="y-section-more">
          더 보기
        </Link>
      </div>
      <p className="y-section-intro">
        <strong>다시 만날 사람, 곧 만날 사람.</strong> 사주가 알려주는 그 사람의 마음과 인연의 시기.
      </p>

      <HomeContentGrid items={featured} fallbackSvgBySlug={thumbFallback} />

      <div className="y-section-divider" />

      <div className="y-section-head">
        <h2 className="y-section-title">
          <span className="hash">#</span> 평생을 풀어드립니다
        </h2>
        <Link href="/content" className="y-section-more">
          더 보기
        </Link>
      </div>
      <p className="y-section-intro">
        <strong>한 사람의 인생을 처음부터 끝까지.</strong> 합·충·형·파·해 200개 항목, 10년 단위 대운까지.
      </p>
      <HomeContentGrid
        items={[
          bySlug.get("lifetime-master"),
          bySlug.get("saju-classic"),
          bySlug.get("wealth-graph"),
          bySlug.get("career-timing"),
        ].filter(Boolean) as Product[]}
        fallbackSvgBySlug={thumbFallback}
      />

      <div className="y-season-block">
        <div className="y-section-head">
          <h2 className="y-section-title">
            <span className="hash">#</span> 2026 신년 특별
          </h2>
          <Link href="/content" className="y-section-more">
            더 보기
          </Link>
        </div>
        <p className="y-section-intro">
          <strong>병오년(丙午年), 붉은 말의 해.</strong> 한 해를 어떻게 시작할지, 어디서 머물고 어디로 갈지.
        </p>
        <HomeContentGrid
          items={[
            bySlug.get("newyear-2026"),
            bySlug.get("tojeong-2026"),
            bySlug.get("zimi-2026-flow"),
            bySlug.get("calendar-2026"),
          ].filter(Boolean) as Product[]}
          fallbackSvgBySlug={thumbFallback}
        />
      </div>

      <div className="y-section-head">
        <h2 className="y-section-title">
          <span className="hash">#</span> 깊이 있는 풀이
        </h2>
        <Link href="/content" className="y-section-more">
          더 보기
        </Link>
      </div>
      <p className="y-section-intro">
        <strong>한 끗 더 깊이 들어가는 사람들을 위해.</strong> 자미두수·작명·꿈해몽·자녀 사주까지.
      </p>
      <HomeContentGrid
        items={[bySlug.get("zimi-chart"), bySlug.get("naming-baby"), bySlug.get("dream-lastnight"), bySlug.get("child-saju")].filter(Boolean) as Product[]}
        fallbackSvgBySlug={thumbFallback}
      />

      <div className="y-reviews-block">
        <div className="y-section-head">
          <h2 className="y-section-title">
            <span className="hash">#</span> 51,820명의 운명
          </h2>
          <Link href="/reviews" className="y-section-more">
            전체 후기
          </Link>
        </div>

        <div className="y-reviews-stats">
          <div className="y-stat-card">
            <div className="y-stat-num">51,820</div>
            <div className="y-stat-label">누적 풀이</div>
          </div>
          <div className="y-stat-card">
            <div className="y-stat-num">96%</div>
            <div className="y-stat-label">재회 적중</div>
          </div>
          <div className="y-stat-card">
            <div className="y-stat-num">4.9</div>
            <div className="y-stat-label">평균 별점</div>
          </div>
        </div>

        <div className="y-review-stack" aria-label="후기">
          {(reviews.length ? reviews : []).slice(0, 3).map((r) => (
            <div key={r.id} className="y-review-card">
              <div className="y-review-head">
                <div className="y-review-meta-left">
                  <div className="y-review-avatar yeon">蓮</div>
                  <div>
                    <div className="y-review-name">{r.user_mask}</div>
                    <div className="y-review-prod">연운 · 텍스트 풀이</div>
                  </div>
                </div>
                <div className="y-review-stars">★★★★★</div>
              </div>
              <p className="y-review-text">{r.body}</p>
              <div className="y-review-tags">{(r.tags ?? []).join(" ")}</div>
            </div>
          ))}
        </div>

        <Link className="y-review-more" href="/reviews">
          후기 더 보기 (51,820+) →
        </Link>
      </div>

      <div className="y-section-divider" />

      <div className="y-pricing-block" aria-label="가격">
        <div className="y-pricing-head">
          <div className="y-pricing-eyebrow">PRICING · 건당 결제</div>
          <h2 className="y-pricing-title">
            필요할 때만,
            <br />
            딱 그만큼만
          </h2>
          <p className="y-pricing-sub">
            구독 없이, 한 건씩 정직하게.
            <br />
            처음 3분은 무료로 시작하세요.
          </p>
        </div>

        <div className="y-price-stack">
          <div className="y-price-card featured">
            <div className="y-price-tier">FREE · 처음 시작</div>
            <div className="y-price-name">3분 무료 체험</div>
            <p className="y-price-tagline">카드 등록 없이 지금 바로</p>
            <div className="y-price-amount">
              <span className="y-price-currency">₩</span>
              <span className="y-price-num">0</span>
            </div>
            <div className="y-price-period">처음 한 번 무료</div>
            <div className="y-price-spacer" />
            <ul className="y-price-features">
              <li className="highlight">4명 모두 상담 가능</li>
              <li>연운 만세력 무제한</li>
              <li>오늘의 운세 매일 1회</li>
              <li>꿈해몽 일 1회</li>
            </ul>
            <Link className="y-price-cta" href="/meet">
              무료로 상담 시작 →
            </Link>
          </div>

          <div className="y-price-card">
            <div className="y-price-tier">VOICE · 음성 상담</div>
            <div className="y-price-name">크레딧 상담</div>
            <p className="y-price-tagline">음성·채팅 모두 크레딧으로</p>
            <div className="y-price-amount">
              <span className="y-price-currency">₩</span>
              <span className="y-price-num">390</span>
            </div>
            <div className="y-price-period">/ 1분 음성 (분당 390 크레딧)</div>
            <div className="y-price-spacer" />
            <ul className="y-price-features">
              <li>3,900 크레딧 = 3,900원</li>
              <li>11,880 크레딧 = 9,900원 (+20%)</li>
              <li>25,870 크레딧 = 19,900원 (+30%)</li>
              <li>충전 크레딧 365일 유효</li>
              <li>4명 안내자 자유 선택</li>
            </ul>
            <Link className="y-price-cta" href="/checkout/credit">
              크레딧 충전
            </Link>
          </div>

          <div className="y-price-card">
            <div className="y-price-tier">CONTENT · 풀이</div>
            <div className="y-price-name">텍스트 풀이</div>
            <p className="y-price-tagline">차분히 읽으며 보관</p>
            <div className="y-price-amount">
              <span className="y-price-currency">₩</span>
              <span className="y-price-num">4,900</span>
            </div>
            <div className="y-price-period">부터 (콘텐츠별)</div>
            <div className="y-price-spacer" />
            <ul className="y-price-features">
              <li>꿈해몽 4,900원</li>
              <li>재회비책 14,900원</li>
              <li>정통 사주 19,900원</li>
              <li>사주궁합 19,900원</li>
              <li>평생사주 49,900원</li>
              <li>60일 보관함 무료</li>
            </ul>
            <Link className="y-price-cta" href="/content">
              콘텐츠 둘러보기
            </Link>
          </div>
        </div>
      </div>

      <HomeFaq />

      <section className="y-final-cta" aria-label="무료 상담 시작">
        <div className="y-final-cta-inner">
          <div className="y-final-cta-eyebrow">START YOUR JOURNEY</div>
          <h2>지금, 한 번의 부름</h2>
          <p>
            가입 즉시 3분 무료 음성 상담.
            <br />
            카드 등록 없이 시작할 수 있습니다.
          </p>
          <Link className="y-final-cta-btn" href="/meet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
              <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
            </svg>
            지금 무료로 상담 시작
          </Link>
          <div className="y-final-cta-sub">· · ·</div>
        </div>
      </section>

      <footer className="y-footer" aria-label="푸터">
        <div className="y-footer-brand-block">
          <div className="y-footer-brand-row">
            <span className="y-logo-mark">연운</span>
            <span className="y-logo-han">緣運</span>
          </div>
          <p className="y-footer-tagline">Your destiny, in voice.</p>
          <p className="y-footer-desc">
            천 년의 명리학과 4명의 인연 안내자가 당신의 운명을 가장 깊이 들어주는 곳.
          </p>
        </div>

        <div className="y-footer-cols">
          <div className="y-footer-col">
            <h5>인연</h5>
            <ul>
              <li>
                <Link href="/characters/yeon">연화 · 재회·연애</Link>
              </li>
              <li>
                <Link href="/characters/byeol">별하 · 자미두수</Link>
              </li>
              <li>
                <Link href="/characters/yeo">여연 · 정통 사주</Link>
              </li>
              <li>
                <Link href="/characters/un">운서 · 작명·택일</Link>
              </li>
            </ul>
          </div>
          <div className="y-footer-col">
            <h5>풀이</h5>
            <ul>
              <li>
                <Link href="/content?category=saju">사주 · 평생운</Link>
              </li>
              <li>
                <Link href="/content?category=love">연애 · 재회 · 궁합</Link>
              </li>
              <li>
                <Link href="/content?category=newyear">신년운세 · 토정비결</Link>
              </li>
              <li>
                <Link href="/content?category=zimi">자미두수 · 작명</Link>
              </li>
            </ul>
          </div>
          <div className="y-footer-col">
            <h5>회사</h5>
            <ul>
              <li>
                <Link href="/company/about">연운 소개</Link>
              </li>
              <li>
                <Link href="/support">고객센터</Link>
              </li>
              <li>
                <Link href="/partner">제휴 문의</Link>
              </li>
            </ul>
          </div>
          <div className="y-footer-col">
            <h5>약관</h5>
            <ul>
              <li>
                <Link href="/legal/terms">이용약관</Link>
              </li>
              <li>
                <Link href="/legal/privacy">개인정보처리방침</Link>
              </li>
              <li>
                <Link href="/legal/refund">환불정책</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="y-footer-bottom">
          <div className="y-footer-copy">© 2026 연운(YEONUN) · All rights reserved.</div>
          <div className="y-footer-bizinfo">통신판매업 신고: 2026-서울-XXXX</div>
        </div>
      </footer>
    </>
  );
}

