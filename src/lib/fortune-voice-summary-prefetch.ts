/** 점사 완료 직후 음성 상담용 Haiku 요약 — 보관함 CTA 즉시 이동용 DB 선저장 */

const inflightByResultId = new Map<string, Promise<string | null>>();
const summarizeByHtmlKey = new Map<string, Promise<string | null>>();

function htmlDedupeKey(html: string): string {
  const h = html.trim();
  if (h.length <= 120) return h;
  return `${h.length}:${h.slice(0, 80)}:${h.slice(-40)}`;
}

async function callSummarizeApi(html: string): Promise<string | null> {
  const h = html.trim();
  if (!h) return null;
  try {
    const res = await fetch("/api/fortune/summarize-for-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: h }),
    });
    const j = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
    if (!res.ok || typeof j.summary !== "string" || !j.summary.trim()) return null;
    return j.summary.trim();
  } catch {
    return null;
  }
}

/** Haiku 요약만(동일 본문 중복 호출 공유) */
export function summarizeFortuneVoiceHtml(html: string): Promise<string | null> {
  const key = htmlDedupeKey(html);
  if (!key) return Promise.resolve(null);
  const existing = summarizeByHtmlKey.get(key);
  if (existing) return existing;

  const p = callSummarizeApi(html).finally(() => {
    if (summarizeByHtmlKey.get(key) === p) summarizeByHtmlKey.delete(key);
  });
  summarizeByHtmlKey.set(key, p);
  return p;
}

export async function persistFortuneVoiceSummary(resultId: string, summary: string): Promise<void> {
  const rid = String(resultId ?? "").trim();
  const text = String(summary ?? "").trim();
  if (!rid || !text) return;
  try {
    await fetch("/api/fortune/result-voice-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result_id: rid, voice_consult_summary: text }),
    });
  } catch {
    // ignore
  }
}

export function getFortuneVoiceSummaryPrefetch(resultId: string): Promise<string | null> | null {
  const rid = String(resultId ?? "").trim();
  if (!rid) return null;
  return inflightByResultId.get(rid) ?? null;
}

/**
 * Haiku 요약 후 fortune_results.voice_consult_summary 저장.
 * 동일 result_id 중복 호출은 진행 중 Promise를 공유한다.
 */
export function prefetchFortuneVoiceSummary(html: string, resultId: string): Promise<string | null> {
  const rid = String(resultId ?? "").trim();
  const h = String(html ?? "").trim();
  if (!rid || !h) return Promise.resolve(null);

  const existing = inflightByResultId.get(rid);
  if (existing) return existing;

  const p = summarizeFortuneVoiceHtml(h).then(async (text) => {
    if (text) await persistFortuneVoiceSummary(rid, text);
    return text;
  });

  inflightByResultId.set(rid, p);
  void p.finally(() => {
    if (inflightByResultId.get(rid) === p) inflightByResultId.delete(rid);
  });
  return p;
}

/** UI 블로킹 없이 백그라운드 요약·DB 저장 */
export function scheduleFortuneVoiceSummaryPrefetch(html: string, resultId: string): void {
  void prefetchFortuneVoiceSummary(html, resultId);
}

/**
 * 점사 저장 API와 병렬로 Haiku 요약 시작 — result_id 수신 후 DB 반영.
 */
export function scheduleFortuneVoiceSummaryParallel(
  html: string,
  resultIdPromise: Promise<string | null>,
): void {
  const h = String(html ?? "").trim();
  if (!h) return;

  const summaryP = summarizeFortuneVoiceHtml(h);

  void resultIdPromise.then((rid) => {
    const resultId = String(rid ?? "").trim();
    if (!resultId) return;
    if (inflightByResultId.has(resultId)) return;

    const p = summaryP.then(async (text) => {
      if (text) await persistFortuneVoiceSummary(resultId, text);
      return text;
    });

    inflightByResultId.set(resultId, p);
    void p.finally(() => {
      if (inflightByResultId.get(resultId) === p) inflightByResultId.delete(resultId);
    });
  });
}
