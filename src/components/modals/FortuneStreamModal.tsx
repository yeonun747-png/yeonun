"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { partnerInfoFromPartnerStorage, readUserInfoFromYeonunSajuV1 } from "@/lib/fortune-jeminai-user";
import { buildFortuneManseContext } from "@/lib/fortune-manse-context";
import {
  normalizeFortuneSsePayload,
  parseFortuneSseBlock,
  type FortuneStreamEvt,
} from "@/lib/fortune-stream-client";
import { demoTocSections, type DemoProfile } from "@/lib/fortune-two-stage-demo";

const CHAR_NAME: Record<string, string> = {
  yeon: "연화",
  byeol: "별하",
  yeo: "여연",
  un: "운서",
};

type TocItem = { id: string; title: string };

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

const JEMINAI_TOC_INTRO_MS = 1500;
const JEMINAI_TOC_ITEM_STAGGER_MS = 180;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
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
  const profile = (sp.get("profile") === "pair" ? "pair" : "single") as DemoProfile;
  const charName = CHAR_NAME[characterKey] ?? "연운";

  const [phase, setPhase] = useState<"boot" | "toc_wait" | "toc_typing" | "stream" | "done">("boot");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [sectionHtml, setSectionHtml] = useState<Record<number, string>>({});
  const [activeIdx, setActiveIdx] = useState(-1);
  const [doneIdx, setDoneIdx] = useState<Set<number>>(new Set());
  const [finalChars, setFinalChars] = useState<number | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [jeminaiMode, setJeminaiMode] = useState(false);
  const [jeminaiHtml, setJeminaiHtml] = useState("");
  const jeminaiAccRef = useRef("");
  const [tocVisibleCount, setTocVisibleCount] = useState(0);
  const jeminaiIntroCompleteRef = useRef(false);
  const jeminaiPreStreamBufferRef = useRef("");
  const jeminaiDoneHtmlRef = useRef<string | null>(null);
  const jeminaiStreamFinishedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sectionHtmlRef = useRef<Record<number, string>>({});

  const streamedCharApprox = useMemo(() => {
    if (jeminaiMode) return countApproxCharsFromHtml(jeminaiHtml);
    return countApproxChars(sectionHtml);
  }, [jeminaiMode, jeminaiHtml, sectionHtml]);

  const heroDate = useMemo(() => kstDateShortDots(), []);

  const jeminaiTocUi = useMemo(() => {
    if (!jeminaiMode || toc.length === 0) return { active: -1, done: new Set<number>() };
    if (phase === "done") return { active: -1, done: new Set(toc.map((_, i) => i)) };
    if (phase === "toc_typing" || phase === "toc_wait") return { active: -1, done: new Set<number>() };
    const n = countSubtitleSections(jeminaiHtml);
    if (n <= 0) return { active: -1, done: new Set<number>() };
    const active = Math.min(Math.max(0, n - 1), toc.length - 1);
    const done = new Set<number>();
    for (let i = 0; i < active; i++) done.add(i);
    return { active, done };
  }, [jeminaiMode, toc, phase, jeminaiHtml]);

  const pumpSseBody = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>, ac: AbortController, mode: "jeminai" | "sections") => {
      const dec = new TextDecoder();
      let buf = "";

      const flushJeminaiBlock = (block: string) => {
        for (const raw of parseFortuneSseBlock(block)) {
          if (!raw || typeof raw !== "object") continue;
          const o = raw as Record<string, unknown>;
          const typ = o.type;
          if (typ === "start") {
            setJeminaiMode(true);
            setToc(demoTocSections(profile));
            jeminaiAccRef.current = "";
            setJeminaiHtml("");
            jeminaiIntroCompleteRef.current = false;
            jeminaiPreStreamBufferRef.current = "";
            jeminaiDoneHtmlRef.current = null;
            jeminaiStreamFinishedRef.current = false;
            setTocVisibleCount(0);
            setDoneIdx(new Set());
            setPhase("toc_typing");
          }
          if (typ === "chunk" && typeof o.text === "string") {
            const t = o.text;
            jeminaiAccRef.current += t;
            if (!jeminaiIntroCompleteRef.current) {
              jeminaiPreStreamBufferRef.current += t;
            } else {
              setJeminaiHtml((h) => h + t);
            }
          }
          if (typ === "partial_done" && typeof o.html === "string") {
            const html = String(o.html);
            jeminaiAccRef.current = html;
            if (!jeminaiIntroCompleteRef.current) {
              jeminaiPreStreamBufferRef.current = html;
            } else {
              setJeminaiHtml(html);
            }
          }
          if (typ === "done") {
            const html = String(o.html ?? "");
            jeminaiAccRef.current = html;
            const n = countApproxCharsFromHtml(html);
            setFinalChars(Math.max(n, 1));
            if (!jeminaiIntroCompleteRef.current) {
              jeminaiDoneHtmlRef.current = html;
              jeminaiStreamFinishedRef.current = true;
              jeminaiPreStreamBufferRef.current = html;
            } else {
              setJeminaiHtml(html);
              const len = demoTocSections(profile).length;
              setDoneIdx(new Set(Array.from({ length: len }, (_, i) => i)));
              setPhase("done");
            }
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
        if (ev.type === "section_end") {
          setDoneIdx((prev) => new Set(prev).add(ev.index));
          setActiveIdx(-1);
        }
        if (ev.type === "done") {
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
            if (mode === "jeminai") flushJeminaiBlock(buf);
            else flushSectionsBlock(buf);
          }
          return;
        }
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const block of parts) {
          if (mode === "jeminai") flushJeminaiBlock(block);
          else flushSectionsBlock(block);
        }
        await pump();
      };
      await pump();
    },
    [profile],
  );

  const runStream = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase("toc_wait");
    setToc([]);
    setSectionHtml({});
    sectionHtmlRef.current = {};
    setActiveIdx(-1);
    setDoneIdx(new Set());
    setFinalChars(null);
    setStreamError(null);
    setJeminaiMode(false);
    setJeminaiHtml("");
    jeminaiAccRef.current = "";
    setTocVisibleCount(0);
    jeminaiIntroCompleteRef.current = false;
    jeminaiPreStreamBufferRef.current = "";
    jeminaiDoneHtmlRef.current = null;
    jeminaiStreamFinishedRef.current = false;

    try {
      const manse_ryeok_text = buildFortuneManseContext({
        profile,
        productSlug: product,
      });
      const user_info = readUserInfoFromYeonunSajuV1();
      const partner_info = profile === "pair" ? partnerInfoFromPartnerStorage(product) : null;

      let res = await fetch("/api/fortune/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          product_slug: product,
          profile,
          character_key: characterKey,
          order_no: orderNo ?? undefined,
          title,
          manse_ryeok_text,
          user_info,
          partner_info,
        }),
        signal: ac.signal,
      });

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
        await pumpSseBody(res.body.getReader(), ac, "sections");
        const approx = countApproxChars(sectionHtmlRef.current);
        setFinalChars((prev) => (prev != null ? prev : Math.max(approx, 1)));
        setPhase("done");
        return;
      }

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText.slice(0, 400) || "스트림 연결 실패");
      }

      await pumpSseBody(res.body.getReader(), ac, "jeminai");
      setFinalChars((prev) => prev ?? Math.max(countApproxCharsFromHtml(jeminaiAccRef.current), 1));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setStreamError((e as Error).message || "연결에 실패했습니다.");
      setPhase("done");
    }
  }, [product, profile, characterKey, orderNo, title, pumpSseBody]);

  useEffect(() => {
    void runStream();
    return () => abortRef.current?.abort();
  }, [runStream]);

  /** Cloudways 단일 스트림: 서버 start 직후 목차 인트로(1.5s + 항목 0.18s) 후 본문 공개 */
  useEffect(() => {
    if (!jeminaiMode || phase !== "toc_typing" || toc.length === 0) return;
    let cancelled = false;
    const run = async () => {
      await sleep(JEMINAI_TOC_INTRO_MS);
      if (cancelled) return;
      for (let v = 1; v <= toc.length; v++) {
        if (cancelled) return;
        setTocVisibleCount(v);
        await sleep(JEMINAI_TOC_ITEM_STAGGER_MS);
      }
      if (cancelled) return;
      const doneHtml = jeminaiDoneHtmlRef.current;
      const buf = jeminaiPreStreamBufferRef.current;
      const merged = doneHtml ?? buf;
      jeminaiIntroCompleteRef.current = true;
      if (merged) setJeminaiHtml(merged);
      jeminaiPreStreamBufferRef.current = "";
      if (jeminaiStreamFinishedRef.current) {
        const html = jeminaiDoneHtmlRef.current ?? merged;
        if (html) setJeminaiHtml(html);
        jeminaiDoneHtmlRef.current = null;
        const len = toc.length;
        setDoneIdx(new Set(Array.from({ length: len }, (_, i) => i)));
        setPhase("done");
      } else {
        setPhase("stream");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [jeminaiMode, phase, toc.length]);

  const closeToContent = () => {
    const next = new URLSearchParams(sp.toString());
    next.delete("modal");
    next.delete("order_no");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const scrollToSection = useCallback(
    (index: number) => {
      if (jeminaiMode) {
        const nodes = document.querySelectorAll(".y-fs-html--jeminai .subtitle-section");
        nodes[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      document.getElementById(`y-fs-section-${index}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [jeminaiMode],
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

  const charMetaText =
    finalChars != null
      ? `${finalChars.toLocaleString("ko-KR")}자`
      : streamedCharApprox > 0
        ? `${streamedCharApprox.toLocaleString("ko-KR")}자 생성 중…`
        : phase === "toc_wait" || phase === "toc_typing"
          ? "본문 준비 중…"
          : "생성 중…";

  const bodyVisible = jeminaiMode
    ? phase !== "boot" && phase !== "toc_wait"
    : toc.length > 0 && phase !== "boot" && phase !== "toc_wait";

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
            </header>

            <section className="y-fs-toc-panel" aria-label="목차 영역">
              <div className="y-fs-toc-wrap">
                <div className="y-fs-toc-card">
                  {phase === "toc_wait" ? (
                    <div className="y-fs-toc-loading" aria-live="polite">
                      <span className="y-fs-dot-pulse" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="y-fs-toc-loading-tx">● 목차를 구성하고 있어요</span>
                    </div>
                  ) : null}

                  {toc.length > 0 ? (
                    <>
                      <div className="y-fs-toc-card-head">
                        <span className="y-fs-toc-card-head-tx">● 목차를 구성하고 있어요</span>
                      </div>
                      <ol className="y-fs-toc" aria-label="목차">
                        {toc.map((item, i) => {
                          const done = jeminaiMode ? jeminaiTocUi.done.has(i) : doneIdx.has(i);
                          const active = jeminaiMode ? jeminaiTocUi.active === i : activeIdx === i;
                          let cls = "y-fs-toc-item";
                          if (done) cls += " y-fs-toc-item--done";
                          else if (active) cls += " y-fs-toc-item--active";
                          else cls += " y-fs-toc-item--pending";
                          if (jeminaiMode && phase === "toc_typing" && i >= tocVisibleCount) cls += " y-fs-toc-item--typing-wait";
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
                    </>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="y-fs-main-panel">
              {jeminaiMode ? (
                <div className={`y-fs-body ${bodyVisible ? "y-fs-body--visible" : ""}`}>
                  <article id="y-fs-section-0" className="y-fs-section y-fs-section--active">
                    <div className={`y-fs-section-inner${phase !== "done" && jeminaiHtml ? " y-fs-section-inner--streaming" : ""}`}>
                      {jeminaiHtml ? (
                        <>
                          <div
                            className="y-fs-html y-fs-html--jeminai"
                            id="y-fs-h-0"
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{ __html: jeminaiHtml }}
                          />
                          {phase !== "done" ? <span className="y-fs-caret" aria-hidden="true" /> : null}
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
                    const done = doneIdx.has(i);
                    const active = activeIdx === i;
                    const showSkel = (phase === "stream" || phase === "done") && !done && !active && !html;
                    let boxCls = "y-fs-section";
                    if (done) boxCls += " y-fs-section--done";
                    else if (active) boxCls += " y-fs-section--active";
                    else if (showSkel) boxCls += " y-fs-section--pending";
                    return (
                      <article key={item.id} id={`y-fs-section-${i}`} className={boxCls} aria-labelledby={`y-fs-h-${i}`}>
                        <div className={`y-fs-section-inner${active ? " y-fs-section-inner--streaming" : ""}`}>
                          {html ? (
                            <>
                              <div
                                className="y-fs-html"
                                id={`y-fs-h-${i}`}
                                // eslint-disable-next-line react/no-danger
                                dangerouslySetInnerHTML={{ __html: html }}
                              />
                              {active ? <span className="y-fs-caret" aria-hidden="true" /> : null}
                            </>
                          ) : showSkel ? (
                            <>
                              <h2 className="y-fs-skel-h2" id={`y-fs-h-${i}`}>
                                ● {item.title}
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

        {phase === "done" ? (
          <div className="y-fs-actions">
            <button type="button" className="y-fs-act-save" onClick={closeToContent}>
              <svg
                className="y-fs-act-save-ic"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              보관함에 저장
            </button>
            <Link className="y-fs-act-consult" href={`/call?ck=${encodeURIComponent(characterKey)}`} scroll={false}>
              {charName}와 이 풀이로 음성 상담 이어가기 →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
