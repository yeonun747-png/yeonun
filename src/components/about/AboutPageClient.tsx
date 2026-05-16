"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BottomNav } from "@/components/BottomNav";

const TECH_ITEMS = [
  {
    icon: "🧭",
    bg: "var(--y-rose-soft)",
    title: "정밀 만세력 엔진",
    desc: "진태양시 보정 + 출생 경도 반영. 합·충·형·파·해, 12운성, 12신살, 용신, 대운까지 200개 항목 자동 계산.",
  },
  {
    icon: "🎙️",
    bg: "var(--y-byeol-bg)",
    title: "0.3초 응답, 자연스러운 대화",
    desc: "응답 지연 0.3초 이내의 실시간 음성 상담. 4명 각자의 목소리·억양·말투가 뚜렷이 구분됩니다.",
  },
  {
    icon: "📖",
    bg: "var(--y-yeo-bg)",
    title: "정파 명리학의 깊이",
    desc: "일반론이 아닌 명식에 있는 글자만으로 풀이합니다. 없는 글자는 만들지 않는 것이 연운의 원칙.",
  },
  {
    icon: "🔒",
    bg: "var(--y-un-bg)",
    title: "암호화 개인정보 보호",
    desc: "모든 사주 데이터 암호화 저장. 음성 상담 내용은 동의 없이 영구 저장되지 않습니다.",
  },
] as const;

const CHARACTERS = [
  { key: "yeon", han: "蓮", emoji: "🌸", name: "연화", role: ["재회 · 연애 · 궁합", "감정의 흐름을 읽는 안내자"] },
  { key: "byeol", han: "星", emoji: "⭐", name: "별하", role: ["자미두수 · 신년운세", "별과 시간의 흐름을 읽는 해석가"] },
  { key: "yeo", han: "麗", emoji: "🍃", name: "여연", role: ["정통사주 · 평생운", "명리학의 깊은 권위를 가진 안내자"] },
  { key: "un", han: "雲", emoji: "🌙", name: "운서", role: ["작명 · 택일 · 꿈해몽", "한 글자에 담긴 운명의 무게를 아는 안내자"] },
] as const;

const TIMELINE = [
  {
    year: "2024",
    title: "서비스 기획 시작",
    desc: "포춘82 운영 경험을 바탕으로 새로운 명리 상담 서비스 기획. 정통 명리학 엔진 개발 착수.",
    now: false,
  },
  {
    year: "2025",
    title: "4명 캐릭터 IP 확정 · 베타 출시",
    desc: "연화·별하·여연·운서 캐릭터 개발 완료. 음성 상담 베타 서비스 개시. 누적 사용자 10,000명 돌파.",
    now: false,
  },
  {
    year: "2026 · NOW",
    title: "정식 출시 · 텍스트 풀이 17종 추가",
    desc: "텍스트 점사 17개 상품 출시. 채팅 상담 기능 추가. 재회 적중률 96% 돌파.",
    now: true,
  },
] as const;

const COMPANY_ROWS = [
  { label: "서비스명", value: "연운 (YEONUN)" },
  { label: "운영사", value: "테크앤조이" },
  { label: "서비스 시작", value: "2026년 4월" },
  { label: "고객센터", value: "support@yeonun.com", href: "mailto:support@yeonun.com" },
] as const;

export function AboutPageClient() {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <div className="yeonunPage y-about-page">
      <nav className="ab-nav" aria-label="연운 소개">
        <button type="button" className="ab-nav-back" onClick={goBack} aria-label="뒤로">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18L9 12l6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="ab-nav-logo">
          <span className="y-logo-mark">연운</span>
          <span className="y-logo-han">緣運</span>
        </div>
        <div className="ab-nav-placeholder" aria-hidden />
      </nav>

      <main>
        <section className="ab-hero" aria-labelledby="ab-hero-title">
          <div className="ab-hero-inner">
            <div className="ab-hero-badge">
              <span aria-hidden />
              ABOUT · 연운 소개
            </div>
            <h1 id="ab-hero-title" className="ab-hero-title">
              천 년의 명리학,
              <br />
              <em>4명의 목소리</em>로
              <br />
              지금 당신 곁에
            </h1>
            <p className="ab-hero-desc">
              천 년의 명리학과 4명의 인연 안내자.
              <br />
              언제 어디서든, 카드 등록 없이,
              <br />
              필요한 만큼만 운명을 듣는 곳.
            </p>
          </div>
        </section>

        <section className="ab-stats" aria-label="서비스 수치">
          <div className="ab-stat">
            <div className="ab-stat-num">
              4.9<sup>★</sup>
            </div>
            <div className="ab-stat-label">
              평균
              <br />
              별점
            </div>
          </div>
          <div className="ab-stat">
            <div className="ab-stat-num">3분</div>
            <div className="ab-stat-label">
              무료
              <br />
              체험
            </div>
          </div>
          <div className="ab-stat">
            <div className="ab-stat-num">4명</div>
            <div className="ab-stat-label">
              인연
              <br />
              안내자
            </div>
          </div>
          <div className="ab-stat">
            <div className="ab-stat-num">
              24<sup>h</sup>
            </div>
            <div className="ab-stat-label">
              연중
              <br />
              무휴
            </div>
          </div>
        </section>

        <hr className="ab-hr" />

        <header className="ab-section-head">
          <div className="ab-section-eyebrow">PHILOSOPHY</div>
          <h2 className="ab-section-title">
            <span className="hash">#</span> 왜 연운인가
          </h2>
        </header>
        <section className="ab-philosophy" aria-label="연운 철학">
          <p className="ab-philosophy-quote">좋은 명리 상담은 누구에게나 열려 있어야 합니다</p>
          <p className="ab-philosophy-body">
            강남 청담의 30~50만원짜리 사주 풀이를 받기 위해 몇 주를 기다리는 시대는 끝났습니다.
            <br />
            <br />
            연운은 정파 명리학의 깊이를 그대로 담되, 누구나 언제든 접근할 수 있도록 설계했습니다. 카드 등록 없이, 구독 없이,
            필요한 그 순간에만.
          </p>
        </section>

        <hr className="ab-hr" />

        <header className="ab-section-head">
          <div className="ab-section-eyebrow">TECHNOLOGY</div>
          <h2 className="ab-section-title">
            <span className="hash">#</span> 연운이 다른 이유
          </h2>
        </header>
        <ul className="ab-tech-list">
          {TECH_ITEMS.map((item) => (
            <li key={item.title} className="ab-tech-item">
              <div className="ab-tech-icon" style={{ background: item.bg }}>
                {item.icon}
              </div>
              <div>
                <div className="ab-tech-title">{item.title}</div>
                <div className="ab-tech-desc">{item.desc}</div>
              </div>
            </li>
          ))}
        </ul>

        <hr className="ab-hr" />

        <header className="ab-section-head">
          <div className="ab-section-eyebrow">CHARACTERS</div>
          <h2 className="ab-section-title">
            <span className="hash">#</span> 4명의 인연 안내자
          </h2>
          <p className="ab-section-body">
            같은 사주를 봐도 4명이 보는 결이 다릅니다.
            <br />
            고민에 따라 가장 잘 맞는 안내자를 선택하세요.
          </p>
        </header>
        <div className="ab-chars">
          {CHARACTERS.map((c) => (
            <article key={c.key} className={`ab-char-card ${c.key}`}>
              <span className="ab-char-han" aria-hidden>
                {c.han}
              </span>
              <span className="ab-char-emoji" aria-hidden>
                {c.emoji}
              </span>
              <h3 className="ab-char-name">{c.name}</h3>
              <p className="ab-char-role">
                {c.role[0]}
                <br />
                {c.role[1]}
              </p>
            </article>
          ))}
        </div>

        <hr className="ab-hr" />

        <header className="ab-section-head">
          <div className="ab-section-eyebrow">HISTORY</div>
          <h2 className="ab-section-title">
            <span className="hash">#</span> 연운의 걸음
          </h2>
        </header>
        <ol className="ab-timeline">
          {TIMELINE.map((item) => (
            <li key={item.year} className="ab-timeline-item">
              <div className={`ab-timeline-dot${item.now ? " now" : ""}`} aria-hidden />
              <div className="ab-timeline-year">{item.year}</div>
              <h3 className="ab-timeline-title">{item.title}</h3>
              <p className="ab-timeline-desc">{item.desc}</p>
            </li>
          ))}
        </ol>

        <hr className="ab-hr" />

        <header className="ab-section-head">
          <div className="ab-section-eyebrow">COMPANY</div>
          <h2 className="ab-section-title">
            <span className="hash">#</span> 운영사 정보
          </h2>
        </header>
        <dl className="ab-company">
          {COMPANY_ROWS.map((row) => (
            <div key={row.label} className="ab-company-row">
              <dt className="ab-company-label">{row.label}</dt>
              <dd className="ab-company-val">
                {"href" in row ? (
                  <a href={row.href}>{row.value}</a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        <section className="ab-cta" aria-labelledby="ab-cta-title">
          <div className="ab-cta-inner">
            <div className="ab-cta-label">START YOUR JOURNEY</div>
            <h2 id="ab-cta-title" className="ab-cta-title">
              지금, 한 번의 부름
            </h2>
            <p className="ab-cta-desc">
              가입 즉시 음성 상담 3분 무료.
              <br />
              카드 등록 없이 시작할 수 있습니다.
            </p>
            <Link className="ab-cta-btn" href="/meet">
              무료로 상담 시작 →
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
