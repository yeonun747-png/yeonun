import { NextResponse } from "next/server";

import { ensureWallet, getWallet, reconcileFirstPurchaseDone } from "@/lib/credit-server";
import { requireMyUserId } from "@/lib/my-route-auth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    local_first_purchase_done?: boolean;
  };

  try {
    let wallet = await getWallet(auth.userId);
    if (!wallet) {
      wallet = await ensureWallet(auth.userId);
    }

    wallet = (await reconcileFirstPurchaseDone(auth.userId)) ?? wallet;

    if (!wallet.first_purchase_done && body.local_first_purchase_done) {
      const sb = supabaseServer();
      const { data: repaired, error: repairErr } = await sb
        .from("user_credit_wallets")
        .update({ first_purchase_done: true })
        .eq("user_id", auth.userId)
        .select("*")
        .single();
      if (!repairErr && repaired) wallet = repaired as typeof wallet;
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
