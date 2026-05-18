/** 포춘82 PG 결제상태확인 — POST https://www.fortune82.com/api/payment/pcheck.html */

export const FORTUNE82_PCHECK_URL =
  process.env.FORTUNE82_PCHECK_URL ?? "https://www.fortune82.com/api/payment/pcheck.html";

export type Fortune82PcheckCode = "Y" | "N" | "E";

export type Fortune82PcheckResult = {
  code: Fortune82PcheckCode;
  raw: string;
};

function parsePcheckBody(raw: string): Fortune82PcheckCode {
  const t = String(raw ?? "")
    .trim()
    .replace(/^\uFEFF/, "")
    .toUpperCase();
  if (!t) return "E";
  const head = t[0]!;
  if (head === "Y") return "Y";
  if (head === "N") return "N";
  if (head === "E") return "E";
  if (t.includes("결제완료") || t.includes("PAID") || t.includes("SUCCESS")) return "Y";
  if (t.includes("미결제") || t.includes("PENDING") || t.includes("NOT")) return "N";
  return "E";
}

/** oid 기준 PG 결제 완료 여부 — Y 결제완료, N 미결제, E 기타오류 */
export async function checkFortune82PaymentStatus(oid: string): Promise<Fortune82PcheckResult> {
  const orderId = String(oid ?? "").trim();
  if (!orderId) {
    return { code: "E", raw: "empty_oid" };
  }

  try {
    const res = await fetch(FORTUNE82_PCHECK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/plain, */*",
      },
      body: new URLSearchParams({ oid: orderId }).toString(),
      cache: "no-store",
    });
    const raw = (await res.text().catch(() => "")).slice(0, 500);
    if (!res.ok) {
      return { code: "E", raw: raw || `http_${res.status}` };
    }
    return { code: parsePcheckBody(raw), raw };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { code: "E", raw: msg.slice(0, 200) };
  }
}

export function isFortune82PaymentPaid(check: Fortune82PcheckResult): boolean {
  return check.code === "Y";
}
