"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FortuneVoiceConsultDock } from "@/components/modals/FortuneVoiceConsultDock";
import { setVoiceManseMeta } from "@/lib/voice-dcc-manse-meta";
import { flattenTocGroupsToFlatItems } from "@/lib/library-toc-snapshot";
import { injectMainKickersFromTocIfApplicable } from "@/lib/fortune-saved-html-toc";
import type { FortuneTocItem } from "@/lib/fortune-stream-client";
import type { FortuneTocMainGroup } from "@/lib/product-fortune-menu";

const LS_VOICE_BALANCE_SEC = "yeonun_voice_balance_sec";

/**
 * 보관함 저장 풀이 재생 — FortuneStreamModal 의 점사 완료 화면과 동일한 DOM·클래스만 사용한다.
 * (y-fs-fullpage-inner → scroll-stack → toc-fab / FortuneVoiceConsultDock — 점사 모달과 동일한 형제 배치)
 */

export function LibraryFortuneReplay(props: {
  heroTitle: string;
  charLabel: string;
  profileKo: string;
  savedAtLabel: string;
  charApprox: number;
  html: string;
  tocSections?: FortuneTocItem[] | null;
  tocGroups?: FortuneTocMainGroup[] | null;
  fallbackTocTitles?: string[];
  characterKey: string;
  productSlug: string | null;
  voiceBriefTitle: string;
  resultId: string;
  voiceConsultSummary?: string | null;
  /** fortune_requests.payload.profile — 궁합 음성 시 상대 만세력 주입 */
  profile: "single" | "pair";
}) {
  const {
    heroTitle,
    charLabel,
    profileKo,
    savedAtLabel,
    charApprox,
    html,
    tocSections,
    tocGroups,
    fallbackTocTitles = [],
    characterKey,
    productSlug,
    voiceBriefTitle,
    resultId,
    voiceConsultSummary,
    profile,
  } = props;

  const router = useRouter();
  const [voiceContinueBusy, setVoiceContinueBusy] = useState(false);
  const [voicePayOpen, setVoicePayOpen] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  /** FortuneStreamModal 의 claudeStreamMode 분기와 동일 */
  const scrollToSection = useCallback((index: number) => {
    const nodes = document.querySelectorAll(".y-fs-html--claude-stream .subtitle-section");
    nodes[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToTocTop = useCallback(() => {
    const scrollEl = document.querySelector<HTMLElement>(".y-lib-replay .y-fs-fullpage-scroll");
    const anchor = document.getElementById("y-fs-toc-anchor");
    if (!scrollEl || !anchor) return;
    const sr = scrollEl.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const nextTop = scrollEl.scrollTop + (ar.top - sr.top) - 8;
    scrollEl.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  }, []);

  const onTocDoneKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLLIElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        scrollToSection(index);
      }
    },
    [scrollToSection],
  );

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
      const slug = String(productSlug ?? "").trim();
      try {
        sessionStorage.setItem(
          "yeonun_fortune_voice_brief",
          JSON.stringify({
            summary,
            title: voiceBriefTitle,
            product_slug: productSlug ?? "",
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
    [router, voiceBriefTitle, productSlug, profile, characterKey],
  );

  /** 레거시 저장본에 빠진 대제목(main_title) 접두사 보정 — 신규 저장은 본문에 이미 포함 */
  const tocFlatForInject = useMemo((): FortuneTocItem[] | null => {
    if (tocSections && tocSections.length > 0) return tocSections;
    if (tocGroups && tocGroups.length > 0) return flattenTocGroupsToFlatItems(tocGroups);
    return null;
  }, [tocSections, tocGroups]);

  const displayHtml = useMemo(
    () => injectMainKickersFromTocIfApplicable(html, tocFlatForInject),
    [html, tocFlatForInject],
  );

  const onVoiceContinue = useCallback(async () => {
    if (voiceContinueBusy) return;
    if (readVoiceBalanceSec() <= 0) {
      setVoicePayOpen(true);
      return;
    }
    const fromDb = String(voiceConsultSummary ?? "").trim();
    if (fromDb) {
      setVoiceError(null);
      await persistVoiceBriefAndGoCall(fromDb);
      return;
    }
    const bodyHtml = String(displayHtml || "").trim();
    if (!bodyHtml) {
      setVoiceError("음성 상담용 본문이 없습니다.");
      return;
    }
    setVoiceContinueBusy(true);
    setVoiceError(null);
    try {
      const res = await fetch("/api/fortune/summarize-for-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: bodyHtml }),
      });
      const j = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
      if (!res.ok || typeof j.summary !== "string" || !j.summary.trim()) {
        throw new Error(j.error || "요약에 실패했습니다.");
      }
      const text = j.summary.trim();
      await persistVoiceBriefAndGoCall(text);
      void fetch("/api/fortune/result-voice-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result_id: resultId, voice_consult_summary: text }),
      });
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : "음성 상담 준비에 실패했습니다.");
    } finally {
      setVoiceContinueBusy(false);
    }
  }, [
    voiceContinueBusy,
    readVoiceBalanceSec,
    displayHtml,
    voiceConsultSummary,
    resultId,
    persistVoiceBriefAndGoCall,
  ]);

  const useGrouped = Boolean(tocGroups && tocGroups.length > 0);
  const flatFromSnap = Boolean(!useGrouped && tocSections && tocSections.length > 0);
  const flatRows =
    flatFromSnap && tocSections
      ? tocSections.map((item, i) => ({ key: item.id || `s${i}`, title: item.title, index: i }))
      : !useGrouped
        ? fallbackTocTitles.map((title, i) => ({ key: `fb-${i}`, title, index: i }))
        : [];
  const hasToc = useGrouped || flatRows.length > 0;

  return (
    <div
      className="y-fs-fullpage y-fs-modal y-lib-embedded y-lib-replay"
      role="dialog"
      aria-modal="true"
      aria-label="풀이 결과"
    >
      <div className="y-fs-fullpage-inner">
        <div className="y-modal-scroll y-fs-scroll y-fs-fullpage-scroll">
          <div className="y-fs-scroll-stack">
            <header className="y-fs-hero">
              <p className="y-fs-hero-kicker">{charLabel}의 풀이</p>
              <h1 className="y-fs-hero-title">{heroTitle}</h1>
              <p className="y-fs-hero-meta">
                {charLabel} · {profileKo} · 저장 {savedAtLabel} · {charApprox.toLocaleString("ko-KR")}자
              </p>
              {voiceError ? (
                <p className="y-fs-stream-error" role="alert">
                  {voiceError}
                </p>
              ) : null}
            </header>

            {hasToc ? (
              <section className="y-fs-toc-panel" id="y-fs-toc-anchor" aria-label="목차 영역">
                <div className="y-fs-toc-wrap">
                  <div className="y-fs-toc-card">
                    <div className="y-fs-toc-card-head">
                      <span className="y-fs-toc-card-head-tx">● 목차</span>
                    </div>
                    {useGrouped && tocGroups ? (
                      <div className="y-fs-toc-grouped" aria-label="목차">
                        {tocGroups.map((g) => (
                          <div key={g.main_id} className="y-fs-toc-group-block">
                            <div className="y-fs-toc-main-line">{g.main_title}</div>
                            <ol className="y-fs-toc y-fs-toc--sub">
                              {g.subs.map((sub) => {
                                const i = sub.sectionIndex;
                                const cls =
                                  "y-fs-toc-item y-fs-toc-item--sub y-fs-toc-item--done y-fs-toc-item--clickable";
                                return (
                                  <li
                                    key={sub.id}
                                    className={cls}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`${sub.title} 섹션으로 이동`}
                                    onClick={() => scrollToSection(i)}
                                    onKeyDown={(e) => onTocDoneKeyDown(i, e)}
                                  >
                                    <span className="y-fs-toc-tx">{sub.title}</span>
                                    <span className="y-fs-toc-check" aria-hidden="true">
                                      ✓
                                    </span>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ol className="y-fs-toc" aria-label="목차">
                        {flatRows.map((row, i) => {
                          const cls = "y-fs-toc-item y-fs-toc-item--done y-fs-toc-item--clickable";
                          return (
                            <li
                              key={row.key}
                              className={cls}
                              role="button"
                              tabIndex={0}
                              aria-label={`${row.title} 섹션으로 이동`}
                              onClick={() => scrollToSection(row.index)}
                              onKeyDown={(e) => onTocDoneKeyDown(row.index, e)}
                            >
                              <span className="y-fs-toc-num">{i + 1}</span>
                              <span className="y-fs-toc-tx">{row.title}</span>
                              <span className="y-fs-toc-check" aria-hidden="true">
                                ✓
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="y-fs-main-panel" aria-label="풀이 본문">
              <div className="y-fs-body y-fs-body--visible">
                <article id="y-fs-section-0" className="y-fs-section y-fs-section--active">
                  <div className="y-fs-section-inner">
                    <div
                      className="y-fs-html y-fs-html--claude-stream"
                      id="y-fs-h-0"
                      dangerouslySetInnerHTML={{ __html: displayHtml }}
                    />
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>

        {hasToc ? (
          <button
            type="button"
            className="y-fs-toc-fab y-fs-toc-fab--with-actions"
            onClick={scrollToTocTop}
            aria-label="목차로 이동"
          >
            목차로 이동
          </button>
        ) : null}
        <FortuneVoiceConsultDock
          hasTocFabClear={hasToc}
          busy={voiceContinueBusy}
          ctaLabel={`${charLabel}와 이 풀이로 음성 상담 이어가기 →`}
          onContinue={() => void onVoiceContinue()}
        />
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
                <Link className="y-fs-voice-pay-primary" href="/checkout/credit">
                  크레딧 충전하기
                </Link>
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
