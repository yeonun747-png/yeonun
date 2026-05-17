import { NextResponse } from "next/server";

import { spendCredits } from "@/lib/credit-server";
import { requireMyUserId } from "@/lib/my-route-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    amount?: number;
    kind?: string;
    ref_type?: string;
    ref_id?: string;
    memo?: string;
  };

  const amount = Number(body.amount);
  const kind = body.kind;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }
  if (kind !== "spend_chat" && kind !== "spend_voice" && kind !== "spend_fortune") {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }

  try {
    const { wallet, spent } = await spendCredits(auth.userId, amount, {
      kind,
      ref_type: body.ref_type ?? null,
      ref_id: body.ref_id ?? null,
      memo: body.memo ?? null,
    });
    const freeEff =
      new Date(wallet.free_expires_at).getTime() >= Date.now() ? Math.max(0, wallet.free_balance) : 0;
    return NextResponse.json({
      ok: true,
      spent,
      wallet: {
        paid: wallet.paid_balance,
        free: freeEff,
        total: wallet.paid_balance + freeEff,
        free_expires_at: wallet.free_expires_at,
        first_purchase_done: wallet.first_purchase_done,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "spend_failed";
    if (msg === "insufficient_credits") {
      return NextResponse.json({ ok: false, error: msg }, { status: 402 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
