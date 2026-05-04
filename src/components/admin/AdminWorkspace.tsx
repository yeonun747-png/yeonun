"use client";

import { useEffect, useState } from "react";

const PANEL_IDS = ["dashboard", "content", "commerce", "voice", "fortune", "chat", "logs"] as const;
export type AdminPanelId = (typeof PANEL_IDS)[number];

const LABELS: Record<AdminPanelId, string> = {
  dashboard: "Dashboard",
  content: "Content",
  commerce: "Orders",
  voice: "Voice Ops",
  fortune: "Fortune Ops",
  chat: "Chat Ops",
  logs: "Logs",
};

export type AdminWorkspaceProps = Record<AdminPanelId, React.ReactNode>;

function scrollMainPanelToTop(id: AdminPanelId) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollTo(0, 0);
  });
}

export function AdminWorkspace(props: AdminWorkspaceProps) {
  const [panel, setPanel] = useState<AdminPanelId>("dashboard");

  useEffect(() => {
    const readHash = (): AdminPanelId => {
      const h = window.location.hash.slice(1) as AdminPanelId;
      return PANEL_IDS.includes(h) ? h : "dashboard";
    };
    setPanel(readHash());
    const onHash = () => setPanel(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  /** 우측 패널(스크롤 컨테이너)을 전환 시 맨 위로 */
  useEffect(() => {
    scrollMainPanelToTop(panel);
  }, [panel]);

  return (
    <div className="y-admin-shell">
      <aside className="y-admin-side">
        <div className="y-admin-brand">연운 管理</div>
        <p>운영, 결제, 점사, 음성·채팅 상담을 한 화면에서 관리합니다.</p>
        <nav className="y-admin-nav" aria-label="Admin menu">
          {PANEL_IDS.map((id) => (
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
        </nav>
      </aside>
      <div className="y-admin-main-wrap">
        {PANEL_IDS.map((id) => (
          <main
            key={id}
            className="y-admin-main y-admin-main-single"
            id={id}
            hidden={panel !== id}
          >
            {props[id]}
          </main>
        ))}
      </div>
    </div>
  );
}
