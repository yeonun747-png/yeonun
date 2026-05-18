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

type SuccessPhase = "loading" | "redirect" | "error";

async function completePaymentOnServer(oid: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("/api/payment/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_no: oid, oid }),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean };
    if (res.ok && data.success) return true;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt));
  }
  return false;
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const oid = searchParams.get("oid");
  const slugFromUrl = searchParams.get("slug");
  const ranRef = useRef(false);
  const [phase, setPhase] = useState<SuccessPhase>("loading");
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
      const serverOk = await completePaymentOnServer(oid);
      const ok = serverOk || (await waitFortune82PgPaidAndComplete(oid, { maxAttempts: 10 }));

      if (!ok) {
        setErrorMsg("결제 확인에 실패했습니다. 잠시 후 다시 시도하거나 고객센터로 문의해 주세요.");
        setPhase("error");
        return;
      }

      signalPaymentSuccessStorage(oid);
      postPaymentResultToOpener({
        type: YEONUN_PAYMENT_SUCCESS_MSG,
        oid,
        ok: true,
      });

      const returnHref = await resolvePaymentSuccessRedirectHref(oid, slugFromUrl);
      if (returnHref) {
        setPhase("redirect");
        window.location.replace(returnHref);
        return;
      }

      setErrorMsg("결제는 완료되었습니다. 앱에서 주문 내역을 확인해 주세요.");
      setPhase("error");
    })();
  }, [oid, slugFromUrl]);

  if (!oid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#faf8f5" }}>
        <div className="text-center max-w-md">
          <p className="text-[var(--y-ink2)] mb-4">결제 완료 페이지입니다. 주문 정보가 전달되지 않았습니다.</p>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#faf8f5" }}>
        <p className="text-center text-[var(--y-ink2)] max-w-md">{errorMsg ?? "결제 처리 중 문제가 발생했습니다."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#faf8f5" }}>
      <p className="text-sm text-[var(--y-mute)]">
        {phase === "redirect" ? "결제 완료. 결과 화면으로 이동합니다…" : "결제를 확인하고 있어요…"}
      </p>
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
