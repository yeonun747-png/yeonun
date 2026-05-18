"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import {
  canonicalPaymentReturnUrl,
  postPaymentResultToOpener,
  shouldRedirectPaymentReturnToCanonical,
  YEONUN_PAYMENT_ERROR_MSG,
} from "@/lib/payment-return-bridge";

function PaymentErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const msg = searchParams.get("msg");
  const ranRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || ranRef.current) return;

    if (shouldRedirectPaymentReturnToCanonical()) {
      const qs = window.location.search || "";
      window.location.replace(canonicalPaymentReturnUrl("/payment/error", qs));
      return;
    }

    ranRef.current = true;
    const errCode = code || "UNKNOWN";
    const errMsg = msg || "Payment failed";

    const callOpenerFunction = async () => {
      if (window.opener && !window.opener.closed) {
        try {
          const opener = window.opener as Window & {
            handlePaymentError?: (code: string, msg: string) => Promise<void>;
          };
          if (typeof opener.handlePaymentError === "function") {
            await opener.handlePaymentError(errCode, errMsg);
            return true;
          }
        } catch {
          /* cross-origin */
        }
      }
      return false;
    };

    postPaymentResultToOpener({
      type: YEONUN_PAYMENT_ERROR_MSG,
      code: errCode,
      msg: errMsg,
    });

    window.setTimeout(() => {
      let functionCalled = false;
      void callOpenerFunction().then((result) => {
        functionCalled = result;
      });
      const interval = window.setInterval(() => {
        if (!functionCalled && window.opener && !window.opener.closed) {
          void callOpenerFunction().then((r) => {
            if (r) functionCalled = true;
          });
        }
        if (functionCalled) {
          window.clearInterval(interval);
          try {
            window.close();
          } catch {
            /* ignore */
          }
        }
      }, 100);
      window.setTimeout(() => {
        window.clearInterval(interval);
        try {
          window.close();
        } catch {
          /* ignore */
        }
      }, 3000);
    }, 300);
  }, [code, msg]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--y-bg, #faf8f5)" }}>
      <div className="text-center max-w-md p-6 rounded-2xl border border-[var(--y-line)] bg-white">
        <p className="text-lg font-bold mb-2">결제가 완료되지 않았어요</p>
        <p className="text-sm text-[var(--y-mute)] mb-4">잠시 후 다시 시도해 주세요.</p>
        {code ? <p className="text-xs text-[var(--y-mute)] font-mono">코드: {code}</p> : null}
        <button type="button" className="y-fortune-v2-primary mt-6" onClick={() => window.close()}>
          창 닫기
        </button>
      </div>
    </div>
  );
}

export default function PaymentErrorPage() {
  return (
    <Suspense fallback={null}>
      <PaymentErrorContent />
    </Suspense>
  );
}
