"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FortuneStreamSectionMedia } from "@/components/modals/FortuneStreamSectionMedia";
import { buildFortuneMainGroups } from "@/lib/fortune-main-groups";
import type { FortuneResultState } from "@/components/fortune/fortuneFlowTypes";
import type { Product } from "@/lib/data/content";
import type { FortuneTocItem } from "@/lib/fortune-stream-client";
import { flattenFortuneMenuForStream } from "@/lib/product-fortune-menu";
import { splitHtmlAfterFirstSubtitleH3Close } from "@/lib/fortune-section-html-split";

function stripEmpty(html: string) {
  return html.trim() || "<p>풀이 본문을 불러오고 있어요. 잠시 후 다시 확인해 주세요.</p>";
}

/** 스트림 TOC에 미디어 URL이 비어 있으면 어드민 `fortune_menu` 평탄화 행으로 보강 — FortuneStreamModal 과 동일 출처 */
function enrichTocWithMenuMedia(toc: FortuneTocItem[], product: Product): FortuneTocItem[] {
  const flat = flattenFortuneMenuForStream(product.fortune_menu);
  if (!flat.length) return toc;
  return toc.map((item, i) => {
    const row = flat[i];
    if (!row) return item;
    const t = (s?: string) => (s ?? "").trim();
    return {
      ...item,
      main_title: t(item.main_title) || row.main_title,
      main_image_url: t(item.main_image_url) || row.main_image_url,
      main_video_thumb_url: t(item.main_video_thumb_url) || row.main_video_thumb_url,
      image_url: t(item.image_url) || row.image_url,
      video_thumb_url: t(item.video_thumb_url) || row.video_thumb_url,
    };
  });
}

/** `FortuneStreamModal` 본문과 동일: 대제목 키커 → 대메뉴 썸네일 → h3까지 HTML → 소메뉴 썸네일 → 나머지 HTML */
function ResultSectionsHtml({
  toc,
  sectionIndices,
  sectionHtml,
}: {
  toc: FortuneTocItem[];
  sectionIndices: number[];
  sectionHtml: Record<number, string>;
}) {
  return (
    <>
      {sectionIndices.map((i) => {
        const item = toc[i];
        if (!item) return null;
        const html = sectionHtml[i] ?? "";
        const htmlTrim = html.trim();
        if (!htmlTrim) return null;

        const mainLabel = item.main_title?.trim() ?? "";
        const prevMain = i > 0 ? (toc[i - 1]?.main_title?.trim() ?? "") : "";
        const showMainKicker = Boolean(mainLabel) && (i === 0 || prevMain !== mainLabel);
        const showMainThumb =
          showMainKicker &&
          Boolean((item.main_image_url ?? "").trim() || (item.main_video_thumb_url ?? "").trim());
        const showSubThumb = Boolean((item.image_url ?? "").trim() || (item.video_thumb_url ?? "").trim());
        const split = splitHtmlAfterFirstSubtitleH3Close(html);

        return (
          <div key={`${item.id}-${i}`} className="y-fortune-v2-result-chunk">
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
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: split.head }}
                />
                {showSubThumb ? (
                  <div className="y-fs-body-thumb-wrap">
                    <FortuneStreamSectionMedia imageUrl={item.image_url} videoThumbUrl={item.video_thumb_url} />
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
              <>
                {showSubThumb ? (
                  <div className="y-fs-body-thumb-wrap">
                    <FortuneStreamSectionMedia imageUrl={item.image_url} videoThumbUrl={item.video_thumb_url} />
                  </div>
                ) : null}
                <div
                  className="y-fs-html"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </>
            )}
          </div>
        );
      })}
    </>
  );
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
    const root = document.querySelector<HTMLElement>('.y-fortune-v2-root[data-step="7"]');
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
          <ResultSectionsHtml toc={toc} sectionIndices={active.sectionIndices} sectionHtml={result.sectionHtml} />
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
        ) : (
          <Link href={exitHref} className="y-fortune-v2-result-exit-btn">
            나가기 (점사는 자동 저장되요)
          </Link>
        )}
      </div>
    </section>
  );
}
