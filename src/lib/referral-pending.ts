export const REFERRAL_PENDING_KEY = "yeonun_pending_referral_v1";
export const REFERRAL_PENDING_COOKIE = "yeonun_ref_pending";
export const M08_ASSIGNED_KST_KEY = "yeonun_m08_assigned_kst_v1";

export type PendingReferral = { code: string; assigned_kst_date: string };

function formatTodayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function writeReferralCookie(payload: PendingReferral) {
  if (typeof document === "undefined") return;
  try {
    const val = encodeURIComponent(JSON.stringify(payload));
    document.cookie = `${REFERRAL_PENDING_COOKIE}=${val}; path=/; max-age=604800; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function storePendingReferral(code: string, assignedKstDate: string) {
  if (typeof window === "undefined") return;
  const payload: PendingReferral = {
    code: code.trim().toUpperCase(),
    assigned_kst_date: assignedKstDate,
  };
  try {
    localStorage.setItem(REFERRAL_PENDING_KEY, JSON.stringify(payload));
    sessionStorage.setItem(REFERRAL_PENDING_KEY, JSON.stringify(payload));
    writeReferralCookie(payload);
  } catch {
    /* ignore */
  }
}

export function readPendingReferral(): PendingReferral | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REFERRAL_PENDING_KEY) ?? sessionStorage.getItem(REFERRAL_PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { code?: string; assigned_kst_date?: string };
    const code = String(p.code ?? "").trim();
    const assigned = String(p.assigned_kst_date ?? "").trim();
    if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(assigned)) return null;
    return { code, assigned_kst_date: assigned };
  } catch {
    return null;
  }
}

export function clearPendingReferral() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(REFERRAL_PENDING_KEY);
    sessionStorage.removeItem(REFERRAL_PENDING_KEY);
    document.cookie = `${REFERRAL_PENDING_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref")?.trim();
    if (!ref) return;
    const assigned = params.get("m08_kst")?.trim() || formatTodayKst();
    storePendingReferral(ref, assigned);
  } catch {
    /* ignore */
  }
}

export function setM08AssignedKstIfNeeded(inTrio: boolean) {
  if (!inTrio || typeof window === "undefined") return;
  try {
    localStorage.setItem(M08_ASSIGNED_KST_KEY, formatTodayKst());
  } catch {
    /* ignore */
  }
}

export function readM08AssignedKst(): string {
  if (typeof window === "undefined") return formatTodayKst();
  try {
    const v = localStorage.getItem(M08_ASSIGNED_KST_KEY);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  } catch {
    /* ignore */
  }
  return formatTodayKst();
}

/** 서버 OAuth 콜백용 — 쿠키에서 초대 코드 읽기 */
export function parseReferralPendingCookie(raw: string | undefined): PendingReferral | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(decodeURIComponent(raw.trim())) as { code?: string; assigned_kst_date?: string };
    const code = String(p.code ?? "").trim().toUpperCase();
    const assigned = String(p.assigned_kst_date ?? "").trim();
    if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(assigned)) return null;
    return { code, assigned_kst_date: assigned };
  } catch {
    return null;
  }
}
