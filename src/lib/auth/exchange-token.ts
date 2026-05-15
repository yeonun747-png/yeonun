import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import { authSecret } from "@/lib/auth/oauth-env";

const MAX_AGE_MS = 120_000;

export type ExchangeTokenPayload = {
  authUserId: string;
  email: string;
  isNewUser: boolean;
  exp: number;
  nonce: string;
};

export function createExchangeToken(payload: Omit<ExchangeTokenPayload, "exp" | "nonce">): string {
  const body: ExchangeTokenPayload = {
    ...payload,
    nonce: randomBytes(12).toString("base64url"),
    exp: Date.now() + MAX_AGE_MS,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", authSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyExchangeToken(token: string): ExchangeTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", authSecret()).update(encoded).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ExchangeTokenPayload;
    if (!payload?.authUserId || !payload?.email || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
