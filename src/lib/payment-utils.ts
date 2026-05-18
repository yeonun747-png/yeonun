/**
 * 포춘82 PG 연동 유틸 (reunionf82 동일 규칙)
 */

/** PG oid — AI + 연월일시분초 + _ + 타임스탬프 (예: AI20260112163927_1768203567) */
export function generateOrderId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  const dateTime = `${year}${month}${day}${hour}${minute}${second}`;
  return `AI${dateTime}_${Date.now()}`;
}

export function formatPaymentCode(code: number | string | null | undefined): string {
  const n = Number(code);
  if (!Number.isFinite(n) || n < 1000 || n > 9999) return "";
  return String(Math.floor(n)).padStart(4, "0");
}

/** PG 상품명 byte 제한(한글 3바이트/자 가정) */
export function truncateStringByBytes(str: string, maxBytes: number): string {
  if (!str) return "";
  let totalBytes = 0;
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i]!;
    const charCode = char.charCodeAt(0);
    const charBytes = charCode <= 127 ? 1 : 3;
    if (totalBytes + charBytes > maxBytes) break;
    totalBytes += charBytes;
    result += char;
  }
  return result;
}

/**
 * PG 성공/실패 리다이렉트 origin — 운영은 항상 연운 canonical.
 * (포춘82는 form successUrl 대신 payment_code 가맹점 URL로 보내는 경우가 있어,
 *  클라이언트 origin·fortune82 도메인은 절대 사용하지 않음)
 */
export function resolvePaymentOrigin(clientOrigin?: string | null): string {
  const canonical = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yeonun.com").replace(/\/$/, "");
  const raw = typeof clientOrigin === "string" ? clientOrigin.trim().replace(/\/$/, "") : "";
  if (
    raw &&
    (raw.startsWith("http://localhost") ||
      raw.startsWith("https://localhost") ||
      raw.startsWith("http://127.0.0.1") ||
      raw.startsWith("https://127.0.0.1"))
  ) {
    return raw;
  }
  return canonical;
}
