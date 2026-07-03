"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

const PANEL_IDS = [
  "dashboard",
  "content",
  "reviews",
  "notices",
  "commerce",
  "inquiries",
  "signups",
  "credits",
  "voice",
  "fortune",
  "chat",
  "logs",
] as const;
export type AdminPanelId = (typeof PANEL_IDS)[number];

const LABELS: Record<AdminPanelId, string> = {
  dashboard: "대시보드",
  content: "콘텐츠",
  reviews: "리뷰",
  notices: "공지",
  commerce: "주문·결제",
  inquiries: "고객 문의",
  signups: "회원 가입 현황",
  credits: "C/S 크레딧",
  voice: "음성 운영",
  fortune: "점사 운영",
  chat: "채팅 운영",
  logs: "로그",
};

const NAV_GROUPS: { section: string; items: AdminPanelId[] }[] = [
  { section: "메인", items: ["dashboard", "content", "reviews", "notices"] },
  { section: "운영", items: ["commerce", "inquiries", "signups", "credits", "voice", "fortune", "chat"] },
  { section: "시스템", items: ["logs"] },
];

export type AdminWorkspaceProps = Record<AdminPanelId, React.ReactNode> & {
  navBadges?: Partial<Record<AdminPanelId, number>>;
};

function scrollMainPanelToTop(id: AdminPanelId) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollTo(0, 0);
  });
}

function readPanelFromHash(): AdminPanelId {
  const raw = window.location.hash.slice(1);
  const id = raw.split("?")[0] as AdminPanelId;
  return PANEL_IDS.includes(id) ? id : "dashboard";
}

function subscribePanelHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getPanelServerSnapshot(): AdminPanelId {
  return "dashboard";
}

export function AdminWorkspace({ navBadges, ...props }: AdminWorkspaceProps) {
  const panel = useSyncExternalStore(subscribePanelHash, readPanelFromHash, getPanelServerSnapshot);

  useEffect(() => {
    scrollMainPanelToTop(panel);
  }, [panel]);

  return (
    <div className="y-admin-shell y-admin-shell--v2">
      <aside className="y-admin-side y-admin-side--v2">
        <div className="y-admin-brand-v2">
          <h1>연운 管理</h1>
          <p>
            운영, 결제, 점사,
            <br />
            음성·채팅을 관리합니다.
          </p>
        </div>
        <nav className="y-admin-nav-v2" aria-label="Admin menu">
          {NAV_GROUPS.map((g) => (
            <div key={g.section} className="y-admin-nav-v2-group">
              <div className="y-admin-nav-v2-section">{g.section}</div>
              {g.items.map((id) => {
                const badge = navBadges?.[id];
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    data-active={panel === id ? "true" : undefined}
                    aria-current={panel === id ? "page" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.hash = id;
                      scrollMainPanelToTop(id);
                    }}
                  >
                    {LABELS[id]}
                    {badge && badge > 0 ? <span className="y-admin-nav-badge">{badge}</span> : null}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        <form action="/admin/logout" method="post" className="y-admin-side-logout">
          <button type="submit" className="y-admin-btn-ink">
            로그아웃
          </button>
        </form>
      </aside>
      <div className="y-admin-main-wrap y-admin-main-wrap--v2">
        {PANEL_IDS.map((id) =>
          panel === id ? (
            <main key={id} className="y-admin-main y-admin-main-single y-admin-main--v2" id={id}>
              {props[id]}
            </main>
          ) : null,
        )}
      </div>
    </div>
  );
}
