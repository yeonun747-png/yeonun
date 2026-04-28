"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useModalControls } from "@/components/modals/useModalControls";

export function PaymentModal() {
  const { close } = useModalControls();
  const sp = useSearchParams();
  const product = sp.get("product") ?? "reunion-maybe";
  const title = sp.get("title") ?? "그 사람과 다시 만날 수 있을까";
  const price = Number(sp.get("price") ?? "14900");

  const [method, setMethod] = useState<"card" | "phone" | "coin">("card");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const payLabel = `${price.toLocaleString("ko-KR")}원 결제하기`;

  const checkout = async () => {
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_slug: product,
          title,
          price_krw: price,
          method,
          user_ref: "guest",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "결제 요청 저장 실패");
      setStatus("done");
      setMessage(`주문 ${data.order?.order_no ?? ""} 생성 · 점사 요청 대기열 등록`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "결제 요청 중 오류가 발생했습니다.");
    }
  };

  return (
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
                <div className="y-pay-product-by">연운의 풀이 · 약 30~60쪽</div>
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
            <div
              className={`y-pay-method ${method === "coin" ? "active" : ""}`}
              role="radio"
              aria-checked={method === "coin"}
              tabIndex={0}
              onClick={() => setMethod("coin")}
            >
              <div className="y-pay-method-radio" />
              <div className="y-pay-method-name">코인 결제</div>
              <span className="y-pay-method-icon coin">FORTUNE82</span>
            </div>
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
            <button className="y-pay-pay-btn" type="button" onClick={status === "done" ? close : checkout} disabled={status === "loading"}>
              {status === "loading" ? "주문 생성 중..." : status === "done" ? "확인" : payLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

