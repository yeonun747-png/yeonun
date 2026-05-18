import { NextRequest, NextResponse } from "next/server";

import { checkFortune82PaymentStatus } from "@/lib/payment-fortune82-pcheck";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/payment/status?oid=주문번호 — PG pcheck + 자사 DB */
export async function GET(request: NextRequest) {
  try {
    const oid = request.nextUrl.searchParams.get("oid")?.trim();
    if (!oid) {
      return NextResponse.json({ success: false, error: "주문번호가 없습니다." }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: order, error } = await supabase
      .from("orders")
      .select("order_no,status,product_slug")
      .eq("order_no", oid)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ success: false, status: "not_found", pg_check: "E" }, { status: 404 });
    }

    const pcheck = await checkFortune82PaymentStatus(oid);
    const dbPaid = order.status === "paid";

    let status: "success" | "pending" | "error";
    if (dbPaid) {
      status = "success";
    } else if (pcheck.code === "Y") {
      status = "pending";
    } else if (pcheck.code === "N") {
      status = "pending";
    } else {
      status = "error";
    }

    const headers = new Headers();
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    return NextResponse.json(
      {
        success: true,
        status,
        pg_check: pcheck.code,
        pg_paid: pcheck.code === "Y",
        db_paid: dbPaid,
        product_slug: order.product_slug,
        pg_raw: process.env.NODE_ENV === "development" ? pcheck.raw.slice(0, 120) : undefined,
      },
      { headers },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ success: false, error: msg, pg_check: "E" }, { status: 500 });
  }
}
