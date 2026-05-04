/**
 * 체험 로그인(auth-stub) 전용 결제 내역 — Supabase·PG 연동 전까지 로컬에만 저장.
 */
import { readAuthStubLoggedIn } from "@/lib/auth-stub";

export const YEONUN_STUB_PAYMENTS_KEY = "yeonun_payment_history_stub_v1";
export const YEONUN_STUB_PAYMENTS_EVENT = "yeonun:stub-payments-updated";

export type StubPaymentRow = {
  id: string;
  paidAt: string;
  productSlug: string;
  title: string;
  amountKrw: number;
  method: string;
};

function newId(): string {
  return `sp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function readStubPaymentHistory(): StubPaymentRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(YEONUN_STUB_PAYMENTS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    const out: StubPaymentRow[] = [];
    for (const x of p) {
      if (!x || typeof x !== "object") continue;
      const o = x as Partial<StubPaymentRow>;
      if (typeof o.id !== "string" || typeof o.paidAt !== "string") continue;
      out.push({
        id: o.id,
        paidAt: o.paidAt,
        productSlug: String(o.productSlug ?? ""),
        title: String(o.title ?? ""),
        amountKrw: Math.max(0, Math.floor(Number(o.amountKrw) || 0)),
        method: String(o.method ?? "card"),
      });
    }
    return out.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  } catch {
    return [];
  }
}

export function appendStubPayment(
  entry: Omit<StubPaymentRow, "id" | "paidAt"> & { paidAt?: string },
): void {
  if (typeof window === "undefined") return;
  if (!readAuthStubLoggedIn()) return;

  try {
    const row: StubPaymentRow = {
      id: newId(),
      paidAt: entry.paidAt ?? new Date().toISOString(),
      productSlug: entry.productSlug,
      title: entry.title,
      amountKrw: entry.amountKrw,
      method: entry.method,
    };
    const prev = readStubPaymentHistory();
    const next = [row, ...prev].slice(0, 200);
    localStorage.setItem(YEONUN_STUB_PAYMENTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(YEONUN_STUB_PAYMENTS_EVENT));
  } catch {
    /* ignore */
  }
}
