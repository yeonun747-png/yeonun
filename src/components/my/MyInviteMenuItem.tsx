"use client";

import { MySheetLink } from "@/components/my/MySheetLink";
import { REFERRAL_REWARD_CREDITS } from "@/lib/daily-missions";

const rewardLabel = REFERRAL_REWARD_CREDITS.toLocaleString("ko-KR");

export function MyInviteMenuItem() {
  return (
    <MySheetLink className="y-my-menu-item" href="/invite">
      <div className="y-my-menu-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <div className="y-my-menu-text">
        <div className="y-my-menu-name">친구 초대</div>
        <div className="y-my-menu-desc">친구와 나 각 {rewardLabel} 크레딧</div>
      </div>
      <span className="y-my-menu-arrow">›</span>
    </MySheetLink>
  );
}
