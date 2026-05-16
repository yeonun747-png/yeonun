"use client";

import { foreignScriptNeedsTranslation } from "@/lib/fortune-foreign-script-detect";

const sessionCache = new Map<string, string>();
const inflight = new Map<string, Promise<Record<string, string>>>();

export { foreignScriptNeedsTranslation };

export async function fetchForeignScriptTranslations(texts: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(texts.map((t) => String(t ?? "").trim()).filter(Boolean))];
  const need = unique.filter((t) => foreignScriptNeedsTranslation(t) && !sessionCache.has(t));
  if (need.length === 0) {
    const out: Record<string, string> = {};
    for (const t of unique) {
      const c = sessionCache.get(t);
      if (c) out[t] = c;
    }
    return out;
  }

  const batchKey = need.sort().join("\u0001");
  let p = inflight.get(batchKey);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch("/api/fortune/foreign-script-fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: need }),
        });
        if (!res.ok) return {};
        const data = (await res.json()) as { ok?: boolean; translations?: Record<string, string> };
        const tr = data.ok && data.translations && typeof data.translations === "object" ? data.translations : {};
        for (const [k, v] of Object.entries(tr)) {
          if (typeof v === "string" && v.trim()) sessionCache.set(k, v.trim());
        }
        return tr;
      } catch {
        return {};
      } finally {
        inflight.delete(batchKey);
      }
    })();
    inflight.set(batchKey, p);
  }

  await p;

  const out: Record<string, string> = {};
  for (const t of unique) {
    const c = sessionCache.get(t);
    if (c) out[t] = c;
  }
  return out;
}
