"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function PaymentErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const msg = searchParams.get("msg");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const callOpenerFunction = async () => {
      if (window.opener && !window.opener.closed) {
        try {
          const opener = window.opener as Window & {
            handlePaymentError?: (code: string, msg: string) => Promise<void>;
          };
          if (typeof opener.handlePaymentError === "function") {
            await opener.handlePaymentError(code || "UNKNOWN", msg || "Payment failed");
            return true;
          }
        } catch {
          /* ignore */
        }
      }
      return false;
    };

    window.setTimeout(() => {
      let functionCalled = false;
      callOpenerFunction().then((result) => {
        functionCalled = result;
      });
      const interval = window.setInterval(() => {
        if (!functionCalled && window.opener && !window.opener.closed) {
          callOpenerFunction().then((r) => {
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
