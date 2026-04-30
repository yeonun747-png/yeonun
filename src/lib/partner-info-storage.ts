/** sessionStorage — 결제 후 상대(추가) 명식 입력값 */

export const PARTNER_INFO_STORAGE_PREFIX = "yeonun_partner_draft";

export function partnerInfoStorageKey(productSlug: string) {
  return `${PARTNER_INFO_STORAGE_PREFIX}_${productSlug}`;
}

export type PartnerInfoPayload = {
  name: string;
  relation: string;
  y: number;
  m: number;
  d: number;
  /** 시지(地支) 키. 미선택·모름이면 null */
  hourBranch: string | null;
  unknownTime: boolean;
  gender: "male" | "female" | "";
};

export function writePartnerInfo(productSlug: string, payload: PartnerInfoPayload) {
  try {
    sessionStorage.setItem(partnerInfoStorageKey(productSlug), JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function clearPartnerInfo(productSlug: string) {
  try {
    sessionStorage.removeItem(partnerInfoStorageKey(productSlug));
  } catch {
    // ignore
  }
}

export function readPartnerInfo(productSlug: string): PartnerInfoPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(partnerInfoStorageKey(productSlug));
    if (!raw) return null;
    const j = JSON.parse(raw) as PartnerInfoPayload;
    if (typeof j.y !== "number" || typeof j.m !== "number" || typeof j.d !== "number") return null;
    return j;
  } catch {
    return null;
  }
}
