"use client";

import type { MyPaymentsPayload } from "@/app/api/my/payments/route";
import { supabaseBrowser } from "@/lib/supabase/client";

export type MyPaymentsCachePayload = MyPaymentsPayload & {
  v: 1;
  fetchedAt: number;
  userId: string;
};

const STORAGE_PREFIX = "yeonun:my-payments:v1";
const MAX_AGE_MS = 1000 * 60 * 5;

let memory = new Map<string, MyPaymentsCachePayload>();
let inflight = new Map<string, Promise<MyPaymentsCachePayload | null>>();

function cacheKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function readMyPaymentsCache(userId: string | null | undefined): MyPaymentsCachePayload | null {
  if (!userId) return null;
  const key = cacheKey(userId);
  const mem = memory.get(key);
  if (mem && Date.now() - mem.fetchedAt < MAX_AGE_MS) return mem;

  if (typeof window === "undefined") return mem ?? null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return mem ?? null;
    const parsed = JSON.parse(raw) as MyPaymentsCachePayload;
    if (parsed?.v !== 1 || parsed.userId !== userId || !Array.isArray(parsed.rows)) return mem ?? null;
    if (Date.now() - (parsed.fetchedAt ?? 0) > MAX_AGE_MS) return mem ?? null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return mem ?? null;
  }
}

export function writeMyPaymentsCache(userId: string, payload: MyPaymentsPayload) {
  const key = cacheKey(userId);
  const entry: MyPaymentsCachePayload = {
    v: 1,
    fetchedAt: Date.now(),
    userId,
    ...payload,
  };
  memory.set(key, entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* quota */
  }
  return entry;
}

export function resolveInitialMyPayments(userId: string | null | undefined): MyPaymentsPayload | null {
  const cached = readMyPaymentsCache(userId);
  if (!cached) return null;
  return {
    ok: true,
    rows: cached.rows,
    yearTotalKrw: cached.yearTotalKrw,
    monthTotalKrw: cached.monthTotalKrw,
  };
}

async function fetchMyPayments(accessToken: string): Promise<MyPaymentsPayload | null> {
  const res = await fetch("/api/my/payments", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = (await res.json()) as MyPaymentsPayload | { ok: false; error?: string };
  if (!res.ok || !("ok" in data) || data.ok !== true) return null;
  return data;
}

export async function preloadMyPayments(): Promise<MyPaymentsCachePayload | null> {
  const sb = supabaseBrowser();
  const session = sb ? (await sb.auth.getSession()).data.session : null;
  const userId = session?.user?.id;
  const token = session?.access_token;
  if (!userId || !token) return null;

  const key = cacheKey(userId);
  const cached = readMyPaymentsCache(userId);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = fetchMyPayments(token)
    .then((payload) => {
      if (!payload) return readMyPaymentsCache(userId);
      return writeMyPaymentsCache(userId, payload) ?? null;
    })
    .catch(() => readMyPaymentsCache(userId))
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
