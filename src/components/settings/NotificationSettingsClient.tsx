"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { TopNav } from "@/components/TopNav";

const TIME_CHIPS: { label: string; sub: string }[] = [
  { label: "오전 6시", sub: "이른 아침" },
  { label: "오전 7시", sub: "아침" },
  { label: "오전 8시", sub: "현재 설정" },
  { label: "오전 9시", sub: "출근 시간" },
  { label: "오전 10시", sub: "오전 중" },
  { label: "오전 11시", sub: "오전 중" },
  { label: "오후 12시", sub: "점심" },
  { label: "오후 1시", sub: "점심 후" },
  { label: "오후 6시", sub: "퇴근 시간" },
  { label: "오후 9시", sub: "저녁" },
];

export function NotificationSettingsClient() {
  const [step, setStep] = useState<"main" | "time">("main");
  const [activeTimeIdx, setActiveTimeIdx] = useState(2);
  const [toggles, setToggles] = useState({
    dailyWord: true,
    iljin: true,
    attendance: true,
    promo: false,
    archiveExpire: true,
  });

  const toggle = useCallback((key: keyof typeof toggles) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const timeLabel = TIME_CHIPS[activeTimeIdx]?.label ?? "오전 8시";

  return (
    <div className="yeonunPage">
      <TopNav />
      <header className="y-page-sub-head">
        <Link href="/my" className="y-page-sub-back" aria-label="마이로">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Link>
        <h1 className="y-page-sub-title">{step === "main" ? "알림 설정" : "알림 시간"}</h1>
        <span className="y-page-sub-spacer" aria-hidden />
      </header>

      <div className="y-sub-scroll-page">
        {step === "main" ? (
          <>
            <div className="y-noti-section">
              <div className="y-noti-section-title">매일 받는 알림</div>
              <div className="y-noti-item">
                <div className="y-noti-info">
                  <div className="y-noti-name">오늘의 한 마디</div>
                  <div className="y-noti-desc">인연 안내자가 보내는 매일 아침 메시지</div>
                </div>
                <button
                  type="button"
                  className={`y-noti-toggle${toggles.dailyWord ? " on" : ""}`}
                  aria-pressed={toggles.dailyWord}
                  onClick={() => toggle("dailyWord")}
                />
              </div>
              <div className="y-noti-item">
                <div className="y-noti-info">
                  <div className="y-noti-name">알림 시간</div>
                  <div className="y-noti-desc">매일 {timeLabel} 00분</div>
                </div>
                <button type="button" className="y-noti-time-btn" onClick={() => setStep("time")}>
                  변경
                </button>
              </div>
              <div className="y-noti-item">
                <div className="y-noti-info">
                  <div className="y-noti-name">오늘의 일진</div>
                  <div className="y-noti-desc">매일 아침 오늘의 운기 요약</div>
                </div>
                <button
                  type="button"
                  className={`y-noti-toggle${toggles.iljin ? " on" : ""}`}
                  aria-pressed={toggles.iljin}
                  onClick={() => toggle("iljin")}
                />
              </div>
            </div>
            <div className="y-noti-section">
              <div className="y-noti-section-title">이벤트·혜택</div>
              <div className="y-noti-item">
                <div className="y-noti-info">
                  <div className="y-noti-name">출석 보상 알림</div>
                  <div className="y-noti-desc">7일 연속 달성 시 보상 안내</div>
                </div>
                <button
                  type="button"
                  className={`y-noti-toggle${toggles.attendance ? " on" : ""}`}
                  aria-pressed={toggles.attendance}
                  onClick={() => toggle("attendance")}
                />
              </div>
              <div className="y-noti-item">
                <div className="y-noti-info">
                  <div className="y-noti-name">이벤트·프로모션</div>
                  <div className="y-noti-desc">절기·신년 특별 이벤트 안내</div>
                </div>
                <button
                  type="button"
                  className={`y-noti-toggle${toggles.promo ? " on" : ""}`}
                  aria-pressed={toggles.promo}
                  onClick={() => toggle("promo")}
                />
              </div>
            </div>
            <div className="y-noti-section">
              <div className="y-noti-section-title">보관함</div>
              <div className="y-noti-item">
                <div className="y-noti-info">
                  <div className="y-noti-name">풀이 만료 알림</div>
                  <div className="y-noti-desc">보관함 풀이 만료 7일 전 알림</div>
                </div>
                <button
                  type="button"
                  className={`y-noti-toggle${toggles.archiveExpire ? " on" : ""}`}
                  aria-pressed={toggles.archiveExpire}
                  onClick={() => toggle("archiveExpire")}
                />
              </div>
            </div>
            <p className="y-noti-foot">계정 연동 후 서버에 저장됩니다 · 할인 쿠폰은 동시 1매 보유</p>
            <div style={{ height: 40 }} />
          </>
        ) : (
          <>
            <button type="button" className="y-pay-detail-back" onClick={() => setStep("main")}>
              ← 알림 설정
            </button>
            <div className="y-noti-time-intro">매일 한 마디와 오늘의 일진을 받을 시간을 선택하세요.</div>
            <div className="y-noti-time-grid">
              {TIME_CHIPS.map((t, i) => (
                <button
                  key={t.label}
                  type="button"
                  className={`y-noti-time-chip${i === activeTimeIdx ? " active" : ""}`}
                  onClick={() => setActiveTimeIdx(i)}
                >
                  {t.label}
                  <span className="sub">{t.sub}</span>
                </button>
              ))}
            </div>
            <button type="button" className="y-noti-time-save" onClick={() => setStep("main")}>
              저장하기
            </button>
            <div style={{ height: 32 }} />
          </>
        )}
      </div>
    </div>
  );
}
