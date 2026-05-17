"use client";

import { useEffect, useState } from "react";

const PANEL_IDS = ["dashboard", "content", "reviews", "notices", "commerce", "credits", "voice", "fortune", "chat", "logs"] as const;
export type AdminPanelId = (typeof PANEL_IDS)[number];

const LABELS: Record<AdminPanelId, string> = {
  dashboard: "Dashboard",
  content: "Content",
  reviews: "Reviews",
  notices: "Notices",
  commerce: "Orders",
  credits: "C/S Credits",
  voice: "Voice Ops",
  fortune: "Fortune Ops",
  chat: "Chat Ops",
  logs: "Logs",
};

const NAV_GROUPS: { section: string; items: AdminPanelId[] }[] = [
  { section: "메인", items: ["dashboard", "content", "reviews", "notices"] },
  { section: "운영", items: ["commerce", "credits", "voice", "fortune", "chat"] },
  { section: "시스템", items: ["logs"] },
];

export type AdminWorkspaceProps = Record<AdminPanelId, React.ReactNode>;

function scrollMainPanelToTop(id: AdminPanelId) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollTo(0, 0);
  });
}

function readPanelFromHash(): AdminPanelId {
  if (typeof window === "undefined") return "dashboard";
  const h = window.location.hash.slice(1) as AdminPanelId;
  return PANEL_IDS.includes(h) ? h : "dashboard";
}

export function AdminWorkspace(props: AdminWorkspaceProps) {
  const [panel, setPanel] = useState<AdminPanelId>(readPanelFromHash);

  useEffect(() => {
    const onHash = () => setPanel(readPanelFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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
              {g.items.map((id) => (
                <a
                  key={id}
                  href={`#${id}`}
                  data-active={panel === id ? "true" : undefined}
                  aria-current={panel === id ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setPanel(id);
                    window.location.hash = id;
                    scrollMainPanelToTop(id);
                  }}
                >
                  {LABELS[id]}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <form action="/admin/logout" method="post" className="y-admin-side-logout">
          <button type="submit">로그아웃</button>
        </form>
      </aside>
      <div className="y-admin-main-wrap y-admin-main-wrap--v2">
        {PANEL_IDS.map((id) => (
          <main key={id} className="y-admin-main y-admin-main-single y-admin-main--v2" id={id} hidden={panel !== id}>
            {props[id]}
          </main>
        ))}
      </div>
    </div>
  );
}
