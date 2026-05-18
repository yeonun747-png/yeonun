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

export function resolvePaymentOrigin(clientOrigin?: string | null): string {
  const productionOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yeonun.com").replace(/\/$/, "");
  const raw = typeof clientOrigin === "string" ? clientOrigin.trim() : "";
  if (
    raw &&
    (raw.startsWith("http://localhost") ||
      raw.startsWith("https://localhost") ||
      raw === productionOrigin ||
      raw === "https://yeonun.com" ||
      raw === "https://www.yeonun.com")
  ) {
    return raw.replace(/\/$/, "");
  }
  return productionOrigin;
}
