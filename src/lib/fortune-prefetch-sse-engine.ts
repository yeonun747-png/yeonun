import { applyFortuneForeignGlossary } from "@/lib/fortune-html-script-sanitize";
import {
  fixFortuneFullHtmlIfNeeded,
  scheduleFortuneSectionForeignFix,
} from "@/lib/fortune-section-foreign-fix";
import type { FortunePrefetchV1 } from "@/lib/fortune-prefetch-storage";
import { readFortunePrefetchContextKey } from "@/lib/fortune-prefetch-storage";
import {
  inspectFortuneSseRaw,
  logFortuneStreamEvent,
} from "@/lib/fortune-hybrid-stream-debug";
import {
  normalizeFortuneSsePayload,
  parseFortuneSseBlock,
  type FortuneStreamEvt,
  type FortuneTocItem,
} from "@/lib/fortune-stream-client";
import type { FortuneTocMainGroup } from "@/lib/product-fortune-menu";
import { demoTocSections, type DemoProfile } from "@/lib/fortune-two-stage-demo";

type PumpMode = "claude_html_stream" | "sections";

export type FortunePrefetchPumpOptions = {
  profile: DemoProfile;
  initial?: FortunePrefetchV1 | null;
  onSnapshot: (payload: FortunePrefetchV1) => void;
  /** 미지정 시 섹션 외국어 보정 스케줄 생략(서버 Tank) */
  scheduleSectionFix?: boolean;
  /** 서버 Tank — 브라우저 localStorage 대신 요청 본문에서 전달 */
  contextKey?: string | null;
};

export type FortunePrefetchPump = {
  isAlreadyComplete: boolean;
  snapshot: () => FortunePrefetchV1;
  pumpSseBody: (reader: ReadableStreamDefaultReader<Uint8Array>, mode: PumpMode) => Promise<void>;
  finalizeMenuSectionsStream: (signalAborted: boolean) => void;
  finalizeClaudeHtmlStream: (signalAborted: boolean) => void;
  readonly tocLength: number;
  readonly sectionsDoneEvent: boolean;
  readonly claudeDoneEvent: boolean;
  readonly pumpSawError: boolean;
  readonly claudeStreamStarted: boolean;
  readonly claudeStreamHtml: string;
};

export function createFortunePrefetchPump(opts: FortunePrefetchPumpOptions): FortunePrefetchPump {
  const { profile, initial, onSnapshot, scheduleSectionFix = true, contextKey: contextKeyOverride } = opts;

  let toc: FortuneTocItem[] = initial ? [...initial.toc] : [];
  let toc_groups: FortuneTocMainGroup[] | null = initial?.toc_groups ?? null;
  let sectionHtml: Record<number, string> = initial ? { ...initial.sectionHtml } : {};
  let doneIdx = new Set<number>(initial?.doneIdx ?? []);
  let claudeStreamMode = initial?.claudeStreamMode ?? false;
  let claudeStreamHtml = initial?.claudeStreamHtml ?? "";
  let claudeStreamStarted =
    initial != null &&
    (initial.claudeStreamHtml.trim().length > 0 ||
      Object.keys(initial.sectionHtml).some(
        (k) => String(initial.sectionHtml[Number(k)] ?? "").trim().length > 0,
      ));
  let sectionsDoneEvent = Boolean(initial?.complete && initial.sectionsMode);
  let claudeDoneEvent = Boolean(initial?.complete && initial.claudeStreamMode);
  let pumpSawError = false;

  const isAlreadyComplete = Boolean(initial?.complete);

  const resolveContextKey = (): string | null => {
    if (contextKeyOverride !== undefined) return contextKeyOverride;
    if (typeof window === "undefined") return null;
    return readFortunePrefetchContextKey();
  };

  const flush = (complete: boolean) => {
    const ctx = resolveContextKey();
    const payload: FortunePrefetchV1 = {
      v: 1,
      ...(ctx ? { context_key: ctx } : {}),
      sectionsMode: !claudeStreamMode,
      complete,
      toc,
      toc_groups,
      sectionHtml: { ...sectionHtml },
      doneIdx: [...doneIdx],
      claudeStreamMode,
      claudeStreamHtml,
      updatedAt: Date.now(),
    };
    onSnapshot(payload);
  };

  if (isAlreadyComplete) {
    flush(true);
  }

  const runSectionFix = (index: number) => {
    if (!scheduleSectionFix) return;
    scheduleFortuneSectionForeignFix(
      index,
      () => sectionHtml[index] ?? "",
      (i, html) => {
        sectionHtml = { ...sectionHtml, [i]: html };
        flush(false);
      },
    );
  };

  const applyEv = (ev: FortuneStreamEvt) => {
    if (ev.type === "error") {
      pumpSawError = true;
      return;
    }
    if (ev.type === "toc") {
      toc = ev.sections;
      toc_groups = ev.toc_groups?.length ? ev.toc_groups : null;
      flush(false);
    }
    if (ev.type === "chunk") {
      sectionHtml = { ...sectionHtml, [ev.index]: (sectionHtml[ev.index] ?? "") + ev.html };
      flush(false);
    }
    if (ev.type === "section_replace") {
      sectionHtml = { ...sectionHtml, [ev.index]: ev.html };
      flush(false);
      runSectionFix(ev.index);
    }
    if (ev.type === "section_end") {
      doneIdx = new Set(doneIdx).add(ev.index);
      flush(false);
      runSectionFix(ev.index);
    }
    if (ev.type === "done") {
      sectionsDoneEvent = true;
      for (const k of Object.keys(sectionHtml)) {
        runSectionFix(Number(k));
      }
      flush(true);
    }
  };

  const flushSectionsBlock = (block: string) => {
    for (const raw of parseFortuneSseBlock(block)) {
      inspectFortuneSseRaw(raw);
      for (const ev of normalizeFortuneSsePayload(raw)) {
        logFortuneStreamEvent(ev);
        applyEv(ev);
      }
    }
  };

  const flushClaudeHtmlStreamBlock = (block: string) => {
    for (const raw of parseFortuneSseBlock(block)) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      const typ = o.type;
      if (typ === "start") {
        if (!claudeStreamStarted) {
          claudeStreamStarted = true;
          claudeStreamMode = true;
          toc = demoTocSections(profile);
          toc_groups = null;
          flush(false);
        }
      }
      if (typ === "chunk" && typeof o.text === "string") {
        if (!claudeStreamStarted) {
          claudeStreamStarted = true;
          claudeStreamMode = true;
          toc = demoTocSections(profile);
        }
        claudeStreamHtml += applyFortuneForeignGlossary(String(o.text));
        flush(false);
      }
      if (typ === "partial_done" && typeof o.html === "string") {
        claudeStreamHtml = applyFortuneForeignGlossary(String(o.html));
        flush(false);
      }
      if (typ === "done") {
        claudeDoneEvent = true;
        claudeStreamHtml = applyFortuneForeignGlossary(String(o.html ?? ""));
        if (scheduleSectionFix) {
          void fixFortuneFullHtmlIfNeeded(claudeStreamHtml).then((fixed) => {
            if (fixed !== claudeStreamHtml) {
              claudeStreamHtml = fixed;
              flush(true);
            }
          });
        }
        flush(true);
      }
      if (typ === "error") {
        pumpSawError = true;
      }
    }
  };

  async function pumpSseBody(reader: ReadableStreamDefaultReader<Uint8Array>, mode: PumpMode): Promise<void> {
    pumpSawError = false;
    const dec = new TextDecoder();
    let buf = "";
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
  }

  const finalizeMenuSectionsStream = (signalAborted: boolean) => {
    if (sectionsDoneEvent || signalAborted || pumpSawError || toc.length === 0) {
      if (!sectionsDoneEvent && !signalAborted) flush(false);
      return;
    }
    const n = toc.length;
    let allSectionEnds = true;
    for (let i = 0; i < n; i++) {
      if (!doneIdx.has(i)) {
        allSectionEnds = false;
        break;
      }
    }
    let allFilled = true;
    for (let i = 0; i < n; i++) {
      if (!String(sectionHtml[i] ?? "").trim()) {
        allFilled = false;
        break;
      }
    }
    /** EOF: `section_end` 전부 또는 업스트림이 `done` 없이 끊긴 경우(본문만 꽉 찬 경우) */
    if (allSectionEnds || allFilled) {
      sectionsDoneEvent = true;
      doneIdx = new Set(Array.from({ length: n }, (_, i) => i));
      flush(true);
    } else {
      flush(false);
    }
  };

  const finalizeClaudeHtmlStream = (signalAborted: boolean) => {
    if (claudeDoneEvent || signalAborted || pumpSawError) {
      if (!claudeDoneEvent && !signalAborted) flush(false);
      return;
    }
    const html = claudeStreamHtml.trim();
    if (html.length >= 80 && claudeStreamStarted) {
      claudeDoneEvent = true;
      claudeStreamHtml = html;
      flush(true);
    } else {
      flush(false);
    }
  };

  return {
    get isAlreadyComplete() {
      return isAlreadyComplete;
    },
    snapshot: () => ({
      v: 1 as const,
      sectionsMode: !claudeStreamMode,
      complete: sectionsDoneEvent || claudeDoneEvent,
      toc,
      toc_groups,
      sectionHtml: { ...sectionHtml },
      doneIdx: [...doneIdx],
      claudeStreamMode,
      claudeStreamHtml,
      updatedAt: Date.now(),
    }),
    pumpSseBody,
    finalizeMenuSectionsStream,
    finalizeClaudeHtmlStream,
    get tocLength() {
      return toc.length;
    },
    get sectionsDoneEvent() {
      return sectionsDoneEvent;
    },
    get claudeDoneEvent() {
      return claudeDoneEvent;
    },
    get pumpSawError() {
      return pumpSawError;
    },
    get claudeStreamStarted() {
      return claudeStreamStarted;
    },
    get claudeStreamHtml() {
      return claudeStreamHtml;
    },
  };
}
