"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useModalControls } from "@/components/modals/useModalControls";
import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import {
  applyPurchasedCredits,
  markFirstCreditPurchaseDone,
  readWallet,
  spendableTotalCredits,
  spendCreditsForOrder,
  YEONUN_CREDIT_UPDATE_EVENT,
} from "@/lib/credit-balance-local";
import { readAuthStubLoggedIn } from "@/lib/auth-stub";
import { firstChargeTotalCredits } from "@/lib/credit-policy";
import { appendStubPayment } from "@/lib/payments-history-stub";
import { supabaseBrowser } from "@/lib/supabase/client";

export function PaymentModal() {
  const { close } = useModalControls();
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

  const creditBlocked = useMemo(
    () => !isCreditTopup && method === "credit" && creditBal < price,
    [isCreditTopup, method, creditBal, price],
  );

  const payLabel = `${price.toLocaleString("ko-KR")}원 결제하기`;

  const checkout = async () => {
    if (status === "loading") return;
    if (method === "credit" && creditBal < price) return;
    setStatus("loading");
    setMessage("");
    try {
      if (method === "credit" && !isCreditTopup) {
        const spent = spendCreditsForOrder(price);
        if (spent < price) throw new Error("크레딧이 부족합니다.");
        if (readAuthStubLoggedIn()) {
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

      const sb = supabaseBrowser();
      const session = sb ? (await sb.auth.getSession()).data.session : null;
      const userRef = session?.user?.id ?? "guest";

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_slug: product,
          title,
          price_krw: price,
          method,
          user_ref: userRef,
          first_voice_credit_bonus: isCreditTopup ? firstVoiceCreditBonus : false,
          voice_package_minutes: isVoiceCreditLegacy ? voicePackageMinutes : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "결제 요청 저장 실패");
      setStatus("idle");

      if (readAuthStubLoggedIn()) {
        appendStubPayment({
          productSlug: product,
          title,
          amountKrw: price,
          method,
        });
      }

      if (isCreditTopup) {
        const walletBefore = readWallet();
        let credits =
          isVoiceCreditLegacy
            ? Math.max(0, voicePackageMinutes) * 390
            : Number.isFinite(grantBase) && grantBase > 0
              ? Math.floor(grantBase)
              : Math.floor(price);
        if (firstVoiceCreditBonus && !walletBefore.firstPurchaseDone) {
          credits = firstChargeTotalCredits(credits);
        }
        applyPurchasedCredits(credits);
        if (firstVoiceCreditBonus && !walletBefore.firstPurchaseDone) {
          markFirstCreditPurchaseDone();
        }
        router.replace(pathname);
        return;
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
                [필수] <a href="/legal/terms">결제 약관</a> 동의
              </div>
            </div>
            <div className="y-pay-terms-row checked">
              <div className="y-pay-terms-check">✓</div>
              <div className="text">
                [필수] <a href="/legal/terms">전자상거래 약관</a> 동의
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
              {status === "loading" ? "주문 생성 중..." : payLabel}
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
