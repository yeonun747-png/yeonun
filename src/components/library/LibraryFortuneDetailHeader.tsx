"use client";

import Link from "next/link";

type Props = {
  title: string;
  backHref?: string;
};

/** 점사 보관함 상세 — 최상단 헤더(← 보관함 목록) */
export function LibraryFortuneDetailHeader({ title, backHref = "/my?shelf=fortune" }: Props) {
  return (
    <header className="y-modal-head y-lib-detail-head" aria-label="점사 보관함 상세">
      <Link href={backHref} className="y-modal-back" scroll={false} aria-label="보관함 목록으로">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </Link>
      <div className="y-modal-title y-lib-detail-head-title">{title}</div>
      <span className="y-lib-detail-head-spacer" aria-hidden="true" />
    </header>
  );
}
