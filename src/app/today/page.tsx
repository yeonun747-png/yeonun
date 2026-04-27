import Link from "next/link";

import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";

export default function TodayPage() {
  return (
    <div className="yeonunPage">
      <TopNav />
      <main>
        <div className="y-today-header">
          <div className="y-today-date">SUN, APR 26 · 2026</div>
          <div className="y-today-date-ko">2026년 4월 26일 일요일</div>
          <div className="y-today-lunar">음력 2월 9일 · 병오년(丙午年) 임진월(壬辰月)</div>
        </div>

        <div className="y-iljin-card">
          <div className="y-iljin-content">
            <div className="y-iljin-label">TODAY · 오늘의 일진</div>
            <div className="y-iljin-cheon">
              <span className="y-iljin-han">癸亥</span>
              <span className="y-iljin-name">계해일</span>
            </div>
            <p className="y-iljin-msg">깊은 물의 기운이 흐르는 날. 충동보다 침묵이 답입니다.</p>
            <div className="y-iljin-tags">
              <span className="y-iljin-tag">#침묵의날</span>
              <span className="y-iljin-tag">#깊이</span>
              <span className="y-iljin-tag">#기다림</span>
            </div>
          </div>
        </div>

        <div className="y-luck-grid" aria-label="오늘의 행운">
          <div className="y-luck-tile color">
            <div className="y-luck-icon">色</div>
            <div className="y-luck-text">
              <div className="y-luck-label">오늘의 색</div>
              <div className="y-luck-value">옅은 분홍</div>
            </div>
          </div>
          <div className="y-luck-tile number">
            <div className="y-luck-icon">數</div>
            <div className="y-luck-text">
              <div className="y-luck-label">오늘의 숫자</div>
              <div className="y-luck-value">3 · 7</div>
            </div>
          </div>
          <div className="y-luck-tile dir">
            <div className="y-luck-icon">向</div>
            <div className="y-luck-text">
              <div className="y-luck-label">길한 방향</div>
              <div className="y-luck-value">남동쪽</div>
            </div>
          </div>
          <div className="y-luck-tile food">
            <div className="y-luck-icon">膳</div>
            <div className="y-luck-text">
              <div className="y-luck-label">길조 음식</div>
              <div className="y-luck-value">따뜻한 차</div>
            </div>
          </div>
        </div>

        <div className="y-daily-words-section" aria-label="오늘의 한 마디">
          <div className="ySectionHead" style={{ padding: "0 20px 14px" }}>
            <h2 className="ySectionTitle">
              <span className="hash">#</span> 오늘의 한 마디
            </h2>
            <span className="ySectionMore" style={{ cursor: "default" }}>
              04.26
            </span>
          </div>
          <div className="y-daily-words-grid">
            {[
              { key: "yeon", han: "蓮", name: "연화에게서", text: "그 사람도 오늘 같은 마음이에요. 먼저 다가갈 필요는 없지만, 닫지도 말아요." },
              { key: "byeol", han: "星", name: "별하에게서", text: "오늘 별의 자리가 흔들려요. 큰 결정은 내일로 미뤄도 늦지 않아요." },
              { key: "yeo", han: "麗", name: "여연에게서", text: "계해의 깊은 물처럼 오늘은 듣는 날입니다. 답은 그다음에 옵니다." },
              { key: "un", han: "雲", name: "운서에게서", text: "오늘 본 꿈, 잊지 마세요. 한 글자씩 적어두면 사주의 흐름이 보여요." },
            ].map((w) => (
              <div key={w.key} className="y-daily-word-card">
                <div className="y-dw-head">
                  <div className={`y-dw-avatar ${w.key}`}>{w.han}</div>
                  <div className="y-dw-name">{w.name}</div>
                </div>
                <div className="y-dw-text">{w.text}</div>
                <div className="y-dw-listen">목소리로 듣기</div>
              </div>
            ))}
          </div>
        </div>

        <div className="y-attendance" aria-label="매일 출석">
          <div className="y-att-head">
            <div className="y-att-title">
              매일 출석 <span className="y-att-streak">🔥 3일 연속</span>
            </div>
            <div className="y-att-progress">7일 달성까지 4일</div>
          </div>
          <div className="y-att-row">
            <div className="y-att-day">
              <div className="y-att-day-label">1일</div>
              <div className="y-att-stamp done">✓</div>
            </div>
            <div className="y-att-day">
              <div className="y-att-day-label">2일</div>
              <div className="y-att-stamp done">✓</div>
            </div>
            <div className="y-att-day">
              <div className="y-att-day-label">3일</div>
              <div className="y-att-stamp done">✓</div>
            </div>
            <div className="y-att-day">
              <div className="y-att-day-label">4일</div>
              <div className="y-att-stamp today">!</div>
            </div>
            <div className="y-att-day">
              <div className="y-att-day-label">5일</div>
              <div className="y-att-stamp">·</div>
            </div>
            <div className="y-att-day">
              <div className="y-att-day-label">6일</div>
              <div className="y-att-stamp">·</div>
            </div>
            <div className="y-att-day">
              <div className="y-att-day-label">7일</div>
              <div className="y-att-stamp">·</div>
            </div>
          </div>
          <div className="y-att-reward">
            <strong>7일 연속 달성 보상: 음성 상담 5분 추가</strong>
            <div style={{ marginTop: 4, fontSize: 10.5, color: "var(--y-mute)" }}>
              하루라도 빠지면 1일부터 다시 시작 · 사이클마다 보상이 바뀝니다
            </div>
          </div>
        </div>

        <div className="y-mission-section" aria-label="오늘의 미션">
          <div className="y-mission-title">오늘의 미션</div>
          <div className="y-mission-list">
            <Link className="y-mission-item" href="/today?modal=saju">
              <div className="y-mission-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                </svg>
              </div>
              <div className="y-mission-text">
                <div className="y-mission-name">내 사주 입력하기</div>
                <div className="y-mission-reward">완료 시 만세력 + 평생사주 5,000원 할인</div>
              </div>
              <span className="y-mission-status todo">시작</span>
            </Link>
            <div className="y-mission-item">
              <div className="y-mission-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
                  <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
                </svg>
              </div>
              <div className="y-mission-text">
                <div className="y-mission-name">첫 음성 상담 (3분 무료)</div>
                <div className="y-mission-reward">완료 시 음성 5분 추가</div>
              </div>
              <span className="y-mission-status todo">시작</span>
            </div>
            <div className="y-mission-item">
              <div className="y-mission-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <div className="y-mission-text">
                <div className="y-mission-name">관심 인연 1명 선택</div>
                <div className="y-mission-reward">전담 인연 안내자가 매일 한 마디 보냅니다</div>
              </div>
              <span className="y-mission-status done">완료</span>
            </div>
          </div>
          <div className="y-mission-foot">
            <span>매일 자정에 새로운 미션이 갱신됩니다 · 완료 시 즉시 보상 적립</span>
          </div>
        </div>

        <div style={{ height: 80 }} />
      </main>
      <BottomNav />
    </div>
  );
}

