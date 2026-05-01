"use client";

import { useEffect, useState, type ReactNode } from "react";

export function AdminThumbnailSvgField({
  name,
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  rows = 8,
  /** 실제 풀이 카드와 동일한 `y-content-card` 테마(배경·currentColor) */
  previewVariant = "yeon",
  /** `SVG 코드 보기` 오른쪽에 붙는 액션(예: SVG 만들기 버튼) */
  toolbarEnd,
}: {
  name: string;
  defaultValue?: string;
  /** 제어 모드: 상위(예: SVG 만들기)에서 값을 바꿀 때 사용 */
  value?: string;
  onValueChange?: (next: string) => void;
  rows?: number;
  previewVariant?: string;
  toolbarEnd?: ReactNode;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (controlledValue === undefined) setInternal(defaultValue);
  }, [defaultValue, controlledValue]);

  const val = controlledValue !== undefined ? controlledValue : internal;
  const setVal = (next: string) => {
    onValueChange?.(next);
    if (controlledValue === undefined) setInternal(next);
  };

  const safe = val.trim();

  return (
    <div className="y-admin-thumbnail-svg-grid">
      <div className="y-admin-thumbnail-svg-toolbar">
        <button type="button" className="y-admin-ghost-btn" onClick={() => setShowCode((v) => !v)}>
          {showCode ? "SVG 코드 접기" : "SVG 코드 보기"}
        </button>
        {toolbarEnd ? <span className="y-admin-thumbnail-svg-toolbar-end">{toolbarEnd}</span> : null}
      </div>
      <label className="y-admin-field-stack y-admin-thumbnail-svg-field-input">
        <span className="y-admin-stack-legend">썸네일 SVG</span>
        {showCode ? (
          <textarea
            name={name}
            className="y-admin-code"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            rows={rows}
            placeholder="파일 내용 전체(&lt;svg xmlns=…&gt;…&lt;/svg&gt;) 붙여넣기 · 레포: public/product-thumbnails/"
          />
        ) : (
          <input type="hidden" name={name} value={val} readOnly />
        )}
        {!showCode ? (
          <span className="y-admin-muted" style={{ fontSize: 11 }}>
            코드는 숨겨 두었습니다. 미리보기만 표시됩니다.
          </span>
        ) : null}
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
