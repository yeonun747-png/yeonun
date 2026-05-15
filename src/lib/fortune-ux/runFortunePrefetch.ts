"use client";

import { partnerInfoFromPartnerStorage, readUserInfoFromYeonunSajuV1 } from "@/lib/fortune-claude-stream-user";
import { buildFortuneManseContext } from "@/lib/fortune-manse-context";
import type { FortunePrefetchV1 } from "@/lib/fortune-prefetch-storage";
import { writeFortunePrefetch } from "@/lib/fortune-prefetch-storage";
import {
  normalizeFortuneSsePayload,
  parseFortuneSseBlock,
  type FortuneStreamEvt,
  type FortuneTocItem,
} from "@/lib/fortune-stream-client";
import type { FortuneTocMainGroup } from "@/lib/product-fortune-menu";
import { demoTocSections, type DemoProfile } from "@/lib/fortune-two-stage-demo";
import { formatFortuneExtraForPrompt } from "@/lib/format-fortune-extra-for-prompt";
import { readFortuneExtraAnswers } from "@/lib/fortune-extra-input-storage";
import { getFortuneProductExtraConfig } from "@/lib/fortune-product-extra-config";
import { fetchFortuneMenuStream } from "@/lib/fortune-ux/fetchFortuneMenuStream";

type PumpMode = "claude_html_stream" | "sections";

export type RunFortunePrefetchArgs = {
  productSlug: string;
  title: string;
  characterKey: string;
  profile: DemoProfile;
  orderNo?: string | null;
  signal: AbortSignal;
  /** 스토리지 기록 직후 동일 스냅샷을 UI에 전달 */
  onPatch?: (payload: FortunePrefetchV1) => void;
};

/** 생년 제출 직후 백그라운드 Claude 스트림 — STEP6 미리보기/결제 후 캐시용(품질·출력 상한은 일반 스트림과 동일) */
export async function runFortunePrefetch(args: RunFortunePrefetchArgs): Promise<void> {
  const { productSlug, title, characterKey, profile, orderNo, signal, onPatch } = args;

  const manse_ryeok_text = buildFortuneManseContext({ profile, productSlug });
  const user_info = readUserInfoFromYeonunSajuV1();
  const partner_info = profile === "pair" ? partnerInfoFromPartnerStorage(productSlug) : null;

  const extraCfg = getFortuneProductExtraConfig(productSlug);
  const fortune_extra_context = (() => {
    if (!extraCfg) return "";
    const s = formatFortuneExtraForPrompt(extraCfg, readFortuneExtraAnswers(productSlug)).trim();
    return s;
  })();

  const streamBody = {
    product_slug: productSlug,
    profile,
    character_key: characterKey,
    order_no: orderNo ?? undefined,
    title,
    manse_ryeok_text,
    user_info,
    partner_info,
    ...(fortune_extra_context ? { fortune_extra_context } : {}),
  };

  const streamHeaders = { "Content-Type": "application/json", Accept: "text/event-stream" as const };

  let toc: FortuneTocItem[] = [];
  let toc_groups: FortuneTocMainGroup[] | null = null;
  let sectionHtml: Record<number, string> = {};
  let doneIdx = new Set<number>();
  let claudeStreamMode = false;
  let claudeStreamHtml = "";
  let claudeStreamStarted = false;
  let sectionsDoneEvent = false;
  let claudeDoneEvent = false;
  /** pump 한 번 시작할 때마다 false로 초기화 — EOF 보정은 오류 스트림에 적용하지 않음 */
  let pumpSawError = false;

  const flush = (complete: boolean) => {
    const payload: FortunePrefetchV1 = {
      v: 1,
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
    writeFortunePrefetch(productSlug, payload);
    onPatch?.(payload);
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
    }
    if (ev.type === "section_end") {
      doneIdx = new Set(doneIdx).add(ev.index);
      flush(false);
    }
    if (ev.type === "done") {
      sectionsDoneEvent = true;
      flush(true);
    }
  };

  const flushSectionsBlock = (block: string) => {
    for (const raw of parseFortuneSseBlock(block)) {
      for (const ev of normalizeFortuneSsePayload(raw)) {
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
        claudeStreamHtml += String(o.text);
        flush(false);
      }
      if (typ === "partial_done" && typeof o.html === "string") {
        claudeStreamHtml = String(o.html);
        flush(false);
      }
      if (typ === "done") {
        claudeDoneEvent = true;
        claudeStreamHtml = String(o.html ?? "");
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

  let res = await fetchFortuneMenuStream(streamBody, signal);

  const menuStreamOk =
    res.ok && res.body && (res.headers.get("content-type") ?? "").toLowerCase().includes("text/event-stream");

  if (menuStreamOk && res.body) {
    await pumpSseBody(res.body.getReader(), "sections");
    /**
     * 업스트림이 마지막 `done` 없이 연결만 닫는 경우가 있어, TOC 길이만큼 본문이 모두 채워졌으면 완료로 기록한다.
     * (빈 섹션이 하나라도 있으면 여전히 미완료)
     */
    if (!sectionsDoneEvent && !signal.aborted && !pumpSawError && toc.length > 0) {
      const n = toc.length;
      const allSectionEnds = doneIdx.size >= n;
      let allFilled = true;
      for (let i = 0; i < n; i++) {
        if (!String(sectionHtml[i] ?? "").trim()) {
          allFilled = false;
          break;
        }
      }
      if (allSectionEnds || allFilled) {
        sectionsDoneEvent = true;
        doneIdx = new Set(Array.from({ length: n }, (_, i) => i));
        flush(true);
      }
    }
    if (!sectionsDoneEvent && !signal.aborted) flush(false);
    return;
  }

  /**
   * `chat-stream-menus` 실패(502·업스트림 오류·구버전 Cloudways 등) 시에도 단일 스트림으로 백그라운드 점사를 이어감.
   * (프롬프트 캐싱용 `fortune_menu_cached_system`은 새 server.js 전제 — 실패 시 레거시 `/chat` 본문으로 폴백)
   */
  res = await fetch("/api/fortune/chat-stream", {
    method: "POST",
    headers: streamHeaders,
    body: JSON.stringify(streamBody),
    signal,
  });

  if (res.status === 501) {
    res = await fetch("/api/fortune/two-stage-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        product_slug: productSlug,
        profile,
        manse_context: manse_ryeok_text,
        character_key: characterKey,
        order_no: orderNo ?? undefined,
      }),
      signal,
    });
    if (!res.ok || !res.body) return;
    await pumpSseBody(res.body.getReader(), "sections");
    return;
  }

  if (!res.ok || !res.body) return;
  await pumpSseBody(res.body.getReader(), "claude_html_stream");
  if (!claudeDoneEvent && !signal.aborted && !pumpSawError) {
    const html = claudeStreamHtml.trim();
    if (html.length >= 80 && claudeStreamStarted) {
      claudeDoneEvent = true;
      claudeStreamHtml = html;
      flush(true);
    } else {
      flush(false);
    }
  } else if (!claudeDoneEvent && !signal.aborted) {
    flush(false);
  }
}
