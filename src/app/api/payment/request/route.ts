import { NextRequest, NextResponse } from "next/server";

import { formatPaymentCode, resolvePaymentOrigin, truncateStringByBytes } from "@/lib/payment-utils";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 포춘82 PG 결제창 form POST 데이터 생성
 * POST { paymentMethod: 'card'|'phone', order_no, product_slug, title?, successOrigin? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      paymentMethod?: string;
      order_no?: string;
      product_slug?: string;
      title?: string;
      successOrigin?: string;
    };

    const paymentMethod = String(body.paymentMethod ?? "").trim();
    const orderNo = String(body.order_no ?? "").trim();
    const productSlug = String(body.product_slug ?? "").trim();

    if (!orderNo || !productSlug || (paymentMethod !== "card" && paymentMethod !== "phone")) {
      return NextResponse.json({ success: false, error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id,order_no,status,amount_krw,product_slug")
      .eq("order_no", orderNo)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (order.product_slug !== productSlug) {
      return NextResponse.json({ success: false, error: "주문 상품이 일치하지 않습니다." }, { status: 400 });
    }

    if (order.status === "paid") {
      return NextResponse.json({ success: false, error: "이미 결제된 주문입니다." }, { status: 400 });
    }

    const { data: product, error: prodErr } = await supabase
      .from("products")
      .select("payment_code,price_krw,title")
      .eq("slug", productSlug)
      .maybeSingle();

    if (prodErr || !product?.payment_code) {
      return NextResponse.json({ success: false, error: "상품 결제 코드가 없습니다." }, { status: 400 });
    }

    const payNum = Number(order.amount_krw ?? product.price_krw ?? 0);
    if (!Number.isFinite(payNum) || payNum <= 0) {
      return NextResponse.json({ success: false, error: "결제 금액이 올바르지 않습니다." }, { status: 400 });
    }

    const codeStr = formatPaymentCode(product.payment_code);
    if (!codeStr) {
      return NextResponse.json({ success: false, error: "결제 코드가 올바르지 않습니다." }, { status: 400 });
    }

    const paymentUrl =
      paymentMethod === "card"
        ? "https://www.fortune82.com/api/payment/reqcard.html"
        : "https://www.fortune82.com/api/payment/reqhp.html";

    const origin = resolvePaymentOrigin(body.successOrigin);
    const oid = orderNo;
    const successUrl = `${origin}/payment/success?oid=${encodeURIComponent(oid)}`;
    const failUrl = `${origin}/payment/error?code=T001&msg=close`;

    const displayName = String(body.title ?? product.title ?? "연운 상품").trim() || "연운 상품";

    const formData = {
      code: codeStr,
      name: truncateStringByBytes(displayName, 50),
      pay: String(Math.floor(payNum)),
      oid,
      successUrl,
      failUrl,
      success_url: successUrl,
      fail_url: failUrl,
      returnUrl: successUrl,
      return_url: successUrl,
      ret_url: successUrl,
      nextUrl: successUrl,
    };

    return NextResponse.json({
      success: true,
      data: { oid, paymentUrl, formData, successUrl, failUrl, payment_code: codeStr },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "결제 요청 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
