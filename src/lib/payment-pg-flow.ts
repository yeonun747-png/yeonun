"use client";

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

function assignWindowHandlers() {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    handlePaymentSuccess?: (oid: string) => Promise<void>;
    handlePaymentError?: (code: string, msg: string) => Promise<void>;
  };

  w.handlePaymentSuccess = async (oid: string) => {
    try {
      const statusRes = await fetch(`/api/payment/status?oid=${encodeURIComponent(oid)}`, { cache: "no-store" });
      const statusData = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok || statusData.status !== "success") {
        await fetch("/api/payment/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_no: oid }),
        });
      }
      await handlersRef?.onSuccess(oid);
    } finally {
      try {
        paymentWindowRef?.close();
      } catch {
        /* ignore */
      }
      paymentWindowRef = null;
    }
  };

  w.handlePaymentError = async (code: string, msg: string) => {
    handlersRef?.onError(code, msg);
    try {
      paymentWindowRef?.close();
    } catch {
      /* ignore */
    }
    paymentWindowRef = null;
  };
}

export function registerPgPaymentHandlers(handlers: PgPaymentHandlers): () => void {
  handlersRef = handlers;
  assignWindowHandlers();
  return () => {
    if (handlersRef === handlers) handlersRef = null;
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
      successOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
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
}
