const KEY_PREFIX = "yeonun_fortune_extra_v1_";

export type FortuneExtraAnswers = Record<string, string>;

export function fortuneExtraStorageKey(productSlug: string): string {
  return `${KEY_PREFIX}${productSlug.trim()}`;
}

export function readFortuneExtraAnswers(productSlug: string): FortuneExtraAnswers {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(fortuneExtraStorageKey(productSlug));
    if (!raw) return {};
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return {};
    return j as FortuneExtraAnswers;
  } catch {
    return {};
  }
}

export function writeFortuneExtraAnswers(productSlug: string, answers: FortuneExtraAnswers) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(fortuneExtraStorageKey(productSlug), JSON.stringify(answers));
  } catch {
    /* quota */
  }
}

export function clearFortuneExtraAnswers(productSlug: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(fortuneExtraStorageKey(productSlug));
  } catch {
    /* ignore */
  }
}
