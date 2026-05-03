import {
  CREDIT_FREE_TRIAL_GRANT,
  CREDIT_FREE_TRIAL_VALID_DAYS,
} from "@/lib/credit-policy";
import { LS_VOICE_BALANCE_SEC, LS_VOICE_FREE_REMAINING_SEC, readVoiceBalanceSecClient, readVoiceFreeRemainingSecClient } from "@/lib/voice-balance-local";

const LS_WALLET = "yeonun_credit_wallet_v1";
const LS_MIGRATED = "yeonun_credit_wallet_migrated_v1";

export const YEONUN_CREDIT_UPDATE_EVENT = "yeonun:credit-update";

type Wallet = {
  paid: number;
  free: number;
  /** epoch ms — 무료 크레딧 묶음 만료(미사용 분만 표시용, 소진 로직은 단순 합산) */
  freeExpiresAtMs: number;
  firstPurchaseDone: boolean;
};

function nowMs() {
  return Date.now();
}

function defaultFreeExpiry() {
  return nowMs() + CREDIT_FREE_TRIAL_VALID_DAYS * 86400000;
}

function readWalletRaw(): Wallet | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_WALLET);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Wallet>;
    return {
      paid: Math.max(0, Math.floor(Number(p.paid) || 0)),
      free: Math.max(0, Math.floor(Number(p.free) || 0)),
      freeExpiresAtMs: typeof p.freeExpiresAtMs === "number" && Number.isFinite(p.freeExpiresAtMs) ? p.freeExpiresAtMs : defaultFreeExpiry(),
      firstPurchaseDone: Boolean(p.firstPurchaseDone),
    };
  } catch {
    return null;
  }
}

function writeWallet(w: Wallet) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_WALLET, JSON.stringify(w));
  } catch {
    /* ignore */
  }
}

function migrateFromLegacyVoiceIfNeeded(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(LS_MIGRATED) === "1") return;
    const vb = readVoiceBalanceSecClient();
    const vf = readVoiceFreeRemainingSecClient();
    const paidFromLegacy = Math.round(Math.max(0, vb - vf) * 6.5);
    const freeFromLegacy = Math.round(Math.max(0, vf) * 6.5);
    const w: Wallet = {
      paid: paidFromLegacy,
      free: freeFromLegacy > 0 ? freeFromLegacy : CREDIT_FREE_TRIAL_GRANT,
      freeExpiresAtMs: defaultFreeExpiry(),
      firstPurchaseDone: false,
    };
    if (w.paid === 0 && w.free === 0) w.free = CREDIT_FREE_TRIAL_GRANT;
    writeWallet(w);
    localStorage.setItem(LS_MIGRATED, "1");
  } catch {
    /* ignore */
  }
}

export function notifyCreditUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(YEONUN_CREDIT_UPDATE_EVENT));
  } catch {
    /* ignore */
  }
}

export function readWallet(): Wallet {
  if (typeof window === "undefined") {
    return {
      paid: 0,
      free: CREDIT_FREE_TRIAL_GRANT,
      freeExpiresAtMs: defaultFreeExpiry(),
      firstPurchaseDone: false,
    };
  }
  migrateFromLegacyVoiceIfNeeded();
  const w = readWalletRaw();
  if (w) {
    let free = w.free;
    if (w.freeExpiresAtMs < nowMs()) free = 0;
    return { ...w, free };
  }
  const init: Wallet = {
    paid: 0,
    free: CREDIT_FREE_TRIAL_GRANT,
    freeExpiresAtMs: defaultFreeExpiry(),
    firstPurchaseDone: false,
  };
  writeWallet(init);
  try {
    localStorage.setItem(LS_MIGRATED, "1");
  } catch {
    /* ignore */
  }
  return init;
}

export function spendableTotalCredits(): number {
  const { paid, free } = readWallet();
  return Math.max(0, paid) + Math.max(0, free);
}

/** 유료 충전 크레딧만 (표시용으로 분리할 때) */
export function paidCredits(): number {
  return readWallet().paid;
}

export function freeCredits(): number {
  return readWallet().free;
}

export function markFirstCreditPurchaseDone(): void {
  const w = readWallet();
  writeWallet({ ...w, firstPurchaseDone: true });
  notifyCreditUpdated();
}

export function applyPurchasedCredits(credits: number): void {
  if (credits <= 0) return;
  const w = readWallet();
  writeWallet({ ...w, paid: w.paid + credits });
  notifyCreditUpdated();
}

/** 미션·출석 등 무료 적립 */
export function applyBonusCredits(credits: number): void {
  if (credits <= 0) return;
  const w = readWallet();
  writeWallet({ ...w, free: w.free + credits });
  notifyCreditUpdated();
}

/**
 * 결제(원화와 동일 금액)만큼 차감 — 무료 먼저, 다음 유료.
 * @returns 실제 차감한 합계
 */
export function spendCreditsForOrder(amount: number): number {
  if (amount <= 0) return 0;
  const w = readWallet();
  let left = Math.floor(amount);
  let takeFree = Math.min(w.free, left);
  left -= takeFree;
  let takePaid = Math.min(w.paid, left);
  left -= takePaid;
  writeWallet({
    ...w,
    free: w.free - takeFree,
    paid: w.paid - takePaid,
  });
  notifyCreditUpdated();
  return takeFree + takePaid;
}

/** 채팅 1건(130) — 무료 먼저 */
export function trySpendChatMessageCredits(cost: number): boolean {
  if (cost <= 0) return true;
  if (spendableTotalCredits() < cost) return false;
  spendCreditsForOrder(cost);
  return true;
}
