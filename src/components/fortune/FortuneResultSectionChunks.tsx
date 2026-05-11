"use client";

import { FortuneStreamSectionMedia } from "@/components/modals/FortuneStreamSectionMedia";
import type { Product } from "@/lib/data/content";
import type { FortuneTocItem } from "@/lib/fortune-stream-client";
import { flattenFortuneMenuForStream } from "@/lib/product-fortune-menu";
import { mainTitleDuplicatedAsFirstSubtitleH3, splitHtmlAfterFirstSubtitleH3Close } from "@/lib/fortune-section-html-split";
import {
  stripAllLibraryMainKickerParagraphBlocks,
  stripLeadingMainKickerParagraph,
  stripMainKickerInsideOpeningSubtitleSection,
} from "@/lib/fortune-saved-html-toc";

/** 스트림 TOC에 미디어 URL이 비어 있으면 어드민 `fortune_menu` 평탄화 행으로 보강 */
export function enrichTocWithMenuMedia(toc: FortuneTocItem[], product: Product | null): FortuneTocItem[] {
  if (!product) return toc;
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

/** 점사 결과·보관함 재생: 대제목 키커 다음 대메뉴 썸네일 → h3까지 HTML → 소메뉴 썸네일 → 나머지 HTML */
export function FortuneResultSectionChunks({
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
        /** 새 대메뉴 구간은 React 키커만 쓰고, 저장 HTML 안의 동일 역할 `<p>`는 클래스 위치와 관계없이 전부 제거 */
        const htmlForBody = showMainKicker
          ? stripAllLibraryMainKickerParagraphBlocks(htmlTrim)
          : stripMainKickerInsideOpeningSubtitleSection(stripLeadingMainKickerParagraph(htmlTrim));
        const showMainThumb =
          showMainKicker &&
          Boolean((item.main_image_url ?? "").trim() || (item.main_video_thumb_url ?? "").trim());
        const showSubThumb = Boolean((item.image_url ?? "").trim() || (item.video_thumb_url ?? "").trim());
        /** 보관함 HTML은 키커가 문자열에 포함됨 — 모달과 같이 React로 키커·썸네일 순을 맞추려면 선두 키커 제거 */
        const htmlBody = htmlForBody;
        const split = splitHtmlAfterFirstSubtitleH3Close(htmlBody);

        const chunkCls =
          "y-fortune-v2-result-chunk" +
          (showMainKicker ? " y-fortune-v2-result-chunk--main-start" : "");

        /** 첫 소제목 블록의 첫 h3가 `mainLabel`과 같으면(또는 `split` 없을 때 본문 전체로 판별) 큰 React 키커 생략 */
        const hideReactMainKickerBecauseH3Duplicates =
          showMainKicker &&
          (split
            ? mainTitleDuplicatedAsFirstSubtitleH3(split.head, mainLabel)
            : mainTitleDuplicatedAsFirstSubtitleH3(htmlBody, mainLabel));

        const splitHeadHtml = split ? stripLeadingMainKickerParagraph(split.head) : "";

        return (
          <div key={`${item.id}-${i}`} className={chunkCls}>
            {showMainKicker && !hideReactMainKickerBecauseH3Duplicates ? (
              <p className="y-fs-section-main-kicker">{mainLabel}</p>
            ) : null}
            {showMainThumb ? (
              <div className="y-fs-body-thumb-wrap y-fs-body-thumb-wrap--result-main">
                <FortuneStreamSectionMedia
                  imageUrl={item.main_image_url}
                  videoThumbUrl={item.main_video_thumb_url}
                />
              </div>
            ) : null}
            {split ? (
              <>
                <div
                  className="y-fs-html y-fs-result-sub-section-start"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: splitHeadHtml }}
                />
                {showSubThumb ? (
                  <div className="y-fs-body-thumb-wrap y-fs-body-thumb-wrap--result-sub">
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
                  <div className="y-fs-body-thumb-wrap y-fs-body-thumb-wrap--result-sub">
                    <FortuneStreamSectionMedia imageUrl={item.image_url} videoThumbUrl={item.video_thumb_url} />
                  </div>
                ) : null}
                <div
                  className="y-fs-html"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: htmlBody }}
                />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
