"use client";

import {
  clearPaymentSuccessStorage,
  isTrustedPaymentOpenerMessage,
  PAYMENT_SUCCESS_OID_KEY,
  PAYMENT_SUCCESS_SIGNAL_KEY,
  readPaymentSuccessOidFromStorage,
  readPgPendingSession,
  clearPgPendingSession,
  writePgPendingSession,
  YEONUN_PAYMENT_ERROR_MSG,
  YEONUN_PAYMENT_SUCCESS_MSG,
} from "@/lib/payment-return-bridge";

export type PgPaymentMethod = "card" | "phone";

export type LaunchPgPaymentParams = {
  paymentMethod: PgPaymentMethod;
  orderNo: string;
  productSlug: string;
  title: string;
};

export type PgPaymentHandlers = {
  onSuccess: (orderNo: string) => void | Promise<void>;
  onError: (code: string, msg: string) => void;
};

let handlersRef: PgPaymentHandlers | null = null;
let paymentWindowRef: Window | null = null;
let paymentPollTimer: ReturnType<typeof setInterval> | null = null;
let paymentCloseWatchTimer: ReturnType<typeof setInterval> | null = null;
let paymentStoragePollTimer: ReturnType<typeof setInterval> | null = null;
let paymentStorageListener: ((e: StorageEvent) => void) | null = null;
let paymentFlowCompletedOrderNo: string | null = null;

function stopPaymentWatchers() {
  if (paymentPollTimer) {
    clearInterval(paymentPollTimer);
    paymentPollTimer = null;
  }
  if (paymentCloseWatchTimer) {
    clearInterval(paymentCloseWatchTimer);
    paymentCloseWatchTimer = null;
  }
  if (paymentStoragePollTimer) {
    clearInterval(paymentStoragePollTimer);
    paymentStoragePollTimer = null;
  }
  if (paymentStorageListener && typeof window !== "undefined") {
    window.removeEventListener("storage", paymentStorageListener);
    paymentStorageListener = null;
  }
}

function consumePaymentSuccessFromStorage(): void {
  const oid = readPaymentSuccessOidFromStorage();
  if (!oid || paymentFlowCompletedOrderNo === oid) return;
  void finishPaymentFromOpener(oid, { maxAttempts: 15 });
}

function installPaymentStorageBridge(): void {
  if (typeof window === "undefined") return;
  if (!paymentStorageListener) {
    paymentStorageListener = (e: StorageEvent) => {
      if (e.key === PAYMENT_SUCCESS_OID_KEY || e.key === PAYMENT_SUCCESS_SIGNAL_KEY) {
        consumePaymentSuccessFromStorage();
      }
    };
    window.addEventListener("storage", paymentStorageListener);
  }
  if (!paymentStoragePollTimer) {
    paymentStoragePollTimer = setInterval(consumePaymentSuccessFromStorage, 1200);
  }
  consumePaymentSuccessFromStorage();
}

/** PG가 reunion.fortune82.com 등으로내도 연운(opener)에서 pcheck 후 다음 화면 진행 */
async function finishPaymentFromOpener(orderNo: string, opts?: { maxAttempts?: number }): Promise<boolean> {
  const oid = String(orderNo ?? "").trim();
  if (!oid || paymentFlowCompletedOrderNo === oid) return paymentFlowCompletedOrderNo === oid;

  const ok = await waitFortune82PgPaidAndComplete(oid, { maxAttempts: opts?.maxAttempts ?? 12 });
  if (!ok) return false;

  paymentFlowCompletedOrderNo = oid;
  stopPaymentWatchers();
  clearPaymentSuccessStorage();
  clearPgPendingSession();
  await handlersRef?.onSuccess(oid);
  try {
    paymentWindowRef?.close();
  } catch {
    /* ignore */
  }
  paymentWindowRef = null;
  return true;
}

function startPaymentWatchers(orderNo: string) {
  stopPaymentWatchers();
  paymentFlowCompletedOrderNo = null;

  paymentPollTimer = setInterval(() => {
    void finishPaymentFromOpener(orderNo, { maxAttempts: 3 });
  }, 2000);

  paymentCloseWatchTimer = setInterval(() => {
    if (!paymentWindowRef || paymentWindowRef.closed) {
      void finishPaymentFromOpener(orderNo, { maxAttempts: 15 });
    }
  }, 600);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** PG pcheck Y 확인 후 /api/payment/complete — 성공 페이지·opener 공통 */
export async function waitFortune82PgPaidAndComplete(
  oid: string,
  opts?: { maxAttempts?: number },
): Promise<boolean> {
  const orderNo = String(oid ?? "").trim();
  if (!orderNo) return false;
  const maxAttempts = Math.max(1, opts?.maxAttempts ?? 15);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const statusRes = await fetch(`/api/payment/status?oid=${encodeURIComponent(orderNo)}`, {
      cache: "no-store",
    });
    const statusData = (await statusRes.json().catch(() => ({}))) as {
      success?: boolean;
      status?: string;
      pg_check?: string;
      pg_paid?: boolean;
      db_paid?: boolean;
    };

    if (statusData.db_paid || statusData.status === "success") {
      return true;
    }

    if (statusData.pg_paid || statusData.pg_check === "Y") {
      const completeRes = await fetch("/api/payment/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_no: orderNo }),
      });
      const completeData = (await completeRes.json().catch(() => ({}))) as { success?: boolean };
      if (completeRes.ok && completeData.success) {
        return true;
      }
    }

    if (statusData.pg_check === "E" && attempt >= 4) {
      return false;
    }

    if (attempt < maxAttempts) {
      await sleep(Math.min(4000, 500 + attempt * 400));
    }
  }

  return false;
}

function assignWindowHandlers() {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    handlePaymentSuccess?: (oid: string) => Promise<void>;
    handlePaymentError?: (code: string, msg: string) => Promise<void>;
  };

  w.handlePaymentSuccess = async (oid: string) => {
    const done = await finishPaymentFromOpener(oid, { maxAttempts: 15 });
    if (!done && paymentFlowCompletedOrderNo !== oid) {
      handlersRef?.onError("T104", "결제 확인에 실패했습니다. 고객센터로 문의해 주세요.");
    }
  };

  w.handlePaymentError = async (code: string, msg: string) => {
    stopPaymentWatchers();
    paymentFlowCompletedOrderNo = null;
    handlersRef?.onError(code, msg);
    try {
      paymentWindowRef?.close();
    } catch {
      /* ignore */
    }
    paymentWindowRef = null;
  };
}

function installPaymentMessageListener() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __yeonunPaymentMsgInstalled?: boolean };
  if (w.__yeonunPaymentMsgInstalled) return;
  w.__yeonunPaymentMsgInstalled = true;

  window.addEventListener("message", (event: MessageEvent) => {
    if (!isTrustedPaymentOpenerMessage(event)) return;
    const data = event.data as {
      type?: string;
      oid?: string;
      ok?: boolean;
      code?: string;
      msg?: string;
    };
    if (data.type === YEONUN_PAYMENT_SUCCESS_MSG && data.oid) {
      const w2 = window as Window & { handlePaymentSuccess?: (oid: string) => Promise<void> };
      if (typeof w2.handlePaymentSuccess === "function") {
        void w2.handlePaymentSuccess(String(data.oid));
      }
    }
    if (data.type === YEONUN_PAYMENT_ERROR_MSG) {
      const w2 = window as Window & { handlePaymentError?: (code: string, msg: string) => Promise<void> };
      if (typeof w2.handlePaymentError === "function") {
        void w2.handlePaymentError(String(data.code ?? "UNKNOWN"), String(data.msg ?? "Payment failed"));
      }
    }
  });
}

export function registerPgPaymentHandlers(handlers: PgPaymentHandlers): () => void {
  handlersRef = handlers;
  assignWindowHandlers();
  installPaymentMessageListener();
  installPaymentStorageBridge();
  return () => {
    if (handlersRef === handlers) {
      handlersRef = null;
      stopPaymentWatchers();
    }
  };
}

/** 포춘82 PG 팝업 결제 (카드·휴대폰) */
export async function launchFortune82PgPayment(params: LaunchPgPaymentParams): Promise<void> {
  const { paymentMethod, orderNo, productSlug, title } = params;

  const res = await fetch("/api/payment/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentMethod,
      order_no: orderNo,
      product_slug: productSlug,
      title,
      successOrigin:
        (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yeonun.com").trim() ||
        (typeof window !== "undefined" ? window.location.origin : undefined),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || "결제 요청에 실패했습니다.");
  }

  const { paymentUrl, formData, successUrl, failUrl } = data.data as {
    paymentUrl: string;
    formData: Record<string, string>;
    successUrl?: string;
    failUrl?: string;
  };

  const form = document.createElement("form");
  form.method = "POST";
  form.action = paymentUrl;
  form.style.display = "none";

  const redirectFields: Record<string, string> =
    successUrl && failUrl
      ? {
          successUrl,
          failUrl,
          success_url: successUrl,
          fail_url: failUrl,
          returnUrl: successUrl,
          return_url: successUrl,
          ret_url: successUrl,
          nextUrl: successUrl,
        }
      : {};

  const fullFormData: Record<string, string> = {
    ...Object.fromEntries(Object.entries(formData).map(([k, v]) => [k, String(v)])),
    ...redirectFields,
  };

  Object.entries(fullFormData).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);

  const paymentWindowName = `yeonun_payment_${orderNo}`;
  const paymentWindow = window.open("about:blank", paymentWindowName, "width=800,height=600");
  paymentWindowRef = paymentWindow;

  if (!paymentWindow) {
    document.body.removeChild(form);
    throw new Error("팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해 주세요.");
  }

  form.target = paymentWindowName;
  paymentWindow.focus();

  try {
    form.submit();
  } catch {
    /* ignore */
  }
  if (document.body.contains(form)) document.body.removeChild(form);

  if (typeof window !== "undefined") {
    const returnHref = `${window.location.pathname}${window.location.search}`;
    writePgPendingSession({ orderNo, productSlug, returnHref });
  }

  startPaymentWatchers(orderNo);
}

/** 성공 URL을 직접 연 경우(부모 창 없음) 복귀 경로 */
export function resolvePaymentSuccessFallbackHref(orderNo: string): string | null {
  const pending = readPgPendingSession();
  if (pending && pending.orderNo === orderNo) {
    const sep = pending.returnHref.includes("?") ? "&" : "?";
    return `${pending.returnHref}${sep}order_no=${encodeURIComponent(orderNo)}`;
  }
  if (pending?.productSlug) {
    return `/fortune/${pending.productSlug}?order_no=${encodeURIComponent(orderNo)}`;
  }
  return null;
}
