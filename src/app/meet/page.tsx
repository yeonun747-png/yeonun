import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { getCharacters } from "@/lib/data/characters";
import Link from "next/link";

const PRESETS = [
  "그 사람과 다시 만날 수 있을까요",
  "올해 운세가 어때요",
  "이직해도 될까요",
  "아이 이름을 짓고 싶어요",
  "이 꿈이 무슨 의미인가요",
];

export default async function MeetPage() {
  const characters = await getCharacters();

  return (
    <div className="yeonunPage">
      <TopNav />
      <main>
        <div className="y-meet-hero">
          <div className="y-meet-eyebrow">VOICE · 지금 곁에 있어요</div>
          <h1 className="y-meet-title">
            어떤 마음으로
            <br />
            오셨나요?
          </h1>
          <p className="y-meet-sub">4명 모두 상담 가능합니다. 처음 3분은 무료.</p>
        </div>

        <div className="y-meet-presets" aria-label="이렇게 시작해보세요">
          <div className="y-meet-presets-title">이렇게 시작해보세요</div>
          <div className="y-meet-presets-scroll">
            <div className="y-meet-presets-track">
              {PRESETS.map((t) => (
                <button key={t} className="y-preset-chip" type="button">
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="y-meet-list" aria-label="인연 안내자 목록">
          {characters.map((c) => (
            <article key={c.key} className={`y-meet-card ${c.key}`}>
              <div className="y-meet-card-visual">
                <div className="y-meet-status">
                  <span className="pulse" aria-hidden="true" />
                  지금 가능
                </div>
                <div className="y-meet-han" aria-hidden="true">
                  {c.han}
                </div>
                <div className="y-meet-card-name-block">
                  <span className="y-meet-card-spec">{c.spec}</span>
                  <div className="y-meet-card-name">{c.name}</div>
                  <div className="y-meet-card-en">{c.en}</div>
                </div>
              </div>
              <div className="y-meet-card-meta">
                <p className="y-meet-quote">{c.greeting}</p>
                <div className="y-meet-tags">#재회 #짝사랑 #이별후 #그사람마음</div>
                <div className="y-meet-actions">
                  <Link className="y-meet-call-btn" href={`/call?character_key=${encodeURIComponent(c.key)}`}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
                      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
                    </svg>
                    음성상담 · 무료 3분
                  </Link>
                  <Link className="y-meet-detail-btn" href={`/characters/${c.key}?sheet=1&from=meet`} scroll={false}>
                    자세히 보기
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="y-guest-notice" aria-label="로그인 안내">
          <div className="y-guest-notice-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21 a8 8 0 0 1 16 0" />
            </svg>
          </div>
          <div className="y-guest-notice-title">로그인하면 대화가 이어집니다</div>
          <div className="y-guest-notice-desc">
            어제 우리가 했던 이야기, 그 사람의 이름,
            <br />
            다음 상담에서 자연스럽게 이어집니다.
          </div>
          <Link className="y-guest-notice-btn" href="/meet?modal=auth">
            로그인 / 가입하기
          </Link>
        </div>

        <div style={{ height: 80 }} />
      </main>
      <BottomNav />
    </div>
  );
}

