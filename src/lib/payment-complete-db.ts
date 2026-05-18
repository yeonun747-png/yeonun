import type { SupabaseClient } from "@supabase/supabase-js";

type OrderRow = {
  id: string;
  order_no: string;
  product_slug: string | null;
  amount_krw: number | null;
  user_ref: string | null;
};

type PaymentRow = {
  id: string;
  status: string | null;
  raw_payload: unknown;
  paid_at?: string | null;
};

/** PG 완료 시 payments.paid 행 보장 — 없으면 insert, pending이면 update */
export async function ensureOrderPaidPaymentRecord(
  supabase: SupabaseClient,
  order: OrderRow,
  paidAt: string,
): Promise<{ payment: PaymentRow | null; error: string | null }> {
  const { data: existingRows, error: listErr } = await supabase
    .from("payments")
    .select("id,status,raw_payload,paid_at,method,created_at")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });

  if (listErr) {
    return { payment: null, error: listErr.message };
  }

  const rows = existingRows ?? [];
  const alreadyPaid = rows.find((p) => p.status === "paid" && p.paid_at);
  if (alreadyPaid) {
    return {
      payment: {
        id: alreadyPaid.id,
        status: alreadyPaid.status,
        raw_payload: alreadyPaid.raw_payload,
        paid_at: alreadyPaid.paid_at,
      },
      error: null,
    };
  }

  const pendingIds = rows.filter((p) => p.status !== "paid").map((p) => p.id);
  if (pendingIds.length > 0) {
    const { data: updatedRows, error: updErr } = await supabase
      .from("payments")
      .update({ status: "paid", paid_at: paidAt })
      .in("id", pendingIds)
      .select("id,status,raw_payload,paid_at");

    if (updErr) {
      return { payment: null, error: updErr.message };
    }
    const updated = updatedRows?.[0];
    if (updated) {
      return { payment: updated as PaymentRow, error: null };
    }
  }

  const seed = rows[0];
  const { data: inserted, error: insErr } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      provider: "fortune82-pg",
      method: seed?.method ?? "card",
      status: "paid",
      paid_at: paidAt,
      raw_payload:
        seed?.raw_payload && typeof seed.raw_payload === "object"
          ? seed.raw_payload
          : {
              product_slug: order.product_slug,
              title: null,
              source: "yeonun-payment-complete-fallback",
            },
    })
    .select("id,status,raw_payload,paid_at")
    .maybeSingle();

  if (insErr) {
    return { payment: null, error: insErr.message };
  }

  return { payment: (inserted as PaymentRow | null) ?? null, error: null };
}
