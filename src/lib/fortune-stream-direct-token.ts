import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000;

function getSecret(): string {
  return String(process.env.CLOUDWAYS_PROXY_SECRET ?? "").trim();
}

/** Cloudways `/chat` 직접 연결용 단기 Bearer 토큰 (프록시 시크릿으로 HMAC) */
export function createFortuneStreamToken(): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Date.now() + TOKEN_TTL_MS;
  const payloadB64 = Buffer.from(JSON.stringify({ exp, v: 1 })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function fortuneStreamTokenTtlMs(): number {
  return TOKEN_TTL_MS;
}

/** Node(Cloudways)에서 동일 알고리즘으로 검증 */
export function verifyFortuneStreamToken(token: string): boolean {
  const secret = getSecret();
  if (!secret || !token?.trim()) return false;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof payload.exp === "number" && Date.now() <= payload.exp;
  } catch {
    return false;
  }
}
