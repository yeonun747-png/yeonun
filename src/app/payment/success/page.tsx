"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { waitFortune82PgPaidAndComplete } from "@/lib/payment-pg-flow";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const oid = searchParams.get("oid");

  useEffect(() => {
    if (typeof window === "undefined" || !oid) return;

    const callOpenerFunction = async () => {
      if (window.opener && !window.opener.closed) {
        try {
          const opener = window.opener as Window & { handlePaymentSuccess?: (oid: string) => Promise<void> };
          if (typeof opener.handlePaymentSuccess === "function") {
            await opener.handlePaymentSuccess(oid);
            return true;
          }
        } catch {
          /* ignore */
        }
      }
      return false;
    };

    void waitFortune82PgPaidAndComplete(oid).then(() => {
      try {
        localStorage.setItem("payment_success_oid", oid);
        localStorage.setItem("payment_success_timestamp", Date.now().toString());
      } catch {
        /* ignore */
      }

      let functionCalled = false;
      const tryClose = () => {
        if (window.opener && !window.opener.closed && !functionCalled) return;
        try {
          window.close();
        } catch {
          /* ignore */
        }
      };

      callOpenerFunction().then((result) => {
        functionCalled = result;
        if (result) window.setTimeout(tryClose, 300);
      });

      const messageInterval = window.setInterval(() => {
        if (!functionCalled && window.opener && !window.opener.closed) {
          callOpenerFunction().then((result) => {
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

  return null;
}

function PaymentSuccessFallback() {
  return null;
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
