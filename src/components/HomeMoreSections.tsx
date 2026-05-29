"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { HomeContentGrid } from "@/components/HomeContentGrid";
import { HomeFaq } from "@/components/HomeFaq";
import { HomeReviewsSectionClient } from "@/components/reviews/HomeReviewsSectionClient";
import type { ContentCatalogSnapshot } from "@/lib/content-catalog";
import { preloadContentCatalog, resolveInitialContentCatalog } from "@/lib/content-catalog-cache";
import type { Product } from "@/lib/data/content";
import { HOME_WEEKLY_SLUGS } from "@/lib/home-product-slugs";
import { preloadHomeReviewsBlock } from "@/lib/home-reviews-cache";
import { preloadReviewsPage } from "@/lib/reviews-page-cache";

function isProduct(x: Product | undefined): x is Product {
  return Boolean(x);
}

function pickProducts(bySlug: Map<string, Product>, slugs: readonly string[]) {
  return slugs.map((s) => bySlug.get(s)).filter(isProduct);
}

export function HomeMoreSections({ serverCatalog }: { serverCatalog: ContentCatalogSnapshot }) {
  // 초기 렌더는 서버 스냅샷으로 통일 → SSR HTML과 일치(하이드레이션 불일치 방지)
  const [catalog, setCatalog] = useState<ContentCatalogSnapshot>(serverCatalog);

  useEffect(() => {
    // 마운트 후: 더 신선한 클라이언트 캐시가 있으면 업그레이드
    setCatalog(resolveInitialContentCatalog(serverCatalog));
    void preloadContentCatalog().then((next) => {
      if (next?.products.length) setCatalog(next);
    });
    void preloadHomeReviewsBlock();
    void preloadReviewsPage();
  }, [serverCatalog]);

  const bySlug = useMemo(
    () => new Map((catalog?.products ?? []).map((p) => [p.slug, p] as const)),
    [catalog],
  );
  const thumbFallback = catalog?.thumbFallback ?? {};
  const featured = pickProducts(bySlug, HOME_WEEKLY_SLUGS).slice(0, 4);

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
        items={pickProducts(bySlug, ["lifetime-master", "saju-classic", "wealth-graph", "career-timing"])}
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
          items={pickProducts(bySlug, ["newyear-2026", "tojeong-2026", "zimi-2026-flow", "calendar-2026"])}
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
        items={pickProducts(bySlug, ["zimi-chart", "naming-baby", "dream-lastnight", "child-saju"])}
        fallbackSvgBySlug={thumbFallback}
      />

      <HomeReviewsSectionClient />

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
            </ul>
          </div>
        </div>

        <div className="y-footer-bottom">
          <div className="y-footer-copy">© 2026 연운(YEONUN) · All rights reserved.</div>
          <div className="y-footer-bizinfo">
            <p>㈜테크앤조이 │ 대표 : 서주형</p>
            <p>대표전화 : 02-516-1975 │ 팩스 : 02-2210-7865</p>
            <p>서울특별시 성동구 상원12길 34 (성수동1가, 서울숲에이원) 213호</p>
            <p>사업자등록번호 : 108-81-84400 │ 통신판매업신고번호 : 2022-서울성동-00643</p>
          </div>
        </div>
      </footer>
    </>
  );
}

