"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { useYeonunMember } from "@/components/auth/YeonunAuthProvider";
import { useMyShelfListsPreload } from "@/hooks/useMyShelfListsPreload";
import { BottomNav } from "@/components/BottomNav";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";
import { TopNav } from "@/components/TopNav";
import { MyCreditBalanceLine } from "@/components/my/MyCreditBalanceLine";
import { CallHistoryClient } from "@/components/history/CallHistoryClient";
import { LibraryListScreenClient } from "@/components/library/LibraryListScreenClient";
import { MyCreditOverviewSection } from "@/components/my/MyCreditOverviewSection";
import { MyLogoutMenuItemClient } from "@/components/my/MyLogoutMenuItemClient";
import { MyMemberProfileHeader } from "@/components/my/MyMemberProfileHeader";
import { MySajuCardBlock } from "@/components/my/MySajuCardBlock";
import { MySheetLink } from "@/components/my/MySheetLink";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";
import { MyWithdrawAccountMenuItemClient } from "@/components/my/MyWithdrawAccountMenuItemClient";

const MY_PREFETCH_ROUTES = [
  "/my",
  "/history/chats",
  "/my/payments",
  "/checkout/credit",
  "/settings/notifications",
  "/notices",
  "/support",
  "/today",
];

export function MyPageBody() {
  const member = useYeonunMember();
  const { fortuneSnapshot, voiceSnapshot } = useMyShelfListsPreload(!!member);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const shelf = sp.get("shelf");
  const shelfFortune = shelf === "fortune";
  const shelfVoice = shelf === "voice";
  const shelfOpen = shelfFortune || shelfVoice;
  const listBackHref = useMemo(() => {
    const b = sp.get("back");
    if (typeof b === "string" && b.startsWith("/") && !b.startsWith("//")) return b;
    return "/my";
  }, [sp]);

  const openAuthSheet = () => {
    const qs = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    qs.set("modal", "auth");
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  };

  return (
    <div className="yeonunPage">
      <RoutePrefetcher routes={MY_PREFETCH_ROUTES} />
      <TopNav />
      <main>
        {!member ? (
          <>
            <div className="y-my-guest-card">
              <div className="y-my-guest-content">
                <div className="y-my-guest-eyebrow">GUEST · 아직 로그인 전</div>
                <h1 className="y-my-guest-title">
                  사주를 한 번 입력하면
                  <br />
                  모든 인연이 기억합니다
                </h1>
                <p className="y-my-guest-desc">
                  가입은 30초. 그 후엔 4명이 당신의 사주를 알고
                  <br />
                  매일 새 한 마디를 보냅니다.
                </p>
                <div className="y-my-guest-actions">
                  <button type="button" className="y-my-login-btn" onClick={openAuthSheet}>
                    가입하기
                  </button>
                  <button type="button" className="y-my-signup-btn" onClick={openAuthSheet}>
                    로그인
                  </button>
                </div>
              </div>
            </div>

            <div className="y-my-foot" aria-label="약관">
              <Link href="/legal/terms" className="y-my-foot-link">
                이용약관
              </Link>
              <span style={{ color: "var(--y-line-2)" }}>·</span>
              <Link href="/legal/privacy" className="y-my-foot-link">
                개인정보처리방침
              </Link>
            </div>
          </>
        ) : (
          <>
            <MyMemberProfileHeader />

            <MySajuCardBlock />

            <MyCreditOverviewSection />

            <div className="y-my-menu-section">
              <div className="y-my-menu-section-title">콘텐츠</div>
              <MySheetLink className="y-my-menu-item" href="/my?shelf=fortune">
                <div className="y-my-menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="y-my-menu-text">
                  <div className="y-my-menu-name">점사 보관함</div>
                  <div className="y-my-menu-desc">구매한 풀이 60일간 보관</div>
                </div>
                <span className="y-my-menu-arrow">›</span>
              </MySheetLink>
              <MySheetLink className="y-my-menu-item" href="/my?shelf=voice">
                <div className="y-my-menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
                    <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
                  </svg>
                </div>
                <div className="y-my-menu-text">
                  <div className="y-my-menu-name">음성상담 보관함</div>
                  <div className="y-my-menu-desc">60일간 보관 · 대화 글 열람</div>
                </div>
                <span className="y-my-menu-arrow">›</span>
              </MySheetLink>
              <MySheetLink className="y-my-menu-item" href="/history/chats">
                <div className="y-my-menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                  </svg>
                </div>
                <div className="y-my-menu-text">
                  <div className="y-my-menu-name">채팅상담 보관함</div>
                  <div className="y-my-menu-desc">30일간 보관 · 크레딧 상담 기록</div>
                </div>
                <span className="y-my-menu-arrow">›</span>
              </MySheetLink>
            </div>

            <div className="y-my-menu-section">
              <div className="y-my-menu-section-title">결제·멤버십</div>
              <MySheetLink className="y-my-menu-item" href="/my/payments">
                <div className="y-my-menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <div className="y-my-menu-text">
                  <div className="y-my-menu-name">결제 내역</div>
                  <div className="y-my-menu-desc">최근 12개월</div>
                </div>
                <span className="y-my-menu-arrow">›</span>
              </MySheetLink>
              <MySheetLink className="y-my-menu-item" href="/checkout/credit">
                <div className="y-my-menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div className="y-my-menu-text">
                  <div className="y-my-menu-name">크레딧 충전</div>
                  <div className="y-my-menu-desc">
                    <MyCreditBalanceLine />
                  </div>
                </div>
                <span className="y-my-menu-arrow">›</span>
              </MySheetLink>
            </div>

            <div className="y-my-menu-section">
              <div className="y-my-menu-section-title">설정</div>
              <MySheetLink className="y-my-menu-item" href="/settings/notifications">
                <div className="y-my-menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div className="y-my-menu-text">
                  <div className="y-my-menu-name">알림 설정</div>
                  <div className="y-my-menu-desc">매일 한 마디 · 길조 알림</div>
                </div>
                <span className="y-my-menu-arrow">›</span>
              </MySheetLink>
              <MySheetLink className="y-my-menu-item" href="/notices">
                <div className="y-my-menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="y-my-menu-text">
                  <div className="y-my-menu-name">공지사항</div>
                  <div className="y-my-menu-desc">2026 신년 이벤트 외 3건</div>
                </div>
                <span className="y-my-menu-badge">3</span>
                <span className="y-my-menu-arrow">›</span>
              </MySheetLink>
              <MySheetLink className="y-my-menu-item" href="/support">
                <div className="y-my-menu-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div className="y-my-menu-text">
                  <div className="y-my-menu-name">고객센터</div>
                  <div className="y-my-menu-desc">카카오톡 채널 · 이메일</div>
                </div>
                <span className="y-my-menu-arrow">›</span>
              </MySheetLink>

              <MyLogoutMenuItemClient />
              <MyWithdrawAccountMenuItemClient />
            </div>

            <div className="y-my-foot" aria-label="약관">
              <Link href="/legal/terms" className="y-my-foot-link">
                이용약관
              </Link>
              <span style={{ color: "var(--y-line-2)" }}>·</span>
              <Link href="/legal/privacy" className="y-my-foot-link">
                개인정보처리방침
              </Link>
              <div className="y-my-version">연운 v1.0.0 (2026.04.26)</div>
            </div>
          </>
        )}

        <div style={{ height: 80 }} />
      </main>
      <BottomNav />
      {member && shelfOpen ? (
        <>
          <MyTabBackdrop />
          {shelfFortune ? <LibraryListScreenClient backHref={listBackHref} fortuneSnapshot={fortuneSnapshot} /> : null}
          {shelfVoice ? <CallHistoryClient voiceSnapshot={voiceSnapshot} /> : null}
        </>
      ) : null}
    </div>
  );
}
