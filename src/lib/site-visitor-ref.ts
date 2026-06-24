const LS_KEY = "yeonun_site_visitor_ref_v1";

/** 사이트 방문자 식별 — 로그인 전 단말별 익명 ID */
export function getOrCreateSiteVisitorRef(): string {
  if (typeof window === "undefined") return "guest";
  try {
    let v = localStorage.getItem(LS_KEY);
    if (!v?.trim()) {
      v = `visitor_${crypto.randomUUID()}`;
      localStorage.setItem(LS_KEY, v);
    }
    return v.trim();
  } catch {
    return "guest";
  }
}
