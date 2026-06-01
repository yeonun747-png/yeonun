import { createHmac, timingSafeEqual } from "crypto";

import { isCarouselCharKey, type CarouselCharKey } from "@/lib/characters/character-carousel-static";

export const DAILY_WORD_SHARE_MAX_QUOTE = 320;

export type DailyWordSharePayload = {
  v: 1;
  c: CarouselCharKey;
  l: string;
  q: string;
  d: string;
  exp: number;
};

function shareSecret(): string {
  const s = process.env.DAILY_WORD_SHARE_SECRET?.trim() || "";
  if (!s) throw new Error("missing_daily_word_share_secret");
  return s;
}

function signBody(body: string): string {
  return createHmac("sha256", shareSecret()).update(body).digest("base64url");
}

export function createDailyWordShareToken(input: {
  character_key: CarouselCharKey;
  character_label: string;
  quote: string;
  kst_date: string;
}): string {
  const quote = String(input.quote ?? "").trim().slice(0, DAILY_WORD_SHARE_MAX_QUOTE);
  const label = String(input.character_label ?? "").trim().slice(0, 40);
  if (!quote || !label) throw new Error("empty_share_payload");

  const payload: DailyWordSharePayload = {
    v: 1,
    c: input.character_key,
    l: label,
    q: quote,
    d: input.kst_date,
    exp: Math.floor(Date.now() / 1000) + 90 * 24 * 3600,
  };

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function verifyDailyWordShareToken(token: string): DailyWordSharePayload | null {
  const raw = String(token ?? "").trim();
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = signBody(body);
  } catch {
    return null;
  }

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DailyWordSharePayload;
    if (parsed.v !== 1) return null;
    if (!isCarouselCharKey(parsed.c)) return null;
    if (!parsed.l?.trim() || !parsed.q?.trim()) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.d)) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
