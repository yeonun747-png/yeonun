import { NextResponse } from "next/server";

import { getWallet, listLedger } from "@/lib/credit-server";
import { requireMyUserId } from "@/lib/my-route-auth";

export const dynamic = "force-dynamic";

function walletPayload(w: NonNullable<Awaited<ReturnType<typeof getWallet>>>) {
  const freeEff =
    new Date(w.free_expires_at).getTime() >= Date.now() ? Math.max(0, w.free_balance) : 0;
  return {
    paid: w.paid_balance,
    free: freeEff,
    total: w.paid_balance + freeEff,
    free_expires_at: w.free_expires_at,
    first_purchase_done: w.first_purchase_done,
  };
}

export async function GET(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  try {
    const wallet = await getWallet(auth.userId);
    if (!wallet) {
      return NextResponse.json({
        ok: true,
        wallet: { paid: 0, free: 0, total: 0, free_expires_at: new Date().toISOString(), first_purchase_done: false },
        ledger: [],
      });
    }
    const ledger = await listLedger(auth.userId, 20);
    return NextResponse.json({ ok: true, wallet: walletPayload(wallet), ledger });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
