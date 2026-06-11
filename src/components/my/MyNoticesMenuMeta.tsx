"use client";

import { useCallback, useEffect, useState } from "react";

import {
  NOTICE_READS_CHANGED_EVENT,
  noticeMenuMeta,
  type NoticeReadItem,
} from "@/lib/notice-reads";

type Props = {
  fallbackDesc?: string;
};

/** 마이탭 공지 메뉴 행 — 부제 + 안 읽음 배지 (형제 flex 배치) */
export function MyNoticesMenuItemContent({ fallbackDesc = "이벤트 · 운영 안내" }: Props) {
  const [meta, setMeta] = useState({ unreadCount: 0, desc: fallbackDesc });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notices", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { notices?: NoticeReadItem[] };
      const notices: NoticeReadItem[] = (data.notices ?? []).map((n) => ({
        slug: n.slug,
        title: n.title,
        showNewDot: n.showNewDot,
        publishedOn: n.publishedOn,
      }));
      setMeta(noticeMenuMeta(notices));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onReadsChanged = () => void refresh();
    window.addEventListener(NOTICE_READS_CHANGED_EVENT, onReadsChanged);
    window.addEventListener("focus", onReadsChanged);
    return () => {
      window.removeEventListener(NOTICE_READS_CHANGED_EVENT, onReadsChanged);
      window.removeEventListener("focus", onReadsChanged);
    };
  }, [refresh]);

  return (
    <>
      <div className="y-my-menu-text">
        <div className="y-my-menu-name">공지사항</div>
        <div className="y-my-menu-desc">{meta.desc}</div>
      </div>
      {meta.unreadCount > 0 ? (
        <span className="y-my-menu-badge" aria-label={`읽지 않은 공지 ${meta.unreadCount}건`}>
          {meta.unreadCount}
        </span>
      ) : null}
    </>
  );
}
