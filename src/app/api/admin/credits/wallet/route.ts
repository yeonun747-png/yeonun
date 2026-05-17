import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getWallet, isLoggedInUserId, listLedger } from "@/lib/credit-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userId = new URL(request.url).searchParams.get("user_id")?.trim() ?? "";
  if (!isLoggedInUserId(userId)) {
    return NextResponse.json({ ok: false, error: "invalid_user_id" }, { status: 400 });
  }

  try {
    const wallet = await getWallet(userId);
    const ledger = await listLedger(userId, 40);
    const freeEff =
      wallet && new Date(wallet.free_expires_at).getTime() >= Date.now()
        ? Math.max(0, wallet.free_balance)
        : 0;

    return NextResponse.json({
      ok: true,
      wallet: wallet
        ? {
            paid: wallet.paid_balance,
            free: freeEff,
            total: wallet.paid_balance + freeEff,
            free_expires_at: wallet.free_expires_at,
            first_purchase_done: wallet.first_purchase_done,
          }
        : null,
      ledger,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
