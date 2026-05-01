"use client";

/**
 * 이미지·동영상(mp4) 썸네일 — 이미지를 깔고 동영상을 같은 영역 위에 겹침.
 * `layout="toc"` 는 목차 블록 안에서 사용(부모에서 가운데 정렬).
 */
export function FortuneStreamSectionMedia({
  imageUrl,
  videoThumbUrl,
  layout = "default",
}: {
  imageUrl?: string;
  videoThumbUrl?: string;
  /** toc: 목차 전용 래퍼 클래스 */
  layout?: "default" | "toc";
}) {
  const img = String(imageUrl ?? "").trim();
  const vid = String(videoThumbUrl ?? "").trim();
  if (!img && !vid) return null;

  const rootCls =
    layout === "toc" ? "y-fs-section-media y-fs-section-media--toc" : "y-fs-section-media";

  if (img && vid) {
    return (
      <div className={rootCls} role="group" aria-label="썸네일">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt="" className="y-fs-section-media-base" decoding="async" />
        <video
          className="y-fs-section-media-overlay"
          src={vid}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
        />
      </div>
    );
  }

  if (img) {
    return (
      <div className={`${rootCls} y-fs-section-media--single`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt="" className="y-fs-section-media-base" decoding="async" />
      </div>
    );
  }

  return (
    <div className={`${rootCls} y-fs-section-media--single`} role="group" aria-label="동영상 썸네일">
      <video
        className="y-fs-section-media-video-only"
        src={vid}
        muted
        playsInline
        autoPlay
        loop
        preload="metadata"
      />
    </div>
  );
}
