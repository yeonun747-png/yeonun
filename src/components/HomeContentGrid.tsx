"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type MouseEvent, type ReactNode } from "react";

import { FortuneDuplicateConfirmSheet } from "@/components/fortune/FortuneDuplicateConfirmSheet";
import { clearSheetBackdropSnapshot } from "@/components/my/MySheetBackdropFrame";
import { SheetLink } from "@/components/SheetLink";
import type { Product } from "@/lib/data/content";
import { findFortuneDuplicateForProduct, fortuneLibraryHref, type FortuneDuplicateHit } from "@/lib/fortune-duplicate-client";
import { preloadFortuneProduct } from "@/lib/fortune-product-cache";
import { cardVariantForSlug } from "@/lib/ui/content-card-variant";

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
  /** 인터셉트 바텀시트(@modal) 안에서 사용 시 — 소프트 내비로는 모달 슬롯이 안 닫히므로 전체화면 hard navigate */
  fullPageNav = false,
}: {
  items: Product[];
  /** DB에 thumbnail_svg가 없을 때 `public/product-thumbnails/{slug}.svg` 등에서 채운 문자열 */
  fallbackSvgBySlug?: Record<string, string>;
  extraSearchParams?: string;
  hanDisplayChar?: string;
  fullPageNav?: boolean;
}) {
  const router = useRouter();

  /** /fortune·시트: soft nav(RSC flight) 대신 hard navigate — 점사 청크·@modal 슬롯 충돌 방지 */
  const navigate = useCallback(
    (href: string) => {
      const useHardNav =
        typeof window !== "undefined" && (fullPageNav || href.startsWith("/fortune/"));
      if (useHardNav) {
        clearSheetBackdropSnapshot();
        window.location.assign(href);
        return;
      }
      router.push(href);
    },
    [fullPageNav, router],
  );
  const [duplicateGate, setDuplicateGate] = useState<{
    href: string;
    hit: FortuneDuplicateHit;
  } | null>(null);
  const [checkingSlug, setCheckingSlug] = useState<string | null>(null);

  const suffix = extraSearchParams.startsWith("&") ? extraSearchParams : extraSearchParams ? `&${extraSearchParams}` : "";
  /** 점사 플로우 마스코트는 메뉴 카드 진입(`mc=1`)에서만 표시 */
  const fortuneSearch = (() => {
    const inner = suffix.replace(/^\?/, "").replace(/^&/, "").trim();
    if (!inner) return "?mc=1";
    const join = inner.includes("=") ? `${inner}&mc=1` : `mc=1&${inner}`;
    return `?${join}`;
  })();

  const openFortuneProduct = useCallback(
    async (href: string, slug: string) => {
      if (checkingSlug) return;
      setCheckingSlug(slug);
      try {
        const hit = await findFortuneDuplicateForProduct(slug);
        if (hit) {
          setDuplicateGate({ href, hit });
          return;
        }
        navigate(href);
      } finally {
        setCheckingSlug(null);
      }
    },
    [checkingSlug, navigate],
  );

  const onFortuneCardClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, href: string, slug: string) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      void openFortuneProduct(href, slug);
    },
    [openFortuneProduct],
  );

  return (
    <>
    <div className="y-content-grid" aria-label="추천 풀이">
      {items.map((p) => {
        const m = cardMetaForSlug(p.slug);
        const badgeClass = badgeClassFor(p.badge);
        const variant = cardVariantForSlug(p.slug, p.character_key);
        const tagLine = (p.tags?.length ? p.tags : []).slice(0, 3).join(" ");
        const inlineSvg = (p.thumbnail_svg?.trim() || fallbackSvgBySlug[p.slug]?.trim() || "").trim();
        const han = hanDisplayChar?.trim() ? hanDisplayChar : m.han;
        const fortuneHref = `/fortune/${p.slug}${fortuneSearch}`;
        return (
          <SheetLink
            key={p.slug}
            href={fortuneHref}
            className={`y-content-card ${variant}`}
            data-fortune-card={p.slug}
            onPointerEnter={() => {
              void preloadFortuneProduct(p.slug);
              void import("@/components/fortune/FortunePage");
            }}
            onFocus={() => {
              void preloadFortuneProduct(p.slug);
              void import("@/components/fortune/FortunePage");
            }}
            onTouchStart={() => {
              void preloadFortuneProduct(p.slug);
              void import("@/components/fortune/FortunePage");
            }}
            onClick={(e) => onFortuneCardClick(e, fortuneHref, p.slug)}
            aria-busy={checkingSlug === p.slug || undefined}
          >
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
              </div>
            </div>
          </SheetLink>
        );
      })}
    </div>
    {duplicateGate ? (
      <FortuneDuplicateConfirmSheet
        viewedAt={duplicateGate.hit.viewedAt}
        onRetry={() => {
          const href = duplicateGate.href;
          setDuplicateGate(null);
          navigate(href);
        }}
        onOpenLibrary={() => {
          const href = fortuneLibraryHref(duplicateGate.hit.requestId);
          setDuplicateGate(null);
          navigate(href);
        }}
        onDismiss={() => setDuplicateGate(null)}
      />
    ) : null}
    </>
  );
}
