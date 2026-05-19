/** M05 — 꿈해몽 무료권 보유 시 미션 풀·표시에서 제외 */

export const DREAM_PASS_ACTIVE_KEY = "yeonun_dream_pass_active_v1";

export function setDreamPassActiveForM05Pool(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DREAM_PASS_ACTIVE_KEY, active ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function m05EligibleForPool(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(DREAM_PASS_ACTIVE_KEY) !== "1";
  } catch {
    return true;
  }
}

export async function syncDreamPassActiveFromCoupons(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch("/api/my/coupons", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      coupons?: { kind: string }[];
    };
    const active = Boolean(res.ok && data.ok && data.coupons?.some((c) => c.kind === "dream_free"));
    setDreamPassActiveForM05Pool(active);
    return active;
  } catch {
    return m05EligibleForPool();
  }
}
