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
