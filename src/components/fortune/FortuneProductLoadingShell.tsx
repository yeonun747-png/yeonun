"use client";

import Link from "next/link";

/** 캐시/API 대기 중 점사 플로우 골격 — 전체 스켈레톤 대신 헤더만 */
export function FortuneProductLoadingShell({
  backHref = "/content",
  title,
}: {
  backHref?: string;
  title?: string;
}) {
  return (
    <div className="y-fortune-v2-root" data-step={0} data-fortune-loading="1">
      <header className="y-fortune-v2-header">
        <Link href={backHref} className="y-fortune-v2-back" aria-label="뒤로" prefetch={false}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18 L9 12 L15 6" />
          </svg>
        </Link>
        <div className="y-fortune-v2-header-title">
          <h1 className={title?.trim() ? undefined : "y-fortune-product-loading-title"}>
            {title?.trim() || "\u00a0"}
          </h1>
          <p className="y-fortune-product-loading-sub" aria-hidden="true" />
        </div>
        <span className="y-fortune-v2-header-link" aria-hidden="true" />
      </header>
      <main className="y-fortune-v2-stage y-fortune-v2-stage--forward is-ready">
        <p className="y-fortune-product-loading-msg" role="status">
          풀이를 불러오고 있어요…
        </p>
      </main>
    </div>
  );
}
