import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ContentPurchaseFooter } from "@/components/content/ContentPurchaseFooter";
import { TopNav } from "@/components/TopNav";
import { YeonunRoutedBottomSheetPortal } from "@/components/YeonunRoutedBottomSheetPortal";
import { SheetBackdropFrame } from "@/components/my/MySheetBackdropFrame";
import { getProductBySlugCached, getReviewsByProductSlugCached } from "@/lib/data/content";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sheet?: string; ck?: string; back?: string; modal?: string }>;
};

const HAN_BY_KEY: Record<string, string> = {
  yeon: "蓮",
  byeol: "別",
  yeo: "與",
  un: "運",
};

function normalizeThemeKey(input: string): "yeon" | "byeol" | "yeo" | "un" {
  const v = (input || "").toLowerCase();
  if (v === "yeon" || v === "byeol" || v === "yeo" || v === "un") return v;
  if (v === "yeonhwa" || v === "yeon-hwa") return "yeon";
  return "yeon";
}

function specLabel(slug: string, categorySlug: string) {
  if (slug === "reunion-maybe") return "재회 분석";
  if (slug === "mind-now") return "마음 읽기";
  if (slug === "compat-howfar") return "사주 궁합";
  if (slug === "future-spouse") return "미래 인연";
  if (slug === "lifetime-master") return "평생 사주";
  if (slug === "saju-classic") return "정통 풀이";
  return categorySlug;
}

function heroMetaForSlug(slug: string, color: string, themeKey: string): { tagOn: string; illust: React.ReactNode } {
  const isYeonTheme = themeKey === "yeon" || themeKey.startsWith("yeon");
  const softYeonStroke = "#cf7891";
  const softYeonFill = "#dc8fa3";

  if (slug === "reunion-maybe") {
    return {
      tagOn: "재회 분석",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <circle cx="50" cy="60" r="6" fill={color} opacity="0.22" />
          <circle cx="155" cy="80" r="6" fill={color} opacity="0.22" />
          <path d="M 50 60 Q 100 30, 155 80" stroke={color} strokeWidth="1" fill="none" opacity="0.18" strokeDasharray="3,3" />
          <path d="M 50 60 Q 100 100, 155 80" stroke={color} strokeWidth="1.5" fill="none" opacity="0.28" />
        </svg>
      ),
    };
  }
  if (slug === "mind-now") {
    return {
      tagOn: "마음 읽기",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <path
            d="M 100 95 C 100 75, 80 65, 70 75 C 60 65, 40 75, 40 95 C 40 110, 100 130, 100 130 C 100 130, 160 110, 160 95 C 160 75, 140 65, 130 75 C 120 65, 100 75, 100 95 Z"
            fill={color}
            opacity="0.22"
            transform="translate(0,-6) scale(0.72)"
          />
        </svg>
      ),
    };
  }
  if (slug === "compat-howfar") {
    return {
      tagOn: "사주 궁합",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <circle cx="82" cy="78" r="36" fill={color} opacity="0.16" />
          <circle cx="122" cy="72" r="36" fill={color} opacity="0.16" />
          <circle cx="104" cy="76" r="16" fill={color} opacity="0.28" />
        </svg>
      ),
    };
  }
  if (slug === "future-spouse") {
    const strokeColor = isYeonTheme ? softYeonStroke : color;
    const fillColor = isYeonTheme ? softYeonFill : color;
    return {
      tagOn: "미래 인연",
      illust: (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <path d="M 45 122 L 100 45 L 155 122" stroke={strokeColor} opacity={isYeonTheme ? "0.32" : "0.28"} strokeWidth="1.5" fill="none" />
          <circle cx="100" cy="45" r="9" fill={fillColor} opacity={isYeonTheme ? "0.34" : "0.38"} />
          <path
            d="M 95 45 L 100 34 L 105 45 L 112 39 L 107 50 L 112 45 L 100 58 L 88 45 L 93 50 L 88 39 Z"
            fill={fillColor}
            opacity={isYeonTheme ? "0.42" : "0.46"}
            transform="translate(0,-3)"
          />
        </svg>
      ),
    };
  }

  return {
    tagOn: "풀이",
    illust: (
      <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
        <path d="M 20 120 Q 90 70 180 110" stroke={color} strokeWidth="1" fill="none" opacity="0.18" />
      </svg>
    ),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlugCached(slug);
  if (!product) return { title: "상세 풀이" };

  return {
    title: `${product.title} | 연운 緣運`,
    description: product.quote,
    openGraph: {
      title: `${product.title} | 연운 緣運`,
      description: product.quote,
      type: "article",
      locale: "ko_KR",
    },
  };
}

export default async function ContentDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const product = await getProductBySlugCached(slug);
  if (!product) notFound();

  const sp = (((await searchParams?.catch?.(() => ({}))) ?? {}) as { sheet?: string; ck?: string; back?: string; modal?: string });
  const sheet = sp.sheet;
  const asModal = sheet === "1";
  const hasStackedModal = Boolean(sp.modal);
  const themeKey = normalizeThemeKey(sp.ck || product.character_key || "yeon");
  const backHref = sp.back ? decodeURIComponent(sp.back) : "/";

  const reviews = await getReviewsByProductSlugCached(product.slug, { limit: 12 });
  const rating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((acc, r) => acc + Number(r.stars), 0) / reviews.length) * 10,
        ) / 10
      : 4.9;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.quote,
    brand: { "@type": "Brand", name: "연운 緣運" },
    offers: {
      "@type": "Offer",
      priceCurrency: "KRW",
      price: product.price_krw,
      availability: "https://schema.org/InStock",
    },
    aggregateRating:
      reviews.length > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: rating,
            reviewCount: reviews.length,
          }
        : undefined,
  };

  const Spec = specLabel(product.slug, product.category_slug);
  const displayReviewCount = product.slug === "reunion-maybe" ? "7,243명" : `${reviews.length.toLocaleString("ko-KR")}명`;
  const heroIllustColor =
    themeKey === "byeol"
      ? "rgba(77, 61, 122, 0.55)"
      : themeKey === "yeo"
        ? "rgba(45, 84, 68, 0.55)"
        : themeKey === "un"
          ? "rgba(42, 49, 66, 0.55)"
          : "rgba(221, 88, 120, 0.42)";
  const heroMeta = heroMetaForSlug(product.slug, heroIllustColor, themeKey);

  const Page = (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className={`y-cd-hero ${themeKey}`} aria-label="상세 풀이">
        <div className="y-cd-hero-illust" aria-hidden="true" style={{ color: heroIllustColor }}>
          {heroMeta.illust}
        </div>
        <div className="y-cd-hero-han" aria-hidden="true">
          {HAN_BY_KEY[themeKey] ?? "緣"}
        </div>
        <div className="y-cd-hero-content">
          <div className="y-cd-hero-spec">{heroMeta.tagOn || Spec}</div>
          <h1 className="y-cd-hero-title">{product.title}</h1>
          <div className="y-cd-hero-by">연운의 풀이 · 약 30~60쪽</div>
        </div>
      </section>

      <section className="y-cd-stats" aria-label="통계">
        <div className="y-cd-stat">
          <div className="y-cd-stat-num">
            <span className="star">★</span> {rating.toFixed(1)}
          </div>
          <div className="y-cd-stat-label">평균 별점</div>
        </div>
        <div className="y-cd-stat">
          <div className="y-cd-stat-num">{displayReviewCount}</div>
          <div className="y-cd-stat-label">누적 풀이</div>
        </div>
        <div className="y-cd-stat">
          <div className="y-cd-stat-num">96%</div>
          <div className="y-cd-stat-label">재회 적중</div>
        </div>
      </section>

        <div className="y-cd-section">
          <h2 className="y-cd-section-title">이런 분께 추천</h2>
        </div>
        <p className="y-cd-desc">{product.quote}</p>

        <div className="y-cd-section">
          <h2 className="y-cd-section-title">포함 사항</h2>
        </div>
        <div className="y-cd-incl" aria-label="포함 사항">
          <div className="y-cd-incl-item">
            <div className="y-cd-incl-icon" aria-hidden="true">
              緣
            </div>
            <div className="y-cd-incl-text">
              <div className="y-cd-incl-name">두 사람의 인연 분석</div>
              <div className="y-cd-incl-desc">사주의 합·충·형으로 보는 관계의 본질</div>
            </div>
          </div>
          <div className="y-cd-incl-item">
            <div className="y-cd-incl-icon" aria-hidden="true">
              時
            </div>
            <div className="y-cd-incl-text">
              <div className="y-cd-incl-name">재회 가능 시기</div>
              <div className="y-cd-incl-desc">앞으로 12개월 중 인연이 다시 닿을 자리</div>
            </div>
          </div>
          <div className="y-cd-incl-item">
            <div className="y-cd-incl-icon" aria-hidden="true">
              心
            </div>
            <div className="y-cd-incl-text">
              <div className="y-cd-incl-name">그 사람의 현재 마음</div>
              <div className="y-cd-incl-desc">일주가 보내는 신호와 본심</div>
            </div>
          </div>
          <div className="y-cd-incl-item">
            <div className="y-cd-incl-icon" aria-hidden="true">
              道
            </div>
            <div className="y-cd-incl-text">
              <div className="y-cd-incl-name">행동 가이드</div>
              <div className="y-cd-incl-desc">기다릴 때, 다가갈 때, 놓아줄 때</div>
            </div>
          </div>
        </div>

        <div className="y-cd-section">
          <h2 className="y-cd-section-title">풀이 미리보기</h2>
        </div>
        <div className="y-cd-preview" aria-label="풀이 미리보기">
          <div className="y-cd-preview-label">PREVIEW · 일부 공개</div>
          <div className="y-cd-preview-text">
            당신의 사주 흐름과 지금의 마음을 함께 놓고 보면, 답은 생각보다 가까운 곳에 있습니다.
            <br />
            <br />
            오늘은 &ldquo;확신&rdquo;보다 &ldquo;신호&rdquo;를 읽는 날이에요.
          </div>
          <div className="y-cd-preview-fade">전체 풀이를 보려면 결제하세요</div>
        </div>

        <div className="y-cd-section">
          <h2 className="y-cd-section-title">최근 후기 ({reviews.length.toLocaleString("ko-KR")}개)</h2>
        </div>
        <div style={{ padding: "0 22px 24px" }}>
          {reviews.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--y-mute)", lineHeight: 1.6 }}>
              아직 리뷰가 없습니다.
            </div>
          ) : (
            <div className="y-review-stack" aria-label="후기">
              {reviews.slice(0, 6).map((r) => (
                <div key={r.id} className="y-review-card">
                  <div className="y-review-head">
                    <div className="y-review-meta-left">
                      <div className={`y-review-avatar ${product.character_key}`}>緣</div>
                      <div>
                        <div className="y-review-name">{r.user_mask}</div>
                        <div className="y-review-prod">재회 풀이</div>
                      </div>
                    </div>
                    <div className="y-review-stars-row">
                      <div className="y-review-stars">{"★".repeat(Math.round(Number(r.stars) || 5))}</div>
                      <div className="y-review-time">3시간 전</div>
                    </div>
                  </div>
                  <p className="y-review-text">{r.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <ContentPurchaseFooter
          slug={product.slug}
          title={product.title}
          priceKrw={product.price_krw}
          characterKey={product.character_key}
          sajuInputProfile={product.saju_input_profile}
          themeKey={themeKey}
          sheet={sheet === "1" ? "1" : undefined}
          backRaw={typeof sp.back === "string" ? sp.back : undefined}
        />
    </>
  );

  if (!asModal) {
    return (
      <div className="yeonunPage">
        <TopNav />
        <main>{Page}</main>
      </div>
    );
  }

  if (hasStackedModal) {
    return <SheetBackdropFrame />;
  }

  return (
    <>
      <SheetBackdropFrame />
      <YeonunRoutedBottomSheetPortal backHref={backHref} ariaLabel="상세 풀이" title="상세 풀이">
        {Page}
      </YeonunRoutedBottomSheetPortal>
    </>
  );
}

