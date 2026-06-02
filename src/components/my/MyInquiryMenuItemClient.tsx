"use client";

import { useCallback, useEffect, useState } from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { MyInquiryModal } from "@/components/my/MyInquiryModal";
import { getStoredGuestInquiryEmail } from "@/lib/guest-inquiry-session";
import { YEONUN_MY_INQUIRIES_CHANGED } from "@/lib/my-inquiry-events";

export function MyInquiryMenuItemClient() {
  const { user, session } = useYeonunAuth();
  const accessToken = session?.access_token ?? null;
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (user && accessToken) {
      try {
        const res = await fetch("/api/my/inquiries/history", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
        }
      } catch {
        /* ignore */
      }
      return;
    }

    const guestEmail = getStoredGuestInquiryEmail();
    if (!guestEmail) {
      setUnreadCount(0);
      return;
    }

    try {
      const res = await fetch("/api/my/inquiries/guest-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestEmail }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      }
    } catch {
      /* ignore */
    }
  }, [accessToken, user]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    const onChange = () => void refreshUnread();
    window.addEventListener(YEONUN_MY_INQUIRIES_CHANGED, onChange);
    return () => window.removeEventListener(YEONUN_MY_INQUIRIES_CHANGED, onChange);
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) void refreshUnread();
  }, [open, refreshUnread]);

  return (
    <>
      <button type="button" className="y-my-menu-item" onClick={() => setOpen(true)} aria-label="문의하기">
        <div className="y-my-menu-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="y-my-menu-text">
          <div className="y-my-menu-name">
            문의하기
            {unreadCount > 0 ? (
              <span className="y-my-inquiry-menu-badge" aria-label={`새 답변 ${unreadCount}건`}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </div>
          <div className="y-my-menu-desc">
            {unreadCount > 0 ? `새 답변 ${unreadCount}건 · 내 문의 확인` : "접수 내역 · 답변 확인"}
          </div>
        </div>
        <span className="y-my-menu-arrow">›</span>
      </button>
      {open ? (
        <MyInquiryModal
          onDismiss={() => {
            setOpen(false);
            void refreshUnread();
          }}
        />
      ) : null}
    </>
  );
}
