/**
 * /call-dcc 음성에서 점사·보관함 진입 시에만 세팅.
 * 만남 등 직입장은 URL에 from_fortune=1 이 없으면 CallDccPageClient 마운트 시 비운다.
 */
export const VOICE_MANSE_META_KEY = "yeonun_voice_manse_meta";

export type VoiceManseMeta = { profile: "single" | "pair"; productSlug: string };

export function setVoiceManseMeta(meta: VoiceManseMeta): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(VOICE_MANSE_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function readVoiceManseMeta(): VoiceManseMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(VOICE_MANSE_META_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { profile?: string; product_slug?: string; productSlug?: string };
    const slug = String(j.productSlug ?? j.product_slug ?? "").trim();
    if (!slug) return null;
    const profile = j.profile === "pair" ? "pair" : "single";
    return { profile, productSlug: slug };
  } catch {
    return null;
  }
}

export function clearVoiceManseMeta(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(VOICE_MANSE_META_KEY);
  } catch {
    // ignore
  }
}
