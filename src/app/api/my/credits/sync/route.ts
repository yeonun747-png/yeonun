import { NextResponse } from "next/server";

import { ensureWallet, getWallet } from "@/lib/credit-server";
import { requireMyUserId } from "@/lib/my-route-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    local_paid?: number;
    local_free?: number;
  };

  try {
    let wallet = await getWallet(auth.userId);
    if (!wallet) {
      wallet = await ensureWallet(auth.userId, {
        importPaid: Number(body.local_paid) || 0,
        importFree: Number(body.local_free) || 0,
      });
    }

    const freeEff =
      new Date(wallet.free_expires_at).getTime() >= Date.now() ? Math.max(0, wallet.free_balance) : 0;

    return NextResponse.json({
      ok: true,
      wallet: {
        paid: wallet.paid_balance,
        free: freeEff,
        total: wallet.paid_balance + freeEff,
        free_expires_at: wallet.free_expires_at,
        first_purchase_done: wallet.first_purchase_done,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
