"use client";

import { clearAllFortunePrefetchSessionCaches } from "@/lib/fortune-prefetch-storage";
import { abortAllFortunePrefetch } from "@/lib/fortune-prefetch-runner";
import { YEONUN_SAJU_UPDATED_EVENT } from "@/lib/saju-events";

let registered = false;

/** `yeonun:saju-updated` 시 이전 사주로 생성된 점사 prefetch·서버 Tank 스냅샷 제거 */
export function registerFortunePrefetchSajuInvalidation(): () => void {
  if (typeof window === "undefined") return () => {};
  if (registered) return () => {};

  const onSajuUpdated = () => {
    clearAllFortunePrefetchSessionCaches();
    abortAllFortunePrefetch();
    window.dispatchEvent(new CustomEvent("yeonun:fortune-prefetch-invalidated"));
  };

  registered = true;
  window.addEventListener(YEONUN_SAJU_UPDATED_EVENT, onSajuUpdated);
  return () => {
    registered = false;
    window.removeEventListener(YEONUN_SAJU_UPDATED_EVENT, onSajuUpdated);
  };
}
