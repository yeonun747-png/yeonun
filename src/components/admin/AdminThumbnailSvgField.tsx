"use client";

import { useState } from "react";

export function AdminThumbnailSvgField({
  name,
  defaultValue = "",
  rows = 8,
  /** 실제 풀이 카드와 동일한 `y-content-card` 테마(배경·currentColor) */
  previewVariant = "yeon",
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
  previewVariant?: string;
}) {
  const [val, setVal] = useState(defaultValue);
  const safe = val.trim();

  return (
    <div className="y-admin-thumbnail-svg-grid">
      <label className="y-admin-field-stack y-admin-thumbnail-svg-field-input">
        <span className="y-admin-stack-legend">썸네일 SVG</span>
        <textarea
          name={name}
          className="y-admin-code"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          rows={rows}
          placeholder="파일 내용 전체(&lt;svg xmlns=…&gt;…&lt;/svg&gt;) 붙여넣기 · 레포: public/product-thumbnails/"
        />
      </label>
      <div className="y-admin-svg-preview-wrap">
        <span className="y-admin-svg-preview-caption">미리보기 · 카드와 동일 스타일</span>
        {safe ? (
          <div className={`y-admin-svg-preview-faux-card y-content-card ${previewVariant}`}>
            <div className="y-content-visual">
              <div className="y-content-illust" aria-hidden="true">
                <span className="y-content-illust-svg" dangerouslySetInnerHTML={{ __html: safe }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="y-admin-svg-preview-empty-box">
            <span className="y-admin-svg-preview-empty">미리보기 없음</span>
          </div>
        )}
      </div>
    </div>
  );
}
