"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FortuneResultSectionChunks, enrichTocWithMenuMedia } from "@/components/fortune/FortuneResultSectionChunks";
import { buildFortuneMainGroups } from "@/lib/fortune-main-groups";
import type { FortuneResultState } from "@/components/fortune/fortuneFlowTypes";
import type { Product } from "@/lib/data/content";

function stripEmpty(html: string) {
  return html.trim() || "<p>풀이 본문을 불러오고 있어요. 잠시 후 다시 확인해 주세요.</p>";
}

export function Step7Result({
  product,
  result,
  exitHref,
}: {
  product: Product;
  result: FortuneResultState;
  exitHref: string;
}) {
  const [page, setPage] = useState(0);
  const toc = useMemo(() => enrichTocWithMenuMedia(result.toc, product), [result.toc, product]);
  const groups = useMemo(() => buildFortuneMainGroups(result.toc, result.tocGroups), [result.toc, result.tocGroups]);
  const active = groups[page] ?? { mainTitle: product.title, sectionIndices: result.toc.map((_, i) => i) };
  const title = active.mainTitle || product.title;
  const next = groups[page + 1];
  const nextReady =
    result.complete ||
    !next ||
    result.claudeMode ||
    next.sectionIndices.some((i) => (result.sectionHtml[i] ?? "").trim().length > 0);

  const isLastPart = groups.length === 0 ? true : page >= groups.length - 1;
  const nextTitle = nextReady && next ? next.mainTitle : "다음 풀이 준비 중";

  const scrollStageTop = () => {
    const root = document.querySelector<HTMLElement>(".y-fortune-v2-root");
    const stage = root?.querySelector<HTMLElement>(".y-fortune-v2-stage") ?? null;
    if (stage) stage.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const goNextPart = () => {
    if (!next || !nextReady) return;
    setPage((p) => p + 1);
    scrollStageTop();
    requestAnimationFrame(() => scrollStageTop());
    window.setTimeout(scrollStageTop, 80);
  };

  return (
    <section className="y-fortune-v2-result-page">
      <div className="y-fortune-v2-result-head">
        <span>PART {page + 1}</span>
        <h1>{title}</h1>
      </div>
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
          <button
            type="button"
            className="y-fortune-v2-result-next-card"
            disabled={!next || !nextReady}
            onClick={goNextPart}
          >
            <div className="y-fortune-v2-result-next-card__main">
              <span className="y-fortune-v2-result-next-card__lbl">다음 풀이</span>
              <span className="y-fortune-v2-result-next-card__title">{nextTitle}</span>
            </div>
            <span className="y-fortune-v2-result-next-card__arr" aria-hidden>
              →
              <span className="y-fortune-v2-step7-next-anchor" />
            </span>
          </button>
        ) : result.complete ? (
          <Link href={exitHref} className="y-fortune-v2-result-exit-btn">
            나가기 (점사는 자동 저장되요)
          </Link>
        ) : (
          <span
            className="y-fortune-v2-result-exit-btn y-fortune-v2-result-exit-btn--waiting"
            role="status"
            aria-live="polite"
            aria-label="실시간 점사가 모두 끝나면 나갈 수 있어요"
          >
            나가기 (점사는 자동 저장되요)
          </span>
        )}
      </div>
    </section>
  );
}
