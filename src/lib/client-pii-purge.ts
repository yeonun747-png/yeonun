/** 로그아웃·탈퇴 시 클라이언트에 남는 PII·민감 캐시 일괄 삭제 */

const EXACT_KEYS = [
  "yeonun_saju_v1",
  "yeonun_credit_wallet_v1",
  "yeonun_credit_wallet_migrated_v1",
  "yeonun_consult_trial_device_v1",
  "yeonun_voice_visitor_ref",
  "yeonun_pg_pending_v1",
  "payment_success_oid",
  "payment_success_timestamp",
  "payment_success_signal",
  "chat-consult-archive",
  "chat-consult-archive-v2",
] as const;

const PREFIXES = [
  "yeonun:today-daily-words:",
  "yeonun:order-access:",
  "yeonun_pg_pending_v1:",
  "yeonun:chat-consult:",
  "yeonun:context-notice:",
  "yeonun:storage-notice:",
  "yeonun:saju-consent",
  "yeonun:legal-consent",
] as const;

function purgeStorage(store: Storage): void {
  try {
    for (const key of EXACT_KEYS) {
      store.removeItem(key);
    }
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k) keys.push(k);
    }
    for (const k of keys) {
      if (PREFIXES.some((p) => k.startsWith(p))) {
        store.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

export function purgeClientPiiStorage(): void {
  if (typeof window === "undefined") return;
  purgeStorage(localStorage);
  try {
    purgeStorage(sessionStorage);
    sessionStorage.removeItem("yeonun_fortune_voice_brief");
  } catch {
    /* ignore */
  }
}
