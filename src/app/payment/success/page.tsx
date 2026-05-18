"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import {
  canonicalPaymentReturnUrl,
  postPaymentResultToOpener,
  shouldRedirectPaymentReturnToCanonical,
  YEONUN_PAYMENT_SUCCESS_MSG,
} from "@/lib/payment-return-bridge";
import { waitFortune82PgPaidAndComplete } from "@/lib/payment-pg-flow";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const oid = searchParams.get("oid");
  const ranRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !oid || ranRef.current) return;

    if (shouldRedirectPaymentReturnToCanonical()) {
      const qs = window.location.search || `?oid=${encodeURIComponent(oid)}`;
      window.location.replace(canonicalPaymentReturnUrl("/payment/success", qs));
      return;
    }

    ranRef.current = true;

    const callOpenerFunction = async () => {
      if (window.opener && !window.opener.closed) {
        try {
          const opener = window.opener as Window & { handlePaymentSuccess?: (oid: string) => Promise<void> };
          if (typeof opener.handlePaymentSuccess === "function") {
            await opener.handlePaymentSuccess(oid);
            return true;
          }
        } catch {
          /* cross-origin — postMessage 폴백 */
        }
      }
      return false;
    };

    void waitFortune82PgPaidAndComplete(oid).then(async (ok) => {
      try {
        localStorage.setItem("payment_success_oid", oid);
        localStorage.setItem("payment_success_timestamp", Date.now().toString());
      } catch {
        /* ignore */
      }

      postPaymentResultToOpener({
        type: YEONUN_PAYMENT_SUCCESS_MSG,
        oid,
        ok,
      });

      let functionCalled = false;
      const tryClose = () => {
        if (window.opener && !window.opener.closed && !functionCalled) return;
        try {
          window.close();
        } catch {
          /* ignore */
        }
      };

      const direct = await callOpenerFunction();
      functionCalled = direct;
      if (direct) window.setTimeout(tryClose, 300);

      const messageInterval = window.setInterval(() => {
        if (!functionCalled && window.opener && !window.opener.closed) {
          void callOpenerFunction().then((result) => {
            if (result) functionCalled = true;
          });
        }
        tryClose();
      }, 150);

      window.setTimeout(() => {
        window.clearInterval(messageInterval);
        tryClose();
      }, 2500);
    });
  }, [oid]);

  if (!oid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#faf8f5" }}>
        <div className="text-center max-w-md">
          <p className="text-[var(--y-ink2)] mb-4">결제 완료 페이지입니다. 주문 정보가 전달되지 않았습니다.</p>
          <button type="button" className="y-fortune-v2-primary" onClick={() => window.close()}>
            창 닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#faf8f5" }}>
      <p className="text-sm text-[var(--y-mute)]">결제를 확인하고 있어요…</p>
    </div>
  );
}

function PaymentSuccessFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#faf8f5" }}>
      <p className="text-sm text-[var(--y-mute)]">결제를 확인하고 있어요…</p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
