"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { useModalControls } from "@/components/modals/useModalControls";
import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { pullCreditsAfterPurchase, spendCreditsWithAuth } from "@/lib/credit-client";
import { invalidateMyPaymentsCache, preloadMyPayments } from "@/lib/my-payments-cache";
import {
  spendableTotalCredits,
  YEONUN_CREDIT_UPDATE_EVENT,
} from "@/lib/credit-balance-local";
import { creditTopupLoginHref } from "@/lib/credit-topup-auth";
import {
  launchFortune82PgPayment,
  registerPgPaymentHandlers,
  usePgPaymentReturnResume,
} from "@/lib/payment-pg-flow";
import { appendStubPayment } from "@/lib/payments-history-stub";
import { supabaseBrowser } from "@/lib/supabase/client";
import { rememberSheetBackdropScrollY } from "@/components/my/MySheetBackdropFrame";

export function PaymentModal() {
  const { close } = useModalControls();
  const { session, loading: authLoading } = useYeonunAuth();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const product = sp.get("product") ?? "reunion-maybe";
  const title = sp.get("title") ?? "그 사람과 다시 만날 수 있을까";
  const price = Number(sp.get("price") ?? "14900");
  const grantBase = Number(sp.get("grant_base") ?? sp.get("credits") ?? "3900");
  const character_key = sp.get("character_key") ?? "yeon";
  const profile = sp.get("profile") === "pair" ? "pair" : "single";
  const firstVoiceCreditBonus = sp.get("first_voice_credit_bonus") === "1";
  const voicePackageMinutes = Number(sp.get("minutes") ?? "10");

  const isCreditTopup =
    product.startsWith("credit-package") || product.includes("voice-credit") || product.startsWith("credit");
  const isVoiceCreditLegacy = product.includes("voice-credit") || product.includes("credit-10");

  const [method, setMethod] = useState<"card" | "phone" | "credit">("card");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [creditBal, setCreditBal] = useState(0);

  const refreshBal = useCallback(() => setCreditBal(spendableTotalCredits()), []);

  useEffect(() => {
    refreshBal();
    const on = () => refreshBal();
    window.addEventListener(YEONUN_CREDIT_UPDATE_EVENT, on);
    return () => window.removeEventListener(YEONUN_CREDIT_UPDATE_EVENT, on);
  }, [refreshBal]);

  useEffect(() => {
    if (isCreditTopup && method === "credit") setMethod("card");
  }, [isCreditTopup, method]);

  const currentHref = useMemo(() => {
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, sp]);

  useEffect(() => {
    if (!isCreditTopup || authLoading) return;
    if (session?.access_token) return;
    router.replace(creditTopupLoginHref(currentHref));
  }, [authLoading, currentHref, isCreditTopup, router, session?.access_token]);

  const handlePgPaid = useCallback(
    async (orderNo: string) => {
      setStatus("loading");
      setMessage("");
      try {
        const sb = supabaseBrowser();
        const sessionNow = sb ? (await sb.auth.getSession()).data.session : null;

        if (isCreditTopup) {
          if (!sessionNow?.access_token) {
            router.replace(creditTopupLoginHref(currentHref));
            return;
          }
          appendStubPayment({
            productSlug: product,
            title,
            amountKrw: price,
            method: "card",
          });
          await pullCreditsAfterPurchase();
          invalidateMyPaymentsCache(sessionNow.user.id);
          void preloadMyPayments();
          setStatus("idle");
          router.replace(pathname);
          return;
        }

        if (sessionNow?.access_token) {
          appendStubPayment({
            productSlug: product,
            title,
            amountKrw: price,
            method: "card",
          });
        }

        const next = new URLSearchParams(sp.toString());
        next.set("modal", profile === "pair" ? "partner_info" : "fortune_stream");
        next.set("product", product);
        next.set("title", title);
        next.set("price", String(price));
        next.set("character_key", character_key);
        next.set("profile", profile);
        if (orderNo) next.set("order_no", orderNo);
        setStatus("idle");
        router.replace(`${pathname}?${next.toString()}`);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "결제 반영 중 오류가 발생했습니다.");
      }
    },
    [
      character_key,
      currentHref,
      isCreditTopup,
      pathname,
      price,
      product,
      profile,
      router,
      sp,
      title,
    ],
  );

  useEffect(() => {
    return registerPgPaymentHandlers({
      onSuccess: handlePgPaid,
      onError: (_code, pgMsg) => {
        setStatus("error");
        setMessage(pgMsg === "close" ? "결제가 취소되었습니다." : "결제에 실패했습니다. 다시 시도해 주세요.");
      },
    });
  }, [handlePgPaid]);

  usePgPaymentReturnResume(handlePgPaid);

  const creditBlocked = useMemo(
    () => !isCreditTopup && method === "credit" && creditBal < price,
    [isCreditTopup, method, creditBal, price],
  );

  const payLabel = `${price.toLocaleString("ko-KR")}원 결제하기`;
  const legalTermsHref = useMemo(
    () => ({
      pathname: "/legal/terms",
      query: { back: currentHref, history: "1" },
    }),
    [currentHref],
  );
  const legalPrivacyHref = useMemo(
    () => ({
      pathname: "/legal/privacy",
      query: { back: currentHref, history: "1" },
    }),
    [currentHref],
  );

  const checkout = async () => {
    if (status === "loading") return;
    if (method === "credit" && creditBal < price) return;
    const isPg = method === "card" || method === "phone";
    if (!isPg) {
      setStatus("loading");
      setMessage("");
    }
    try {
      const sb = supabaseBrowser();
      const sessionNow = sb ? (await sb.auth.getSession()).data.session : null;

      if (isCreditTopup && !sessionNow?.access_token) {
        router.replace(creditTopupLoginHref(currentHref));
        return;
      }

      if (method === "credit" && !isCreditTopup) {
        const spend = await spendCreditsWithAuth(price, {
          kind: "spend_fortune",
          ref_type: "product",
          ref_id: product,
          memo: title,
        });
        if (!spend.ok) throw new Error("크레딧이 부족합니다.");
        if (sessionNow?.access_token) {
          appendStubPayment({
            productSlug: product,
            title,
            amountKrw: price,
            method: "credit",
          });
        }
        setStatus("idle");
        const next = new URLSearchParams(sp.toString());
        next.set("modal", profile === "pair" ? "partner_info" : "fortune_stream");
        next.set("product", product);
        next.set("title", title);
        next.set("price", String(price));
        next.set("character_key", character_key);
        next.set("profile", profile);
        router.replace(`${pathname}?${next.toString()}`);
        return;
      }

      const userRef = sessionNow?.user?.id ?? "guest";

      const checkoutHeaders: HeadersInit = { "Content-Type": "application/json" };
      if (sessionNow?.access_token) {
        checkoutHeaders.Authorization = `Bearer ${sessionNow.access_token}`;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: checkoutHeaders,
        body: JSON.stringify({
          product_slug: product,
          title,
          price_krw: price,
          grant_base: isCreditTopup && grantBase > 0 ? grantBase : undefined,
          method,
          user_ref: userRef,
          first_voice_credit_bonus: isCreditTopup ? firstVoiceCreditBonus : false,
          voice_package_minutes: isVoiceCreditLegacy ? voicePackageMinutes : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data?.error === "login_required") {
        router.replace(creditTopupLoginHref(currentHref));
        return;
      }
      if (!res.ok || !data?.success) throw new Error(data?.error || data?.message || "결제 요청 저장 실패");

      const orderNo = String(data.order?.order_no ?? "");
      if (!orderNo) throw new Error("주문번호를 받지 못했습니다.");

      if (isPg) {
        await launchFortune82PgPayment({
          paymentMethod: method,
          orderNo,
          productSlug: product,
          title,
        });
        return;
      }

      setStatus("idle");

      if (sessionNow?.access_token) {
        appendStubPayment({
          productSlug: product,
          title,
          amountKrw: price,
          method,
        });
      }

      const next = new URLSearchParams(sp.toString());
      next.set("modal", profile === "pair" ? "partner_info" : "fortune_stream");
      next.set("product", product);
      next.set("title", title);
      next.set("price", String(price));
      next.set("character_key", character_key);
      next.set("profile", profile);
      if (data.order?.order_no) next.set("order_no", String(data.order.order_no));
      router.replace(`${pathname}?${next.toString()}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "결제 요청 중 오류가 발생했습니다.");
    }
  };

  return (
    <YeonunSheetPortal>
    <div className="y-modal open" role="dialog" aria-modal="true" aria-label="결제하기" onMouseDown={close}>
      <div className="y-modal-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="y-modal-handle" />
        <div className="y-modal-head">
          <button className="y-modal-back" type="button" onClick={close} aria-label="뒤로">
            <svg viewBox="0 0 24 24">
              <path d="M15 18 L9 12 L15 6" />
            </svg>
          </button>
          <div className="y-modal-title">결제하기</div>
          <button className="y-modal-close" type="button" onClick={close} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="y-modal-scroll">
          <div className="y-pay-section">
            <h3 className="y-pay-section-title">주문 상품</h3>
            <div className="y-pay-product">
              <div className="y-pay-product-cover" aria-hidden="true">
                緣
              </div>
              <div className="y-pay-product-text">
                <div className="y-pay-product-title">{title}</div>
                <div className="y-pay-product-by">
                  {isCreditTopup ? "크레딧 충전 · 충전 후 365일 유효" : "연운의 풀이 · 약 30~60쪽"}
                </div>
              </div>
              <div className="y-pay-product-price">{price.toLocaleString("ko-KR")}원</div>
            </div>
          </div>

          <div className="y-pay-section">
            <h3 className="y-pay-section-title">결제 수단</h3>
          </div>
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
            {isCreditTopup ? null : (
              <div
                className={`y-pay-method y-pay-method--credit-stack ${method === "credit" ? "active" : ""} ${creditBal < price ? "y-pay-method--credit-blocked" : ""}`}
                role="radio"
                aria-checked={method === "credit"}
                aria-disabled={creditBal < price}
                tabIndex={creditBal < price ? -1 : 0}
                onClick={() => {
                  if (creditBal >= price) setMethod("credit");
                }}
              >
                <div className="y-pay-method-credit-row">
                  <div className="y-pay-method-radio" />
                  <div className="y-pay-method-name">크레딧 결제</div>
                  <span className="y-pay-method-icon credit">CREDIT</span>
                </div>
                {creditBal < price ? (
                  <div className="y-pay-credit-short">
                    잔여 {creditBal.toLocaleString("ko-KR")} 크레딧 · 부족
                  </div>
                ) : (
                  <div className="y-pay-credit-short y-pay-credit-short--ok">잔여 {creditBal.toLocaleString("ko-KR")} 크레딧</div>
                )}
              </div>
            )}
          </div>

          <div className="y-pay-summary">
            <div className="y-pay-row">
              <span className="label">상품 금액</span>
              <span className="value">{price.toLocaleString("ko-KR")}원</span>
            </div>
            <div className="y-pay-row discount">
              <span className="label">첫 구매 할인</span>
              <span className="value">-0원</span>
            </div>
            <div className="y-pay-total">
              <div className="y-pay-total-label">최종 결제 금액</div>
              <div className="y-pay-total-value">
                {price.toLocaleString("ko-KR")}
                <span className="small">원</span>
              </div>
            </div>
          </div>

          <div className="y-pay-terms">
            <div className="y-pay-terms-row checked">
              <div className="y-pay-terms-check">✓</div>
              <div className="text">
                <strong style={{ color: "var(--y-ink)" }}>전체 동의</strong>
              </div>
            </div>
            <div className="y-pay-terms-row checked">
              <div className="y-pay-terms-check">✓</div>
              <div className="text">
                [필수]{" "}
                <Link
                  href={legalTermsHref}
                  scroll={false}
                  onClick={() => {
                    rememberSheetBackdropScrollY();
                  }}
                >
                  이용약관
                </Link>{" "}
                동의
              </div>
            </div>
            <div className="y-pay-terms-row checked">
              <div className="y-pay-terms-check">✓</div>
              <div className="text">
                [필수]{" "}
                <Link
                  href={legalPrivacyHref}
                  scroll={false}
                  onClick={() => {
                    rememberSheetBackdropScrollY();
                  }}
                >
                  개인정보처리방침
                </Link>{" "}
                동의
              </div>
            </div>
          </div>

          <div className="y-pay-foot">
            {message ? (
              <div className={`y-pay-status ${status}`}>
                {message}
              </div>
            ) : null}
            <button
              className="y-pay-pay-btn"
              type="button"
              onClick={checkout}
              disabled={status === "loading" || creditBlocked}
            >
              {status === "loading" ? "결제 진행 중..." : payLabel}
            </button>
            {method === "credit" && creditBlocked ? (
              <p style={{ marginTop: 10, fontSize: 12, color: "#c62828", textAlign: "center" }}>
                크레딧이 부족합니다. 충전 후 이용해 주세요.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </YeonunSheetPortal>
  );
}
