import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/TopNav";
import { getProductBySlug, getReviewsByProductSlug } from "@/lib/data/content";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sheet?: string }>;
};

function specLabel(slug: string, categorySlug: string) {
  if (slug === "reunion-maybe") return "재회 분석";
  if (slug === "mind-now") return "마음 읽기";
  if (slug === "compat-howfar") return "사주 궁합";
  if (slug === "future-spouse") return "미래 인연";
  if (slug === "lifetime-master") return "평생 사주";
  if (slug === "saju-classic") return "정통 풀이";
  return categorySlug;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
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
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const sp = (((await searchParams?.catch?.(() => ({}))) ?? {}) as { sheet?: string });
  const sheet = sp.sheet;
  const asModal = sheet === "1";

  const reviews = await getReviewsByProductSlug(product.slug);
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

  const Page = (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="y-cd-hero" aria-label="상세 풀이">
        <div className="y-cd-hero-han" aria-hidden="true">
          緣
        </div>
        <div className="y-cd-hero-content">
          <div className="y-cd-hero-spec">{Spec}</div>
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
          <h2 className="y-cd-section-title">실시간 유저 리뷰</h2>
        </div>
        <div style={{ padding: "0 22px 24px" }}>
          {reviews.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--y-mute)", lineHeight: 1.6 }}>
              아직 리뷰가 없습니다.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reviews.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  style={{
                    background: "white",
                    border: "0.5px solid var(--y-line)",
                    borderRadius: 12,
                    padding: "14px 14px 12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: "var(--y-ink)", fontWeight: 600 }}>
                      {r.user_mask}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--y-mute)" }}>★ {Number(r.stars).toFixed(1)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--y-mute)", lineHeight: 1.6 }}>{r.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="y-cd-preview" aria-label="미리보기">
          <div className="y-cd-preview-label">PREVIEW · 일부 공개</div>
          <div className="y-cd-preview-text">
            당신의 사주 흐름과 지금의 마음을 함께 놓고 보면, 답은 생각보다 가까운 곳에 있습니다.
            <br />
            <br />
            오늘은 &ldquo;확신&rdquo;보다 &ldquo;신호&rdquo;를 읽는 날이에요.
          </div>
          <div className="y-cd-preview-fade">계속</div>
        </div>

        <div style={{ height: 18 }} />

        <div className="y-cd-foot" aria-label="구매">
          <div className="y-cd-price-block">
            <div className="y-cd-price-orig">정가 {Math.round(product.price_krw * 1.3).toLocaleString("ko-KR")}원</div>
            <div className="y-cd-price-now">
              {product.price_krw.toLocaleString("ko-KR")}
              <span className="small">원</span>
            </div>
          </div>
          <Link
            className="y-cd-buy-btn"
            href={`?sheet=1&modal=payment&product=${encodeURIComponent(product.slug)}&title=${encodeURIComponent(product.title)}&price=${product.price_krw}`}
            scroll={false}
          >
            결제하기
          </Link>
        </div>
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

  return (
    <div className="y-modal open" role="dialog" aria-modal="true" aria-label="상세 풀이">
      <div className="y-modal-sheet">
        <div className="y-modal-handle" />
        <div className="y-modal-head">
          <Link className="y-modal-back" href="/" aria-label="뒤로">
            <svg viewBox="0 0 24 24">
              <path d="M15 18 L9 12 L15 6" />
            </svg>
          </Link>
          <div className="y-modal-title">상세 풀이</div>
          <Link className="y-modal-close" href="/" aria-label="닫기">
            ×
          </Link>
        </div>
        <div className="y-modal-scroll">{Page}</div>
      </div>
    </div>
  );
}

