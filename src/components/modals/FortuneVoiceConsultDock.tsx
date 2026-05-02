"use client";

/**
 * 점사 완료 하단 음성 상담 CTA — 보관함 재생과 동일 마크업·클래스만 쓰도록 단일 소스.
 */
export function FortuneVoiceConsultDock(props: {
  hasTocFabClear: boolean;
  busy: boolean;
  busyLabel?: string;
  ctaLabel: string;
  onContinue: () => void;
  /** 예: 보관함 body 포털 레이어용 z-index·수식 클래스 */
  className?: string;
}) {
  const { hasTocFabClear, busy, busyLabel = "요약 준비 중…", ctaLabel, onContinue, className } = props;
  const dockCls = `y-fs-actions y-fs-actions--dock${hasTocFabClear ? " y-fs-actions--fab-clear" : ""}${className ? ` ${className}` : ""}`;

  return (
    <div className={dockCls}>
      <button type="button" className="y-fs-act-consult" onClick={() => void onContinue()} disabled={busy}>
        <span className="y-fs-act-consult-in">{busy ? busyLabel : ctaLabel}</span>
      </button>
    </div>
  );
}
