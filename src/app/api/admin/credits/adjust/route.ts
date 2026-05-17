import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { adminAdjustCredits, isLoggedInUserId } from "@/lib/credit-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    delta_paid?: number;
    delta_free?: number;
    kind?: string;
    memo?: string;
    ref_type?: string;
    ref_id?: string;
  };

  const userId = String(body.user_id ?? "").trim();
  if (!isLoggedInUserId(userId)) {
    return NextResponse.json({ ok: false, error: "invalid_user_id" }, { status: 400 });
  }

  const memo = String(body.memo ?? "").trim();
  if (!memo) {
    return NextResponse.json({ ok: false, error: "memo_required" }, { status: 400 });
  }

  const kind = body.kind === "cs_refund" ? "cs_refund" : "admin_adjust";

  try {
    const { wallet, ledger } = await adminAdjustCredits(
      userId,
      Number(body.delta_paid) || 0,
      Number(body.delta_free) || 0,
      {
        kind,
        memo,
        admin_actor: "admin",
        ref_type: body.ref_type?.trim() || undefined,
        ref_id: body.ref_id?.trim() || undefined,
      },
    );

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
      ledger,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "adjust_failed";
    const status = msg === "balance_would_be_negative" || msg === "adjustment_zero" ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
