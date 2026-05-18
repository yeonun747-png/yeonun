"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { FortuneResultSectionChunks, enrichTocWithMenuMedia } from "@/components/fortune/FortuneResultSectionChunks";
import type { FortuneResultState } from "@/components/fortune/fortuneFlowTypes";
import { buildFortuneMainGroups } from "@/lib/fortune-main-groups";
import { canNavigateToFortunePart, fortunePartSectionsReady } from "@/lib/fortune-part-readiness";
import type { Product } from "@/lib/data/content";

function stripEmpty(html: string) {
  return html.trim() || "<p>풀이 본문을 불러오고 있어요. 잠시 후 다시 확인해 주세요.</p>";
}

type FortuneResultPartNavProps = {
  placement: "top" | "bottom";
  groups: ReturnType<typeof buildFortuneMainGroups>;
  page: number;
  doneSet: Set<number>;
  streamComplete: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onGoToPart: (target: number) => void;
  onGoPrevPart: () => void;
  onGoNextPart: () => void;
};

function FortuneResultPartNav({
  placement,
  groups,
  page,
  doneSet,
  streamComplete,
  canGoPrev,
  canGoNext,
  onGoToPart,
  onGoPrevPart,
  onGoNextPart,
}: FortuneResultPartNavProps) {
  const label = placement === "top" ? "파트 이동" : "파트 이동 (하단)";
  return (
    <nav
      className={`y-fortune-v2-result-part-nav${placement === "bottom" ? " y-fortune-v2-result-part-nav--bottom" : ""}`}
      aria-label={label}
    >
      <button type="button" className="y-fortune-v2-result-part-arrow" disabled={!canGoPrev} onClick={onGoPrevPart}>
        ‹ 이전
      </button>
      <div className="y-fortune-v2-result-part-pills" role="tablist" aria-label="대메뉴 파트">
        {groups.map((g, i) => {
          const reachable = canNavigateToFortunePart(i, page, groups, doneSet, streamComplete);
          const ready = fortunePartSectionsReady(g.sectionIndices, doneSet, streamComplete);
          return (
            <button
              key={`${g.mainTitle}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={`${g.mainTitle}${ready ? "" : ", 점사 중"}`}
              className={`y-fortune-v2-result-part-pill${i === page ? " is-active" : ""}${ready ? " is-ready" : ""}`}
              disabled={!reachable}
              onClick={() => onGoToPart(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <button type="button" className="y-fortune-v2-result-part-arrow" disabled={!canGoNext} onClick={onGoNextPart}>
        다음 ›
      </button>
    </nav>
  );
}

export function Step7Result({
  product,
  result,
  exitHref,
  blockExit = false,
}: {
  product: Product;
  result: FortuneResultState;
  exitHref: string;
  /** 메뉴 카드 실시간 점사 중 나가기·이탈 UI 비활성 */
  blockExit?: boolean;
}) {
  const [page, setPage] = useState(0);
  const toc = useMemo(() => enrichTocWithMenuMedia(result.toc, product), [result.toc, product]);
  const groups = useMemo(() => buildFortuneMainGroups(result.toc, result.tocGroups), [result.toc, result.tocGroups]);
  const doneSet = useMemo(() => new Set(result.doneIdx), [result.doneIdx]);

  const active = groups[page] ?? { mainTitle: product.title, sectionIndices: result.toc.map((_, i) => i) };
  const title = active.mainTitle || product.title;
  const next = groups[page + 1];

  const currentPartReady = result.claudeMode
    ? result.complete || result.claudeHtml.trim().length > 0
    : fortunePartSectionsReady(active.sectionIndices, doneSet, result.complete);

  const canGoPrev = page > 0;
  const canGoNext = Boolean(next) && (result.complete || currentPartReady);

  const isLastPart = groups.length === 0 ? true : page >= groups.length - 1;
  const showPartNav = groups.length > 1 && !result.claudeMode;

  const nextTitle = !next
    ? ""
    : canGoNext
      ? next.mainTitle
      : "이 파트 점사가 끝나면 넘어갈 수 있어요";

  const scrollStageTop = useCallback(() => {
    const root = document.querySelector<HTMLElement>(".y-fortune-v2-root");
    const stage = root?.querySelector<HTMLElement>(".y-fortune-v2-stage") ?? null;
    if (stage) stage.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const goToPart = useCallback(
    (target: number) => {
      if (target < 0 || target >= groups.length) return;
      if (!result.claudeMode && !canNavigateToFortunePart(target, page, groups, doneSet, result.complete)) return;
      setPage(target);
      scrollStageTop();
      requestAnimationFrame(() => scrollStageTop());
      window.setTimeout(scrollStageTop, 80);
    },
    [doneSet, groups, page, result.claudeMode, result.complete, scrollStageTop],
  );

  const goPrevPart = () => goToPart(page - 1);
  const goNextPart = () => {
    if (!canGoNext) return;
    goToPart(page + 1);
  };

  const partNavCommon = showPartNav
    ? {
        groups,
        page,
        doneSet,
        streamComplete: result.complete,
        canGoPrev,
        canGoNext,
        onGoToPart: goToPart,
        onGoPrevPart: goPrevPart,
        onGoNextPart: goNextPart,
      }
    : null;

  return (
    <section className="y-fortune-v2-result-page">
      <div className="y-fortune-v2-result-head">
        <span>
          PART {page + 1}
          {groups.length > 1 ? ` / ${groups.length}` : ""}
        </span>
        <h1>{title}</h1>
      </div>

      {partNavCommon ? <FortuneResultPartNav placement="top" {...partNavCommon} /> : null}

      <article className="y-fortune-v2-result-html">
        {result.claudeMode ? (
          <div
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: stripEmpty(result.claudeHtml) }}
          />
        ) : (
          <FortuneResultSectionChunks toc={toc} sectionIndices={active.sectionIndices} sectionHtml={result.sectionHtml} />
        )}
      </article>

      <div className="y-fortune-v2-result-dock-inline" aria-label="풀이 이동">
        {!isLastPart ? (
          <button type="button" className="y-fortune-v2-result-next-card" disabled={!next || !canGoNext} onClick={goNextPart}>
            <div className="y-fortune-v2-result-next-card__main">
              <span className="y-fortune-v2-result-next-card__lbl">다음 풀이</span>
              <span className="y-fortune-v2-result-next-card__title">{nextTitle}</span>
            </div>
            <span className="y-fortune-v2-result-next-card__arr" aria-hidden>
              →
              <span className="y-fortune-v2-step7-next-anchor" />
            </span>
          </button>
        ) : blockExit || !result.complete ? (
          <span
            className="y-fortune-v2-result-exit-btn y-fortune-v2-result-exit-btn--waiting"
            role="status"
            aria-live="polite"
            aria-label="실시간 점사가 모두 끝나면 나갈 수 있어요"
          >
            나가기 (점사는 자동 저장되요)
          </span>
        ) : (
          <Link href={exitHref} className="y-fortune-v2-result-exit-btn" prefetch={false}>
            나가기 (점사는 자동 저장되요)
          </Link>
        )}
      </div>

      {partNavCommon ? <FortuneResultPartNav placement="bottom" {...partNavCommon} /> : null}
    </section>
  );
}
