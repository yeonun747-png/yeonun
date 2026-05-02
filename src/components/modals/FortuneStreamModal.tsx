"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { partnerInfoFromPartnerStorage, readUserInfoFromYeonunSajuV1 } from "@/lib/fortune-claude-stream-user";
import { buildFortuneManseContext } from "@/lib/fortune-manse-context";
import { setVoiceManseMeta } from "@/lib/voice-dcc-manse-meta";
import {
  normalizeFortuneSsePayload,
  parseFortuneSseBlock,
  type FortuneStreamEvt,
  type FortuneTocItem,
} from "@/lib/fortune-stream-client";
import { FortuneStreamSectionMedia } from "@/components/modals/FortuneStreamSectionMedia";
import { FortuneVoiceConsultDock } from "@/components/modals/FortuneVoiceConsultDock";
import { joinSectionHtmlForLibrarySave } from "@/lib/fortune-saved-html-toc";
import { splitHtmlAfterFirstSubtitleH3Close } from "@/lib/fortune-section-html-split";
import type { FortuneTocMainGroup } from "@/lib/product-fortune-menu";
import { demoTocSections, type DemoProfile } from "@/lib/fortune-two-stage-demo";

/** 음성 무료 잔여(초). 없으면 첫 방문 시 충분히 크게 두고, 0이면 충전 유도 */
const LS_VOICE_BALANCE_SEC = "yeonun_voice_balance_sec";

const CHAR_NAME: Record<string, string> = {
  yeon: "연화",
  byeol: "별하",
  yeo: "여연",
  un: "운서",
};

/** Cloudways 단일 HTML SSE vs 로컬 데모(501) 멀티섹션 SSE */
type FortuneStreamPumpMode = "claude_html_stream" | "sections";

function kstDateShortDots(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}.${m}.${d}.`;
}

function countApproxChars(htmlBySection: Record<number, string>): number {
  let n = 0;
  for (const v of Object.values(htmlBySection)) {
    n += v.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().length;
  }
  return n;
}

function countApproxCharsFromHtml(html: string): number {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().length;
}

/** 스트리밍 HTML 안에서 완결된 subtitle-section 루트 개수(목차 동기화용) */
function countSubtitleSections(html: string): number {
  if (!html) return 0;
  const re = /<div\b[^>]*\bclass\s*=\s*["'][^"']*\bsubtitle-section\b[^"']*["'][^>]*>/gi;
  let n = 0;
  for (const _ of html.matchAll(re)) n += 1;
  return n;
}

export function FortuneStreamModal() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const product = sp.get("product") ?? "";
  const title = sp.get("title") ?? "풀이";
  const characterKey = sp.get("character_key") ?? "yeon";
  const orderNo = sp.get("order_no");
  const promptDebug = sp.get("prompt_debug") === "1";
  const profile = (sp.get("profile") === "pair" ? "pair" : "single") as DemoProfile;
  const charName = CHAR_NAME[characterKey] ?? "연운";

  const [phase, setPhase] = useState<"boot" | "toc_wait" | "toc_typing" | "stream" | "done" | "interrupted">(
    "boot",
  );
  const [toc, setToc] = useState<FortuneTocItem[]>([]);
  /** `chat-stream-menus`가 보낸 대메뉴·소메뉴 그룹(없으면 기존 단일 목차 리스트 UI) */
  const [tocGroups, setTocGroups] = useState<FortuneTocMainGroup[] | null>(null);
  const [sectionHtml, setSectionHtml] = useState<Record<number, string>>({});
  const [activeIdx, setActiveIdx] = useState(-1);
  const [doneIdx, setDoneIdx] = useState<Set<number>>(new Set());
  const [finalChars, setFinalChars] = useState<number | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  /** Cloudways Claude 단일 HTML SSE(`/api/fortune/chat-stream`) 분기 */
  const [claudeStreamMode, setClaudeStreamMode] = useState(false);
  const [claudeStreamHtml, setClaudeStreamHtml] = useState("");
  const claudeStreamHtmlAccRef = useRef("");
  /** start 없이 chunk만 오거나 패킷 순서가 뒤섞일 때 본문 분기 보장 */
  const claudeStreamStartedRef = useRef(false);
  /** Claude 스트림에서 첫 `chunk` 텍스트 수신 여부(TTFT·UI용, `partial_done`/`done`만 오는 경우는 false 유지) */
  const claudeFirstChunkSeenRef = useRef(false);
  const [hasClaudeStreamFirstChunk, setHasClaudeStreamFirstChunk] = useState(false);
  const claudeClientT0Ref = useRef<number | null>(null);
  const [claudeClientTtftMs, setClaudeClientTtftMs] = useState<number | null>(null);
  const [claudeServerTimings, setClaudeServerTimings] = useState<Record<string, number>>({});
  const [promptPreview, setPromptPreview] = useState<null | {
    composed?: { system?: string; user?: string; system_chars?: number; user_chars?: number; total_tokens_rough?: number };
    pieces?: { role_prompt?: string; restrictions?: string; manse_ryeok_text?: string };
  }>(null);
  const [promptPreviewError, setPromptPreviewError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sectionHtmlRef = useRef<Record<number, string>>({});
  const librarySaveStartedRef = useRef(false);
  const [librarySaved, setLibrarySaved] = useState(false);
  const [librarySaveError, setLibrarySaveError] = useState<string | null>(null);
  const [voiceContinueBusy, setVoiceContinueBusy] = useState(false);
  const [voicePayOpen, setVoicePayOpen] = useState(false);
  /** 보관함 fortune_results.id — 음성 요약 PATCH용 */
  const libraryResultIdRef = useRef<string | null>(null);
  const voiceSummaryTextRef = useRef<string | null>(null);
  const voicePrefetchPromiseRef = useRef<Promise<string | null> | null>(null);

  const streamedCharApprox = useMemo(() => {
    if (claudeStreamMode) return countApproxCharsFromHtml(claudeStreamHtml);
    return countApproxChars(sectionHtml);
  }, [claudeStreamMode, claudeStreamHtml, sectionHtml]);

  const heroDate = useMemo(() => kstDateShortDots(), []);

  const claudeStreamTocUi = useMemo(() => {
    if (!claudeStreamMode || toc.length === 0) return { active: -1, done: new Set<number>() };
    if (phase === "done") return { active: -1, done: new Set(toc.map((_, i) => i)) };
    if (phase === "toc_typing" || phase === "toc_wait") return { active: -1, done: new Set<number>() };
    const n = countSubtitleSections(claudeStreamHtml);
    if (n <= 0) return { active: -1, done: new Set<number>() };
    const active = Math.min(Math.max(0, n - 1), toc.length - 1);
    const done = new Set<number>();
    for (let i = 0; i < active; i++) done.add(i);
    return { active, done };
  }, [claudeStreamMode, toc, phase, claudeStreamHtml]);

  type PumpSseResult = { sectionsDoneEvent: boolean; claudeDoneEvent: boolean };

  const pumpSseBody = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      ac: AbortController,
      mode: FortuneStreamPumpMode,
    ): Promise<PumpSseResult> => {
      const dec = new TextDecoder();
      let buf = "";
      let sectionsDoneEvent = false;
      let claudeDoneEvent = false;

      const flushClaudeHtmlStreamBlock = (block: string) => {
        const ensureClaudeHtmlStreamStarted = () => {
          if (claudeStreamStartedRef.current) return;
          claudeStreamStartedRef.current = true;
          setClaudeStreamMode(true);
          setToc(demoTocSections(profile));
          setDoneIdx(new Set());
          setPhase("stream");
        };

        for (const raw of parseFortuneSseBlock(block)) {
          if (!raw || typeof raw !== "object") continue;
          const o = raw as Record<string, unknown>;
          const typ = o.type;
          if (typ === "debug_timing") {
            const phaseKey = typeof o.phase === "string" ? o.phase : "";
            const ms = typeof o.ms === "number" && Number.isFinite(o.ms) ? o.ms : null;
            if (phaseKey && ms != null) {
              setClaudeServerTimings((prev) => ({ ...prev, [phaseKey]: ms }));
            }
          }
          if (typ === "start") {
            if (claudeStreamStartedRef.current) continue;
            claudeStreamStartedRef.current = true;
            setClaudeStreamMode(true);
            setToc(demoTocSections(profile));
            claudeStreamHtmlAccRef.current = "";
            setClaudeStreamHtml("");
            setDoneIdx(new Set());
            setPhase("stream");
          }
          if (typ === "chunk" && typeof o.text === "string") {
            ensureClaudeHtmlStreamStarted();
            const t = o.text;
            if (!claudeFirstChunkSeenRef.current && t.length > 0) {
              claudeFirstChunkSeenRef.current = true;
              setHasClaudeStreamFirstChunk(true);
              const t0 = claudeClientT0Ref.current;
              if (t0 != null) setClaudeClientTtftMs(Math.max(0, Math.round(performance.now() - t0)));
            }
            claudeStreamHtmlAccRef.current += t;
            setClaudeStreamHtml((h) => h + t);
          }
          if (typ === "partial_done" && typeof o.html === "string") {
            ensureClaudeHtmlStreamStarted();
            const html = String(o.html);
            claudeStreamHtmlAccRef.current = html;
            setClaudeStreamHtml(html);
          }
          if (typ === "done") {
            claudeDoneEvent = true;
            ensureClaudeHtmlStreamStarted();
            const html = String(o.html ?? "");
            claudeStreamHtmlAccRef.current = html;
            setClaudeStreamHtml(html);
            const n = countApproxCharsFromHtml(html);
            setFinalChars(Math.max(n, 1));
            const len = demoTocSections(profile).length;
            setDoneIdx(new Set(Array.from({ length: len }, (_, i) => i)));
            setPhase("done");
          }
          if (typ === "error") {
            setStreamError(String(o.error ?? o.message ?? "스트림 오류"));
          }
        }
      };

      const applyEv = (ev: FortuneStreamEvt) => {
        if (ev.type === "error") {
          setStreamError(ev.message ?? "스트림 오류가 발생했습니다.");
          return;
        }
        if (ev.type === "toc") {
          setToc(ev.sections);
          setTocGroups(ev.toc_groups?.length ? ev.toc_groups : null);
          setPhase("toc_typing");
        }
        if (ev.type === "section_start") {
          setPhase("stream");
          setActiveIdx(ev.index);
        }
        if (ev.type === "chunk") {
          setSectionHtml((prev) => {
            const next = { ...prev, [ev.index]: (prev[ev.index] ?? "") + ev.html };
            sectionHtmlRef.current = next;
            return next;
          });
        }
        if (ev.type === "section_replace") {
          setSectionHtml((prev) => {
            const next = { ...prev, [ev.index]: ev.html };
            sectionHtmlRef.current = next;
            return next;
          });
        }
        if (ev.type === "section_end") {
          setDoneIdx((prev) => new Set(prev).add(ev.index));
          setActiveIdx(-1);
        }
        if (ev.type === "done") {
          sectionsDoneEvent = true;
          setFinalChars(ev.charCount);
          setPhase("done");
        }
      };

      const flushSectionsBlock = (block: string) => {
        for (const raw of parseFortuneSseBlock(block)) {
          for (const ev of normalizeFortuneSsePayload(raw)) {
            applyEv(ev);
          }
        }
      };

      const pump = async (): Promise<void> => {
        const { value, done } = await reader.read();
        if (done) {
          if (buf.trim()) {
            if (mode === "claude_html_stream") flushClaudeHtmlStreamBlock(buf);
            else flushSectionsBlock(buf);
          }
          return;
        }
        buf += dec.decode(value, { stream: true });
        /* 프록시/Nginx가 CRLF로만 이벤트를 끊으면 \n\n split이 실패해 스트림 끝까지 본문이 갱신되지 않을 수 있음 */
        buf = buf.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const block of parts) {
          if (mode === "claude_html_stream") flushClaudeHtmlStreamBlock(block);
          else flushSectionsBlock(block);
        }
        await pump();
      };
      await pump();
      return { sectionsDoneEvent, claudeDoneEvent };
    },
    [profile],
  );

  const runStream = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    librarySaveStartedRef.current = false;
    libraryResultIdRef.current = null;
    voiceSummaryTextRef.current = null;
    voicePrefetchPromiseRef.current = null;
    setPhase("toc_wait");
    setToc([]);
    setTocGroups(null);
    setSectionHtml({});
    sectionHtmlRef.current = {};
    setActiveIdx(-1);
    setDoneIdx(new Set());
    setFinalChars(null);
    setStreamError(null);
    setClaudeStreamMode(false);
    setClaudeStreamHtml("");
    claudeStreamHtmlAccRef.current = "";
    claudeStreamStartedRef.current = false;
    claudeFirstChunkSeenRef.current = false;
    setHasClaudeStreamFirstChunk(false);
    claudeClientT0Ref.current = performance.now();
    setClaudeClientTtftMs(null);
    setClaudeServerTimings({});

    try {
      const manse_ryeok_text = buildFortuneManseContext({
        profile,
        productSlug: product,
      });
      const user_info = readUserInfoFromYeonunSajuV1();
      const partner_info = profile === "pair" ? partnerInfoFromPartnerStorage(product) : null;

      const streamBody = {
        product_slug: product,
        profile,
        character_key: characterKey,
        order_no: orderNo ?? undefined,
        title,
        manse_ryeok_text,
        user_info,
        partner_info,
      };

      let res = await fetch("/api/fortune/chat-stream-menus", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(streamBody),
        signal: ac.signal,
      });

      const menuStreamOk =
        res.ok &&
        res.body &&
        (res.headers.get("content-type") ?? "").toLowerCase().includes("text/event-stream");

      if (!menuStreamOk) {
        if (res.status !== 404 && res.status !== 501) {
          const errText = await res.text().catch(() => "");
          throw new Error(errText.slice(0, 400) || "스트림 연결 실패");
        }
        res = await fetch("/api/fortune/chat-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify(streamBody),
          signal: ac.signal,
        });
      } else {
        if (!res.body) throw new Error("스트림 연결 실패");
        const pr = await pumpSseBody(res.body.getReader(), ac, "sections");
        if (!pr.sectionsDoneEvent) {
          if (!ac.signal.aborted) {
            setStreamError((prev) => prev || "풀이 전송이 중간에 끊겼습니다. 잠시 후 다시 시도해 주세요.");
          }
          setPhase("interrupted");
          return;
        }
        const approx = countApproxChars(sectionHtmlRef.current);
        setFinalChars((prev) => (prev != null ? prev : Math.max(approx, 1)));
        setPhase("done");
        return;
      }

      if (res.status === 501) {
        res = await fetch("/api/fortune/two-stage-demo", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            product_slug: product,
            profile,
            manse_context: manse_ryeok_text,
            character_key: characterKey,
            order_no: orderNo ?? undefined,
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error("스트림 연결 실패");
        const prDemo = await pumpSseBody(res.body.getReader(), ac, "sections");
        if (!prDemo.sectionsDoneEvent) {
          if (!ac.signal.aborted) {
            setStreamError((prev) => prev || "풀이 전송이 중간에 끊겼습니다. 잠시 후 다시 시도해 주세요.");
          }
          setPhase("interrupted");
          return;
        }
        const approx = countApproxChars(sectionHtmlRef.current);
        setFinalChars((prev) => (prev != null ? prev : Math.max(approx, 1)));
        setPhase("done");
        return;
      }

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText.slice(0, 400) || "스트림 연결 실패");
      }

      const prClaude = await pumpSseBody(res.body.getReader(), ac, "claude_html_stream");
      if (!prClaude.claudeDoneEvent) {
        if (!ac.signal.aborted) {
          setStreamError((prev) => prev || "풀이 전송이 중간에 끊겼습니다. 잠시 후 다시 시도해 주세요.");
        }
        setPhase("interrupted");
        return;
      }
      setFinalChars((prev) => prev ?? Math.max(countApproxCharsFromHtml(claudeStreamHtmlAccRef.current), 1));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setStreamError((e as Error).message || "연결에 실패했습니다.");
      setPhase("interrupted");
    }
  }, [product, profile, characterKey, orderNo, title, pumpSseBody]);

  useEffect(() => {
    void runStream();
    return () => abortRef.current?.abort();
  }, [runStream]);

  const scheduleVoicePrefetch = useCallback((htmlArg: string, resultId: string) => {
    const rid = String(resultId || "").trim();
    const h = String(htmlArg || "").trim();
    if (!rid || !h) return;
    if (voiceSummaryTextRef.current?.trim()) return;
    if (voicePrefetchPromiseRef.current) return;

    const run = () => {
      if (voiceSummaryTextRef.current?.trim() || voicePrefetchPromiseRef.current) return;
      const p = (async (): Promise<string | null> => {
        try {
          const res = await fetch("/api/fortune/summarize-for-voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ html: h }),
          });
          const j = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
          if (!res.ok || typeof j.summary !== "string" || !j.summary.trim()) return null;
          const text = j.summary.trim();
          voiceSummaryTextRef.current = text;
          await fetch("/api/fortune/result-voice-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result_id: rid, voice_consult_summary: text }),
          });
          return text;
        } catch {
          return null;
        }
      })();
      voicePrefetchPromiseRef.current = p;
      void p.finally(() => {
        if (voicePrefetchPromiseRef.current === p) voicePrefetchPromiseRef.current = null;
      });
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => run(), { timeout: 8_000 });
    } else {
      setTimeout(run, 0);
    }
  }, []);

  /** 완료 시 보관함 DB 자동 저장(버튼 없음) */
  useEffect(() => {
    if (phase !== "done") return;
    if (librarySaveStartedRef.current) return;
    librarySaveStartedRef.current = true;

    const html = claudeStreamMode
      ? (claudeStreamHtmlAccRef.current || "").trim() || claudeStreamHtml
      : toc.length > 0
        ? joinSectionHtmlForLibrarySave(sectionHtmlRef.current, toc)
        : Object.keys(sectionHtmlRef.current)
            .map(Number)
            .sort((a, b) => a - b)
            .map((i) => sectionHtmlRef.current[i] ?? "")
            .join("\n");

    if (!html.trim()) {
      setLibrarySaveError("저장할 본문이 없습니다.");
      return;
    }

    void fetch("/api/fortune/save-modal-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_slug: product,
        order_no: orderNo ?? undefined,
        character_key: characterKey,
        profile,
        title,
        html,
        ...(toc.length > 0 ? { toc_sections: toc } : {}),
        ...(tocGroups && tocGroups.length > 0 ? { toc_groups: tocGroups } : {}),
      }),
    })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as {
          saved?: boolean;
          error?: string;
          result_id?: string;
        };
        if (!res.ok || !j.saved) throw new Error(j.error || "저장에 실패했습니다.");
        const resultId = typeof j.result_id === "string" ? j.result_id.trim() : "";
        if (resultId) libraryResultIdRef.current = resultId;
        setLibrarySaved(true);
        setLibrarySaveError(null);
        if (resultId) scheduleVoicePrefetch(html, resultId);
      })
      .catch((e) => {
        setLibrarySaveError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      });
  }, [
    phase,
    product,
    orderNo,
    characterKey,
    profile,
    title,
    claudeStreamMode,
    claudeStreamHtml,
    toc,
    tocGroups,
    scheduleVoicePrefetch,
  ]);

  useEffect(() => {
    if (!promptDebug) return;
    let cancelled = false;
    const run = async () => {
      try {
        setPromptPreviewError(null);
        const manse_ryeok_text = buildFortuneManseContext({ profile, productSlug: product });
        const user_info = readUserInfoFromYeonunSajuV1();
        const partner_info = profile === "pair" ? partnerInfoFromPartnerStorage(product) : null;
        const res = await fetch("/api/fortune/prompt-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_slug: product,
            profile,
            character_key: characterKey,
            title,
            manse_ryeok_text,
            user_info,
            partner_info,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          const msg = typeof j.error === "string" ? j.error : "프롬프트 미리보기 실패";
          throw new Error(msg);
        }
        if (cancelled) return;
        setPromptPreview(j as unknown as typeof promptPreview);
      } catch (e) {
        if (cancelled) return;
        setPromptPreviewError(e instanceof Error ? e.message : "프롬프트 미리보기 실패");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [promptDebug, profile, product, characterKey, title]);

  const copyText = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  }, []);

  const scrollToSection = useCallback(
    (index: number) => {
      if (claudeStreamMode) {
        const nodes = document.querySelectorAll(".y-fs-html--claude-stream .subtitle-section");
        nodes[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      document.getElementById(`y-fs-section-${index}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [claudeStreamMode],
  );

  const onTocDoneKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLLIElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        scrollToSection(index);
      }
    },
    [scrollToSection],
  );

  const scrollToTocTop = useCallback(() => {
    document.getElementById("y-fs-toc-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const readVoiceBalanceSec = useCallback((): number => {
    try {
      const v = localStorage.getItem(LS_VOICE_BALANCE_SEC);
      if (v === null) return 180;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? Math.max(0, n) : 180;
    } catch {
      return 180;
    }
  }, []);

  const persistVoiceBriefAndGoCall = useCallback(
    async (summary: string) => {
      const slug = String(product ?? "").trim();
      try {
        sessionStorage.setItem(
          "yeonun_fortune_voice_brief",
          JSON.stringify({
            summary,
            title,
            product_slug: product,
            profile,
            character_key: characterKey,
            ts: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
      if (slug) {
        setVoiceManseMeta({ profile, productSlug: slug });
      }
      router.push(
        `/call-dcc?character_key=${encodeURIComponent(characterKey)}&from_fortune=1`,
      );
    },
    [router, title, product, profile, characterKey],
  );

  const onVoiceContinue = useCallback(async () => {
    if (voiceContinueBusy) return;
    if (readVoiceBalanceSec() <= 0) {
      setVoicePayOpen(true);
      return;
    }
    const html = claudeStreamMode
      ? (claudeStreamHtmlAccRef.current || "").trim() || claudeStreamHtml
      : Object.keys(sectionHtmlRef.current)
          .map(Number)
          .sort((a, b) => a - b)
          .map((i) => sectionHtmlRef.current[i] ?? "")
          .join("\n");
    if (!html.trim()) {
      setStreamError((prev) => prev || "음성 상담용 본문이 없습니다.");
      return;
    }

    const cached = voiceSummaryTextRef.current?.trim();
    if (cached) {
      try {
        await persistVoiceBriefAndGoCall(cached);
      } catch (e) {
        setStreamError(e instanceof Error ? e.message : "음성 상담 준비에 실패했습니다.");
      }
      return;
    }

    const pending = voicePrefetchPromiseRef.current;
    if (pending) {
      setVoiceContinueBusy(true);
      try {
        const s = await pending;
        if (s?.trim()) {
          await persistVoiceBriefAndGoCall(s.trim());
          return;
        }
      } catch (e) {
        setStreamError(e instanceof Error ? e.message : "음성 상담 준비에 실패했습니다.");
        return;
      } finally {
        setVoiceContinueBusy(false);
      }
    }

    setVoiceContinueBusy(true);
    try {
      const res = await fetch("/api/fortune/summarize-for-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const j = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
      if (!res.ok || typeof j.summary !== "string" || !j.summary.trim()) {
        throw new Error(j.error || "요약에 실패했습니다.");
      }
      const text = j.summary.trim();
      voiceSummaryTextRef.current = text;
      const rid = libraryResultIdRef.current?.trim();
      if (rid) {
        void fetch("/api/fortune/result-voice-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result_id: rid, voice_consult_summary: text }),
        });
      }
      await persistVoiceBriefAndGoCall(text);
    } catch (e) {
      setStreamError(e instanceof Error ? e.message : "음성 상담 준비에 실패했습니다.");
    } finally {
      setVoiceContinueBusy(false);
    }
  }, [
    voiceContinueBusy,
    readVoiceBalanceSec,
    claudeStreamMode,
    claudeStreamHtml,
    persistVoiceBriefAndGoCall,
  ]);

  const charMetaText =
    finalChars != null
      ? `${finalChars.toLocaleString("ko-KR")}자`
      : phase === "interrupted" && streamedCharApprox > 0
        ? `${streamedCharApprox.toLocaleString("ko-KR")}자까지 수신 · 중단`
        : phase === "interrupted"
          ? "전송 중단"
          : streamedCharApprox > 0
            ? `${streamedCharApprox.toLocaleString("ko-KR")}자 생성 중…`
            : claudeStreamMode && phase === "stream" && !hasClaudeStreamFirstChunk
              ? "첫 응답 수신 중…"
              : phase === "toc_wait" || phase === "toc_typing"
                ? "본문 준비 중…"
                : "생성 중…";

  const bodyVisible = claudeStreamMode
    ? phase !== "boot" && phase !== "toc_wait"
    : toc.length > 0 && phase !== "boot" && phase !== "toc_wait";

  /** 해당 인덱스 구간에 점사 본문이 보이기 시작했을 때(스트리밍 중 또는 글 있음) */
  const fortuneVisibleForSection = (idx: number) => {
    const h = sectionHtml[idx] ?? "";
    return h.trim().length > 0 || activeIdx === idx;
  };

  return (
    <div className="y-fs-fullpage y-fs-modal" role="dialog" aria-modal="true" aria-label="풀이 결과">
      <div className="y-fs-fullpage-inner">
        <div className="y-modal-scroll y-fs-scroll y-fs-fullpage-scroll">
          <div className="y-fs-scroll-stack">
            <header className="y-fs-hero">
              <p className="y-fs-hero-kicker">{charName}의 풀이</p>
              <h1 className="y-fs-hero-title">{title}</h1>
              <p className="y-fs-hero-meta">
                {charName} · {heroDate} · {charMetaText}
              </p>
              {streamError ? (
                <p className="y-fs-stream-error" role="alert">
                  {streamError}
                </p>
              ) : null}
              {librarySaveError ? (
                <p className="y-fs-stream-error" role="alert">
                  보관함 자동 저장: {librarySaveError}
                </p>
              ) : null}
              {librarySaved ? (
                <p className="y-fs-hero-saved" aria-live="polite">
                  보관함에 저장했습니다.
                </p>
              ) : null}
            </header>

            <section className="y-fs-toc-panel" id="y-fs-toc-anchor" aria-label="목차 영역">
              <div className="y-fs-toc-wrap">
                <div className="y-fs-toc-card">
                  {phase === "toc_wait" ? (
                    <div className="y-fs-toc-loading" aria-live="polite">
                      <span className="y-fs-dot-pulse" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="y-fs-toc-loading-tx">● 풀이를 불러오는 중이에요</span>
                    </div>
                  ) : null}

                  {toc.length > 0 ? (
                    <>
                      <div className="y-fs-toc-card-head">
                        <span className="y-fs-toc-card-head-tx">● 목차</span>
                      </div>
                      {tocGroups && tocGroups.length > 0 ? (
                        <div className="y-fs-toc-grouped" aria-label="목차">
                          {tocGroups.map((g) => (
                            <div key={g.main_id} className="y-fs-toc-group-block">
                              <div className="y-fs-toc-main-line">{g.main_title}</div>
                              <ol className="y-fs-toc y-fs-toc--sub">
                                {g.subs.map((sub) => {
                                  const i = sub.sectionIndex;
                                  const done = claudeStreamMode ? claudeStreamTocUi.done.has(i) : doneIdx.has(i);
                                  const active = claudeStreamMode ? claudeStreamTocUi.active === i : activeIdx === i;
                                  let cls = "y-fs-toc-item y-fs-toc-item--sub";
                                  if (done) cls += " y-fs-toc-item--done";
                                  else if (active) cls += " y-fs-toc-item--active";
                                  else cls += " y-fs-toc-item--pending";
                                  if (done) cls += " y-fs-toc-item--clickable";
                                  return (
                                    <li
                                      key={sub.id}
                                      className={cls}
                                      {...(done
                                        ? {
                                            role: "button" as const,
                                            tabIndex: 0,
                                            "aria-label": `${sub.title} 섹션으로 이동`,
                                            onClick: () => scrollToSection(i),
                                            onKeyDown: (e) => onTocDoneKeyDown(i, e),
                                          }
                                        : {})}
                                    >
                                      <span className="y-fs-toc-tx">{sub.title}</span>
                                      {done ? (
                                        <span className="y-fs-toc-check" aria-hidden="true">
                                          ✓
                                        </span>
                                      ) : null}
                                      {active ? (
                                        <span className="y-fs-toc-chev" aria-hidden="true">
                                          →
                                        </span>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ol className="y-fs-toc" aria-label="목차">
                          {toc.map((item, i) => {
                            const done = claudeStreamMode ? claudeStreamTocUi.done.has(i) : doneIdx.has(i);
                            const active = claudeStreamMode ? claudeStreamTocUi.active === i : activeIdx === i;
                            let cls = "y-fs-toc-item";
                            if (done) cls += " y-fs-toc-item--done";
                            else if (active) cls += " y-fs-toc-item--active";
                            else cls += " y-fs-toc-item--pending";
                            if (done) cls += " y-fs-toc-item--clickable";
                            return (
                              <li
                                key={item.id}
                                className={cls}
                                {...(done
                                  ? {
                                      role: "button" as const,
                                      tabIndex: 0,
                                      "aria-label": `${item.title} 섹션으로 이동`,
                                      onClick: () => scrollToSection(i),
                                      onKeyDown: (e) => onTocDoneKeyDown(i, e),
                                    }
                                  : {})}
                              >
                                <span className="y-fs-toc-num">{i + 1}</span>
                                <span className="y-fs-toc-tx">{item.title}</span>
                                {done ? (
                                  <span className="y-fs-toc-check" aria-hidden="true">
                                    ✓
                                  </span>
                                ) : null}
                                {active ? (
                                  <span className="y-fs-toc-chev" aria-hidden="true">
                                    →
                                  </span>
                                ) : null}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="y-fs-main-panel">
              {promptDebug ? (
                <div style={{ padding: "10px 22px 0" }}>
                  <details style={{ border: "1px solid rgba(51,51,51,0.12)", borderRadius: 12, padding: 12, background: "#fff" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 700 }}>프롬프트 보기 (디버그)</summary>
                    <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: "#444" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f2f4f7" }}>
                          클라 TTFT: {claudeClientTtftMs != null ? `${claudeClientTtftMs.toLocaleString("ko-KR")}ms` : "—"}
                        </span>
                        <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f2f4f7" }}>
                          서버 headers:{" "}
                          {claudeServerTimings.upstream_headers != null
                            ? `${Math.round(claudeServerTimings.upstream_headers).toLocaleString("ko-KR")}ms`
                            : "—"}
                        </span>
                        <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f2f4f7" }}>
                          서버 first_data:{" "}
                          {claudeServerTimings.first_upstream_data_line != null
                            ? `${Math.round(claudeServerTimings.first_upstream_data_line).toLocaleString("ko-KR")}ms`
                            : "—"}
                        </span>
                        <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f2f4f7" }}>
                          서버 first_chunk:{" "}
                          {claudeServerTimings.first_proxy_chunk != null
                            ? `${Math.round(claudeServerTimings.first_proxy_chunk).toLocaleString("ko-KR")}ms`
                            : "—"}
                        </span>
                      </div>
                      {promptPreviewError ? (
                        <p style={{ color: "#b42318", margin: 0 }}>불러오기 실패: {promptPreviewError}</p>
                      ) : null}
                      {promptPreview?.composed ? (
                        <p style={{ margin: "0 0 10px" }}>
                          system {Number(promptPreview.composed.system_chars ?? 0).toLocaleString("ko-KR")}자 · user{" "}
                          {Number(promptPreview.composed.user_chars ?? 0).toLocaleString("ko-KR")}자 · 총 토큰(러프){" "}
                          {Number(promptPreview.composed.total_tokens_rough ?? 0).toLocaleString("ko-KR")}
                        </p>
                      ) : (
                        <p style={{ margin: 0 }}>불러오는 중… (서버에서 `ALLOW_FORTUNE_PROMPT_PREVIEW=1` 필요)</p>
                      )}

                      {promptPreview?.composed?.system ? (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <strong>system</strong>
                            <button type="button" onClick={() => copyText(promptPreview.composed?.system ?? "")} style={{ fontSize: 12 }}>
                              복사
                            </button>
                          </div>
                          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 6, padding: 10, borderRadius: 10, background: "#faf8f5" }}>
                            {promptPreview.composed.system}
                          </pre>
                        </div>
                      ) : null}

                      {promptPreview?.composed?.user ? (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <strong>user</strong>
                            <button type="button" onClick={() => copyText(promptPreview.composed?.user ?? "")} style={{ fontSize: 12 }}>
                              복사
                            </button>
                          </div>
                          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 6, padding: 10, borderRadius: 10, background: "#faf8f5" }}>
                            {promptPreview.composed.user}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              ) : null}
              {claudeStreamMode ? (
                <div className={`y-fs-body ${bodyVisible ? "y-fs-body--visible" : ""}`}>
                  <article id="y-fs-section-0" className="y-fs-section y-fs-section--active">
                    <div
                      className={`y-fs-section-inner${phase === "stream" && claudeStreamHtml ? " y-fs-section-inner--streaming" : ""}`}
                    >
                      {claudeStreamHtml ? (
                        <>
                          <div
                            className="y-fs-html y-fs-html--claude-stream"
                            id="y-fs-h-0"
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{ __html: claudeStreamHtml }}
                          />
                          {phase === "stream" ? <span className="y-fs-caret" aria-hidden="true" /> : null}
                        </>
                      ) : bodyVisible ? (
                        <div className="y-fs-skel" aria-hidden="true">
                          <div className="y-fs-skel-bar y-fs-skel-bar--a" />
                          <div className="y-fs-skel-bar y-fs-skel-bar--b" />
                          <div className="y-fs-skel-bar y-fs-skel-bar--c" />
                        </div>
                      ) : (
                        <div className="y-fs-skel y-fs-skel--empty" />
                      )}
                    </div>
                  </article>
                </div>
              ) : (
                <div className={`y-fs-body ${bodyVisible ? "y-fs-body--visible" : ""}`}>
                  {toc.map((item, i) => {
                    const html = sectionHtml[i] ?? "";
                    const htmlTrim = html.trim();
                    const done = doneIdx.has(i);
                    const active = activeIdx === i;
                    const showSkel =
                      (phase === "stream" || phase === "done" || phase === "interrupted") &&
                      !done &&
                      !active &&
                      !htmlTrim;
                    let boxCls = "y-fs-section";
                    if (done) boxCls += " y-fs-section--done";
                    else if (active) boxCls += " y-fs-section--active";
                    else if (showSkel) boxCls += " y-fs-section--pending";
                    const mainLabel = item.main_title?.trim() ?? "";
                    const prevMain = i > 0 ? (toc[i - 1]?.main_title?.trim() ?? "") : "";
                    /** 같은 대메뉴의 첫 소메뉴 섹션에서만 대제목 표시 */
                    const showMainKicker = Boolean(mainLabel) && (i === 0 || prevMain !== mainLabel);
                    const fv = fortuneVisibleForSection(i);
                    const showMainThumb =
                      fv &&
                      showMainKicker &&
                      Boolean((item.main_image_url ?? "").trim() || (item.main_video_thumb_url ?? "").trim());
                    const showSubThumb =
                      fv && Boolean((item.image_url ?? "").trim() || (item.video_thumb_url ?? "").trim());
                    const split = htmlTrim ? splitHtmlAfterFirstSubtitleH3Close(html) : null;
                    return (
                      <article key={item.id} id={`y-fs-section-${i}`} className={boxCls} aria-labelledby={`y-fs-h-${i}`}>
                        <div className={`y-fs-section-inner${active ? " y-fs-section-inner--streaming" : ""}`}>
                          {htmlTrim ? (
                            <>
                              {showMainKicker ? <p className="y-fs-section-main-kicker">{mainLabel}</p> : null}
                              {showMainThumb ? (
                                <div className="y-fs-body-thumb-wrap">
                                  <FortuneStreamSectionMedia
                                    imageUrl={item.main_image_url}
                                    videoThumbUrl={item.main_video_thumb_url}
                                  />
                                </div>
                              ) : null}
                              {split ? (
                                <>
                                  <div
                                    className="y-fs-html"
                                    id={`y-fs-h-${i}`}
                                    // eslint-disable-next-line react/no-danger
                                    dangerouslySetInnerHTML={{ __html: split.head }}
                                  />
                                  {showSubThumb ? (
                                    <div className="y-fs-body-thumb-wrap">
                                      <FortuneStreamSectionMedia
                                        imageUrl={item.image_url}
                                        videoThumbUrl={item.video_thumb_url}
                                      />
                                    </div>
                                  ) : null}
                                  {split.tail ? (
                                    <div
                                      className="y-fs-html"
                                      // eslint-disable-next-line react/no-danger
                                      dangerouslySetInnerHTML={{ __html: split.tail }}
                                    />
                                  ) : null}
                                </>
                              ) : (
                                <div
                                  className="y-fs-html"
                                  id={`y-fs-h-${i}`}
                                  // eslint-disable-next-line react/no-danger
                                  dangerouslySetInnerHTML={{ __html: html }}
                                />
                              )}
                              {active ? <span className="y-fs-caret" aria-hidden="true" /> : null}
                            </>
                          ) : active ? (
                            <div id={`y-fs-h-${i}`}>
                              {showMainKicker ? <p className="y-fs-section-main-kicker">{mainLabel}</p> : null}
                              {showMainThumb ? (
                                <div className="y-fs-body-thumb-wrap">
                                  <FortuneStreamSectionMedia
                                    imageUrl={item.main_image_url}
                                    videoThumbUrl={item.main_video_thumb_url}
                                  />
                                </div>
                              ) : null}
                              <div className="y-fs-skel" aria-hidden="true">
                                <div className="y-fs-skel-bar y-fs-skel-bar--a" />
                                <div className="y-fs-skel-bar y-fs-skel-bar--b" />
                                <div className="y-fs-skel-bar y-fs-skel-bar--c" />
                              </div>
                              <span className="y-fs-caret" aria-hidden="true" />
                            </div>
                          ) : showSkel ? (
                            <>
                              {showMainKicker ? (
                                <p className="y-fs-section-main-kicker y-fs-section-main-kicker--muted">{mainLabel}</p>
                              ) : null}
                              <h2 className="y-fs-skel-h2" id={`y-fs-h-${i}`}>
                                {item.title}
                              </h2>
                              <div className="y-fs-skel" aria-hidden="true">
                                <div className="y-fs-skel-bar y-fs-skel-bar--a" />
                                <div className="y-fs-skel-bar y-fs-skel-bar--b" />
                                <div className="y-fs-skel-bar y-fs-skel-bar--c" />
                              </div>
                            </>
                          ) : (
                            <div className="y-fs-skel y-fs-skel--empty" />
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

        {toc.length > 0 && phase !== "boot" ? (
          <button
            type="button"
            className={`y-fs-toc-fab${phase === "done" ? " y-fs-toc-fab--with-actions" : ""}`}
            onClick={scrollToTocTop}
            aria-label="목차로 이동"
          >
            목차로 이동
          </button>
        ) : null}

        {phase === "done" ? (
          <FortuneVoiceConsultDock
            hasTocFabClear={toc.length > 0}
            busy={voiceContinueBusy}
            busyLabel="점사 요약 중…"
            ctaLabel={`${charName}와 이 풀이로 음성 상담 이어가기 →`}
            onContinue={() => void onVoiceContinue()}
          />
        ) : null}

        {voicePayOpen ? (
          <div
            className="y-fs-voice-pay-backdrop"
            role="presentation"
            onMouseDown={() => setVoicePayOpen(false)}
          >
            <div
              className="y-fs-voice-pay-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="음성 상담 크레딧"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="y-fs-voice-pay-title">무료 음성 크레딧이 없습니다</p>
              <p className="y-fs-voice-pay-desc">
                음성 상담을 이어가려면 크레딧을 충전해 주세요.
              </p>
              <div className="y-fs-voice-pay-actions">
                <a className="y-fs-voice-pay-primary" href="/checkout/credit">
                  크레딧 충전하기
                </a>
                <button type="button" className="y-fs-voice-pay-secondary" onClick={() => setVoicePayOpen(false)}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
