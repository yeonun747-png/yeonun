"use client";

import { useEffect, useMemo, useState } from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { FORTUNE_PG_ERROR_EVENT } from "@/lib/fortune-pg-events";
import { launchFortune82PgPayment } from "@/lib/payment-pg-flow";
import { formatMyApiAuthError, getBearerAccessTokenForApi } from "@/lib/fetch-with-auth";
import { formatOrderAccessError, storeOrderAccessToken } from "@/lib/order-access-client";
import { appendStubPayment } from "@/lib/payments-history-stub";
import { spendableTotalCredits, YEONUN_CREDIT_UPDATE_EVENT } from "@/lib/credit-balance-local";
import type { Product } from "@/lib/data/content";
import type { FortunePrefetchV1 } from "@/lib/fortune-prefetch-storage";
import { splitHtmlAfterFirstSubtitleH3Close } from "@/lib/fortune-section-html-split";
import { PayTermsBlock, usePayTermsState } from "@/components/legal/PayTermsBlock";

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function previewText(prefetch: FortunePrefetchV1 | null, fallback: string) {
  if (!prefetch) return `${fallback} 풀이를 준비하고 있어요.`;
  const keys = Object.keys(prefetch.sectionHtml ?? {})
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const firstKey = keys.find((k) => (prefetch.sectionHtml[k] ?? "").trim().length > 0);
  const html = (firstKey != null ? prefetch.sectionHtml[firstKey] : "") || prefetch.claudeStreamHtml || "";
  const split = splitHtmlAfterFirstSubtitleH3Close(html);
  const text = stripHtml(split ? split.tail : html);
  return text.slice(0, 280).trim() || `${fallback} 풀이를 준비하고 있어요.`;
}

type CouponApply = {
  final_price_krw: number;
  discount_krw: number;
  label: string;
};

export function Step6Preview({
  product,
  prefetch,
  onPaid,
}: {
  product: Product;
  prefetch: FortunePrefetchV1 | null;
  onPaid: (orderNo: string | null) => void;
}) {
  const [method, setMethod] = useState<"card" | "phone" | "credit">("card");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [creditBal, setCreditBal] = useState(0);
  const payTerms = usePayTermsState(false);
  const { agreeAll, agreePayTerms, agreeCommerceTerms, allChecked, toggleAll, togglePay, toggleCommerce } = payTerms;
  const [couponApply, setCouponApply] = useState<CouponApply | null>(null);

  const listPrice = product.price_krw;
  const finalPrice = couponApply?.final_price_krw ?? listPrice;
  const discountKrw = couponApply?.discount_krw ?? 0;
  const { session: authSession, user: authUser, loading: authLoading } = useYeonunAuth();

  const resolveCheckoutAccessToken = async (): Promise<string | null> => {
    const fromApi = await getBearerAccessTokenForApi();
    if (fromApi) return fromApi;
    return authSession?.access_token?.trim() || null;
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const accessToken = await resolveCheckoutAccessToken();
      if (!accessToken) {
        if (!cancelled) setCouponApply(null);
        return;
      }
      try {
        const res = await fetch("/api/my/coupons", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ product_slug: product.slug, price_krw: listPrice }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; apply?: CouponApply };
        if (!cancelled && res.ok && data.ok && data.apply) {
          setCouponApply(data.apply);
        }
      } catch {
        if (!cancelled) setCouponApply(null);
      }
    })();
    const onCoupons = () => {
      void (async () => {
        const accessToken = await resolveCheckoutAccessToken();
        if (!accessToken) return;
        const res = await fetch("/api/my/coupons", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ product_slug: product.slug, price_krw: listPrice }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; apply?: CouponApply };
        if (res.ok && data.ok && data.apply) setCouponApply(data.apply);
      })();
    };
    window.addEventListener("yeonun:coupons-updated", onCoupons);
    return () => {
      cancelled = true;
      window.removeEventListener("yeonun:coupons-updated", onCoupons);
    };
  }, [product.slug, listPrice]);

  useEffect(() => {
    const refresh = () => setCreditBal(spendableTotalCredits());
    refresh();
    window.addEventListener(YEONUN_CREDIT_UPDATE_EVENT, refresh);
    return () => window.removeEventListener(YEONUN_CREDIT_UPDATE_EVENT, refresh);
  }, []);

  const toc = useMemo(() => {
    if (product.fortune_menu.main_menus.length > 0) return product.fortune_menu.main_menus;
    return [{ id: product.slug, title: product.title, sub_menus: [] }];
  }, [product]);

  const preview = previewText(prefetch, toc[0]?.title || product.title);

  useEffect(() => {
    const onPgError = (e: Event) => {
      const pgMsg = (e as CustomEvent<{ msg?: string }>).detail?.msg ?? "";
      setStatus("error");
      setMessage(pgMsg === "close" ? "결제가 취소되었습니다." : "결제에 실패했습니다. 다시 시도해 주세요.");
    };
    window.addEventListener(FORTUNE_PG_ERROR_EVENT, onPgError);
    return () => window.removeEventListener(FORTUNE_PG_ERROR_EVENT, onPgError);
  }, []);

  const checkout = async (payMethod: "card" | "phone" | "credit") => {
    if (status === "loading") return;
    if (!allChecked) {
      setStatus("error");
      setMessage("결제 전 필수 약관에 동의해 주세요.");
      return;
    }
    setMethod(payMethod);
    const isPg = payMethod === "card" || payMethod === "phone";
    if (!isPg) {
      setStatus("loading");
      setMessage("");
    }
    try {
      const accessToken = await resolveCheckoutAccessToken();

      if (payMethod === "credit") {
        if (!accessToken) {
          if (authLoading) {
            throw new Error("로그인 정보를 확인하는 중입니다. 잠시 후 다시 시도해 주세요.");
          }
          if (authUser) {
            throw new Error(
              formatMyApiAuthError("invalid_token") ||
                "로그인이 만료되었습니다. 로그아웃 후 다시 로그인해 주세요.",
            );
          }
          throw new Error("크레딧 결제는 로그인 후 이용할 수 있습니다.");
        }
        const creditRes = await fetch("/api/checkout/fortune-credit", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ product_slug: product.slug, title: product.title }),
        });
        const creditData = (await creditRes.json().catch(() => ({}))) as {
          success?: boolean;
          ok?: boolean;
          error?: string;
          order?: { order_no?: string };
          order_access_token?: string | null;
        };
        if (!creditRes.ok || !creditData.success) {
          if (creditData.error === "insufficient_credits") throw new Error("크레딧이 부족합니다.");
          const authMsg = formatMyApiAuthError(creditData.error ?? "");
          throw new Error(authMsg || creditData.error || "크레딧 결제에 실패했습니다.");
        }
        const creditOrderNo = String(creditData.order?.order_no ?? "");
        if (!creditOrderNo) throw new Error("주문번호를 받지 못했습니다.");
        if (creditData.order_access_token) storeOrderAccessToken(creditOrderNo, creditData.order_access_token);
        window.dispatchEvent(new CustomEvent("yeonun:coupons-updated"));
        window.dispatchEvent(new CustomEvent(YEONUN_CREDIT_UPDATE_EVENT));
        appendStubPayment({
          productSlug: product.slug,
          title: product.title,
          amountKrw: finalPrice,
          method: "credit",
        });
        setStatus("idle");
        onPaid(creditOrderNo);
        return;
      }

      const authHeaders: HeadersInit = { "Content-Type": "application/json" };
      if (accessToken) authHeaders.Authorization = `Bearer ${accessToken}`;

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          product_slug: product.slug,
          title: product.title,
          price_krw: listPrice,
          method: payMethod,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        order?: { order_no?: string };
        pg_flow?: boolean;
        order_access_token?: string | null;
      };
      if (!res.ok || !data.success) throw new Error(formatOrderAccessError(data.error ?? "checkout_failed"));

      const orderNo = String(data.order?.order_no ?? "");
      if (!orderNo) throw new Error("주문번호를 받지 못했습니다.");
      if (data.order_access_token) storeOrderAccessToken(orderNo, data.order_access_token);

      if (isPg) {
        await launchFortune82PgPayment({
          paymentMethod: payMethod,
          orderNo,
          productSlug: product.slug,
          title: product.title,
          orderAccessToken: data.order_access_token,
        });
        return;
      }

      if (accessToken) {
        appendStubPayment({
          productSlug: product.slug,
          title: product.title,
          amountKrw: finalPrice,
          method: payMethod,
        });
      }
      setStatus("idle");
      onPaid(orderNo);
    } catch (e) {
      setStatus("error");
      const raw = e instanceof Error ? e.message : "";
      setMessage(raw ? formatOrderAccessError(raw) : "결제 요청 중 오류가 발생했습니다.");
    }
  };

  const usable = Math.min(creditBal, finalPrice);
  const extra = Math.max(0, finalPrice - usable);

  return (
    <>
      <section className="y-fortune-v2-page y-fortune-v2-preview-page y-fortune-v2-page--stack">
        <div className="y-fortune-v2-section-head">
          <h1>풀이 완성!</h1>
          <p>{product.title} 미리보기를 완성했어요</p>
        </div>
        <div className="y-fortune-v2-toc-card">
          <div className="y-fortune-v2-toc-head">전체 풀이 목차</div>
          <div>
            {toc.map((main, i) => (
              <div className="y-fortune-v2-toc-item" key={main.id}>
                <div className={`y-fortune-v2-toc-n ${i === 0 ? "open" : ""}`}>{i + 1}</div>
                <div className={`y-fortune-v2-toc-tx ${i === 0 ? "" : "lock"}`}>{main.title}</div>
                <span className={`y-fortune-v2-toc-lock ${i === 0 ? "" : "lock"}`} aria-hidden="true">
                  {i === 0 ? "🔓" : "🔒"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="y-fortune-v2-preview-card">
          <div className="y-fortune-v2-prev-hd">미리보기 · {toc[0]?.title || product.title}</div>
          <div className="y-fortune-v2-prev-body">
            <div className="y-fortune-v2-prev-fade">{preview}</div>
            <div className="y-fortune-v2-blur-row">
              <div className="y-fortune-v2-lock-ico" aria-hidden="true">
                🔒
              </div>
              <div className="y-fortune-v2-lock-tx">전체 풀이를 확인하려면 결제가 필요해요</div>
            </div>
          </div>
        </div>
        <div className="y-fortune-v2-pay-card">
          {/* 결제 바텀시트(`PaymentModal`) UI를 동일 클래스/구조로 재사용 */}
          <h3 className="y-pay-section-title">결제 수단</h3>
          <div className="y-pay-methods" role="radiogroup" aria-label="결제 수단">
            <div
              className={`y-pay-method ${method === "card" ? "active" : ""}`}
              role="radio"
              aria-checked={method === "card"}
              tabIndex={0}
              onClick={() => setMethod("card")}
            >
              <div className="y-pay-method-radio" />
              <div className="y-pay-method-name">신용·체크카드</div>
              <span className="y-pay-method-icon card">CARD</span>
            </div>
            <div
              className={`y-pay-method ${method === "phone" ? "active" : ""}`}
              role="radio"
              aria-checked={method === "phone"}
              tabIndex={0}
              onClick={() => setMethod("phone")}
            >
              <div className="y-pay-method-radio" />
              <div className="y-pay-method-name">휴대폰 결제</div>
              <span className="y-pay-method-icon phone">PHONE</span>
            </div>
            <div
              className={`y-pay-method y-pay-method--credit-stack ${method === "credit" ? "active" : ""} ${creditBal < finalPrice ? "y-pay-method--credit-blocked" : ""}`}
              role="radio"
              aria-checked={method === "credit"}
              aria-disabled={creditBal < finalPrice}
              tabIndex={creditBal < finalPrice ? -1 : 0}
              onClick={() => {
                if (creditBal >= finalPrice) setMethod("credit");
              }}
            >
              <div className="y-pay-method-credit-row">
                <div className="y-pay-method-radio" />
                <div className="y-pay-method-name">크레딧 결제</div>
                <span className="y-pay-method-icon credit">CREDIT</span>
              </div>
              {creditBal < finalPrice ? (
                <div className="y-pay-credit-short">
                  잔여 {creditBal.toLocaleString("ko-KR")} 크레딧 · {extra.toLocaleString("ko-KR")} 크레딧 부족
                </div>
              ) : (
                <div className="y-pay-credit-short y-pay-credit-short--ok">잔여 {creditBal.toLocaleString("ko-KR")} 크레딧</div>
              )}
            </div>
          </div>

          <div className="y-pay-summary">
            <div className="y-pay-row">
              <span className="label">상품 금액</span>
              <span className="value">{listPrice.toLocaleString("ko-KR")}원</span>
            </div>
            <div className="y-pay-row discount">
              <span className="label">{discountKrw > 0 ? couponApply?.label || "쿠폰 할인" : "쿠폰 할인"}</span>
              <span className="value">{discountKrw > 0 ? `-${discountKrw.toLocaleString("ko-KR")}원` : "-0원"}</span>
            </div>
            <div className="y-pay-total">
              <div className="y-pay-total-label">최종 결제 금액</div>
              <div className="y-pay-total-value">
                {finalPrice.toLocaleString("ko-KR")}
                <span className="small">원</span>
              </div>
            </div>
          </div>

          <PayTermsBlock
            agreeAll={agreeAll}
            agreePayTerms={agreePayTerms}
            agreeCommerceTerms={agreeCommerceTerms}
            onToggleAll={toggleAll}
            onTogglePay={togglePay}
            onToggleCommerce={toggleCommerce}
          />
          {message ? <p className="y-fortune-v2-pay-error">{message}</p> : null}
          <button className="y-fortune-v2-primary" type="button" disabled={status === "loading" || !allChecked} onClick={() => checkout(method)}>
            {status === "loading" ? "결제 처리 중..." : `전체 풀이 보기 · ${finalPrice.toLocaleString("ko-KR")}원`}
          </button>
        </div>
      </section>
    </>
  );
}
