import Link from "next/link";

import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { TodayDailyWordsGate } from "@/components/today/TodayDailyWordsGate";
import { TodayForYouCta } from "@/components/today/TodayForYouCta";
import { TodayIljinAndLuckClient } from "@/components/today/TodayIljinAndLuckClient";
import { formatKstConsultHeaderEn, formatKstConsultHeaderKo, formatKstMonthDayDot } from "@/lib/datetime/kst";
import { formatKstTodayLunarHeader } from "@/lib/datetime/kst-lunar";
import { getTodayPublicIljin, getTodayPublicLuck } from "@/lib/today-kst-public";

export default function TodayPage() {
  const now = new Date();
  const kstEn = formatKstConsultHeaderEn(now);
  const kstKo = formatKstConsultHeaderKo(now);
  const kstMd = formatKstMonthDayDot(now);
  const kstLunar = formatKstTodayLunarHeader(now);
  const iljin = getTodayPublicIljin(now);
  const luck = getTodayPublicLuck(now);

  return (
    <div className="yeonunPage">
      <TopNav />
      <main>
        <div className="y-today-header">
          <div className="y-today-date">{kstEn}</div>
          <div className="y-today-date-ko">{kstKo}</div>
          <div className="y-today-lunar">{kstLunar}</div>
        </div>

        <TodayIljinAndLuckClient fallbackIljin={iljin} fallbackLuck={luck} between={<TodayForYouCta />} />

        <TodayDailyWordsGate kstMd={kstMd} />

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
            <Link className="y-mission-item" href="/my?modal=saju">
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

