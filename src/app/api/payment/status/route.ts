import { NextRequest, NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/payment/status?oid=주문번호 */
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
      return NextResponse.json({ success: false, status: "not_found" }, { status: 404 });
    }

    const status = order.status === "paid" ? "success" : "pending";
    const headers = new Headers();
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    return NextResponse.json(
      {
        success: true,
        status,
        product_slug: order.product_slug,
      },
      { headers },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
