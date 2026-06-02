type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function memoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || now >= hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (hit.count >= limit) return false;
  hit.count += 1;
  return true;
}

function windowStartIso(nowMs: number, windowMs: number): string {
  const bucketMs = Math.floor(nowMs / windowMs) * windowMs;
  return new Date(bucketMs).toISOString();
}

async function supabaseRateLimit(key: string, limit: number, windowMs: number): Promise<boolean | null> {
  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = supabaseServer();
    const windowStart = windowStartIso(Date.now(), windowMs);
    const { data, error } = await sb.rpc("try_rate_limit_hit", {
      p_bucket_key: key,
      p_window_start: windowStart,
      p_limit: limit,
    });
    if (error) {
      return null;
    }
    return Boolean(data);
  } catch {
    return null;
  }
}

/** 프로세스 메모리 sliding window — serverless 인스턴스별 제한 (동기 fallback) */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  return memoryRateLimit(key, limit, windowMs);
}

/** Supabase RPC 우선, 실패 시 메모리 fallback */
export async function checkRateLimitAsync(key: string, limit: number, windowMs: number): Promise<boolean> {
  const distributed = await supabaseRateLimit(key, limit, windowMs);
  if (distributed != null) return distributed;
  return memoryRateLimit(key, limit, windowMs);
}

export function clientIpFromRequest(request: Request): string {
  const xf = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xf) return xf;
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}
