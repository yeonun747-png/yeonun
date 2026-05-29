"use client";

import {
  applyPurchasedCredits,
  markFirstCreditPurchaseDone,
  notifyCreditUpdated,
  readWallet,
  spendCreditsForOrder,
} from "@/lib/credit-balance-local";

let accessTokenRef: string | null = null;

export function setCreditAuthAccessToken(token: string | null): void {
  accessTokenRef = token?.trim() ? token.trim() : null;
}

function authHeaders(): HeadersInit | null {
  if (!accessTokenRef) return null;
  return { Authorization: `Bearer ${accessTokenRef}`, "Content-Type": "application/json" };
}

export type ServerWalletPayload = {
  paid: number;
  free: number;
  total: number;
  free_expires_at: string;
  first_purchase_done: boolean;
};

function applyServerWalletToLocal(w: ServerWalletPayload): void {
  const freeExp = new Date(w.free_expires_at).getTime();
  const free = Number.isFinite(freeExp) && freeExp >= Date.now() ? Math.max(0, w.free) : 0;
  const paid = Math.max(0, w.paid);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      "yeonun_credit_wallet_v1",
      JSON.stringify({
        paid,
        free,
        freeExpiresAtMs: freeExp,
        firstPurchaseDone: Boolean(w.first_purchase_done),
      }),
    );
    localStorage.setItem("yeonun_credit_wallet_migrated_v1", "1");
    localStorage.setItem("yeonun_consult_trial_device_v1", "1");
  } catch {
    /* ignore */
  }
  notifyCreditUpdated();
}

/** 로그인 후 서버 지갑 → local 동기화(최초 1회 local→서버 이전 포함) */
export async function syncCreditsFromServer(): Promise<boolean> {
  const headers = authHeaders();
  if (!headers) return false;

  const local = readWallet();
  const res = await fetch("/api/my/credits/sync", {
    method: "POST",
    headers,
    body: JSON.stringify({
      local_paid: local.paid,
      local_free: local.free,
      local_first_purchase_done: local.firstPurchaseDone,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok || !data.wallet) return false;
  applyServerWalletToLocal(data.wallet as ServerWalletPayload);
  return true;
}

export async function fetchServerCredits(): Promise<ServerWalletPayload | null> {
  const headers = authHeaders();
  if (!headers) return null;
  const res = await fetch("/api/my/credits", { headers, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) return null;
  return data.wallet as ServerWalletPayload;
}

export async function spendCreditsWithAuth(
  amount: number,
  meta: {
    kind: "spend_chat" | "spend_voice" | "spend_fortune";
    ref_type?: string;
    ref_id?: string;
    memo?: string;
  },
): Promise<{ ok: boolean; spent: number; insufficient?: boolean }> {
  const need = Math.floor(amount);
  if (need <= 0) return { ok: true, spent: 0 };

  const headers = authHeaders();
  if (headers) {
    const res = await fetch("/api/my/credits/spend", {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: need, ...meta }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 402 || data?.error === "insufficient_credits") {
      return { ok: false, spent: 0, insufficient: true };
    }
    if (!res.ok || !data?.ok) return { ok: false, spent: 0 };
    if (data.wallet) applyServerWalletToLocal(data.wallet as ServerWalletPayload);
    return { ok: true, spent: Number(data.spent) || need };
  }

  if (readWallet().paid + readWallet().free < need) {
    return { ok: false, spent: 0, insufficient: true };
  }
  const spent = spendCreditsForOrder(need);
  return { ok: spent >= need, spent };
}

export async function trySpendChatMessageCreditsAuth(cost: number): Promise<boolean> {
  const r = await spendCreditsWithAuth(cost, { kind: "spend_chat", memo: "채팅 메시지" });
  return r.ok;
}

/** PG 충전 완료 후 서버 반영분 pull */
export async function pullCreditsAfterPurchase(): Promise<void> {
  await syncCreditsFromServer();
}

/** 비로그인 fallback 포함 */
export function applyPurchasedCreditsClient(credits: number, firstBonus: boolean): void {
  if (accessTokenRef) return;
  applyPurchasedCredits(credits);
  if (firstBonus) markFirstCreditPurchaseDone();
}
