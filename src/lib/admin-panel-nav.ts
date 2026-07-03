import type { AdminPanelId } from "@/components/admin/AdminWorkspace";

export function readAdminPanelHashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const raw = window.location.hash.slice(1);
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  return new URLSearchParams(q);
}

export function navigateAdminPanel(id: AdminPanelId, params?: Record<string, string>) {
  const sp = new URLSearchParams(params);
  const qs = sp.toString();
  window.location.hash = qs ? `${id}?${qs}` : id;
}

function getAdminScrollContainer(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(".y-admin-main-wrap--v2") ??
    document.querySelector<HTMLElement>(".y-admin-main-wrap")
  );
}

function scrollToAdminAnchor(anchorId: string) {
  const el = document.getElementById(anchorId);
  if (!el) return;
  const container = getAdminScrollContainer();
  if (container) {
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const top = container.scrollTop + (elRect.top - containerRect.top) - 12;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function scrollAdminPanelAnchor(anchorId: string, panel: AdminPanelId = "dashboard") {
  const run = () => scrollToAdminAnchor(anchorId);
  const current = window.location.hash.slice(1).split("?")[0];
  if (!current || current === panel) {
    requestAnimationFrame(run);
    return;
  }
  navigateAdminPanel(panel);
  window.setTimeout(run, 200);
}
