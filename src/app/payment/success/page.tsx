"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  canonicalPaymentReturnUrl,
  postPaymentResultToOpener,
  shouldRedirectPaymentReturnToCanonical,
  signalPaymentSuccessStorage,
  YEONUN_PAYMENT_SUCCESS_MSG,
} from "@/lib/payment-return-bridge";
import {
  resolvePaymentSuccessRedirectHref,
  waitFortune82PgPaidAndComplete,
} from "@/lib/payment-pg-flow";

const PAGE_BG = "#faf8f5";

function PaymentSuccessBlank() {
  return <div className="min-h-screen" style={{ background: PAGE_BG }} aria-hidden />;
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const oid = searchParams.get("oid");
  const slugFromUrl = searchParams.get("slug");
  const ranRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !oid || ranRef.current) return;

    if (shouldRedirectPaymentReturnToCanonical()) {
      const qs = window.location.search || `?oid=${encodeURIComponent(oid)}`;
      window.location.replace(canonicalPaymentReturnUrl("/payment/success", qs));
      return;
    }

    ranRef.current = true;

    void (async () => {
      const ok = await waitFortune82PgPaidAndComplete(oid, { maxAttempts: 12 });

      if (!ok) {
        setErrorMsg("결제 확인에 실패했습니다. 잠시 후 다시 시도하거나 고객센터로 문의해 주세요.");
        return;
      }

      signalPaymentSuccessStorage(oid);
      postPaymentResultToOpener({
        type: YEONUN_PAYMENT_SUCCESS_MSG,
        oid,
        ok: true,
      });

      const hasOpener = Boolean(window.opener && !window.opener.closed);
      if (hasOpener) {
        window.setTimeout(() => {
          try {
            window.close();
          } catch {
            /* ignore */
          }
        }, 120);
        return;
      }

      const returnHref = await resolvePaymentSuccessRedirectHref(oid, slugFromUrl);
      if (returnHref) {
        window.location.replace(returnHref);
        return;
      }

      setErrorMsg("결제는 완료되었습니다. 앱에서 주문 내역을 확인해 주세요.");
    })();
  }, [oid, slugFromUrl]);

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: PAGE_BG }}>
        <p className="text-center text-[var(--y-ink2)] max-w-md text-sm">{errorMsg}</p>
      </div>
    );
  }

  return <PaymentSuccessBlank />;
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessBlank />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
