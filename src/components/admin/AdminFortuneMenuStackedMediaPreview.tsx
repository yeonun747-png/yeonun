"use client";

/**
 * 대메뉴/소메뉴: 이미지·동영상 썸네일이 둘 다 있으면 이미지 아래 깔고 동영상을 같은 영역 위에 겹침.
 * 하나만 있으면 해당 매체만. 가로는 뷰포트의 50%(최대 카드 너비). 동영상은 음소거 루프 자동재생.
 */
export function AdminFortuneMenuStackedMediaPreview({
  imageUrl,
  videoThumbUrl,
}: {
  imageUrl: string;
  videoThumbUrl: string;
}) {
  const img = imageUrl.trim();
  const vid = videoThumbUrl.trim();
  if (!img && !vid) return null;

  if (img && vid) {
    return (
      <div className="y-admin-fortune-stacked-wrap">
        <span className="y-admin-fortune-stacked-legend">미리보기 (이미지 + 동영상)</span>
        <div className="y-admin-fortune-stacked-media" role="group" aria-label="이미지와 동영상 썸네일 미리보기">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="y-admin-fortune-stacked-base" decoding="async" />
          <video
            className="y-admin-fortune-stacked-overlay"
            src={vid}
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
            aria-label="동영상 썸네일 반복 재생"
          />
        </div>
      </div>
    );
  }

  if (img) {
    return (
      <div className="y-admin-fortune-stacked-wrap">
        <span className="y-admin-fortune-stacked-legend">미리보기 (이미지)</span>
        <div className="y-admin-fortune-stacked-media y-admin-fortune-stacked-media--single">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="y-admin-fortune-stacked-base" decoding="async" />
        </div>
      </div>
    );
  }

  return (
    <div className="y-admin-fortune-stacked-wrap">
      <span className="y-admin-fortune-stacked-legend">미리보기 (동영상)</span>
      <div className="y-admin-fortune-stacked-media y-admin-fortune-stacked-media--single" role="group" aria-label="동영상 썸네일 미리보기">
        <video
          className="y-admin-fortune-stacked-video-only"
          src={vid}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
        />
      </div>
    </div>
  );
}
