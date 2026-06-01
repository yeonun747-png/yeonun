/** 클라이언트 동의·고지 1회 저장 (정책 개정 시 CONSENT_POLICY_VERSION 올리면 재표시) */

export const CONSENT_POLICY_VERSION = "20260530";

const STORAGE_NOTICE_KEY = `yeonun:storage-notice:v${CONSENT_POLICY_VERSION}`;
const SAJU_SESSION_CONSENT_KEY = "yeonun:saju-consent-session";
const LEGAL_CONSENT_SESSION_KEY = "yeonun:legal-consent-session";

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export function hasStorageNoticeAck(): boolean {
  return readFlag(STORAGE_NOTICE_KEY);
}

export function ackStorageNotice(): void {
  writeFlag(STORAGE_NOTICE_KEY);
}

export function hasSessionSajuConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SAJU_SESSION_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSessionSajuConsent(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SAJU_SESSION_CONSENT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function setSessionLegalConsent(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LEGAL_CONSENT_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasSessionLegalConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(LEGAL_CONSENT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
