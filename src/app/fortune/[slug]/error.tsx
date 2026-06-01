"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function FortuneProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[fortune]", error);
  }, [error]);

  return (
    <div className="y-fortune-v2-root" data-fortune-route-error="1">
      <header className="y-fortune-v2-header">
        <Link href="/content" className="y-fortune-v2-back" aria-label="뒤로" prefetch={false}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18 L9 12 L15 6" />
          </svg>
        </Link>
        <div className="y-fortune-v2-header-title">
          <h1>점사</h1>
        </div>
        <span className="y-fortune-v2-header-link" aria-hidden="true" />
      </header>
      <main className="y-fortune-v2-stage y-fortune-v2-stage--forward is-ready">
        <p className="y-fortune-product-loading-msg" role="alert">
          페이지를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.
        </p>
        <button type="button" className="y-fortune-product-retry-btn" onClick={() => reset()}>
          다시 시도
        </button>
        <button
          type="button"
          className="y-fortune-product-retry-btn"
          style={{ marginTop: 8 }}
          onClick={() => window.location.reload()}
        >
          새로고침
        </button>
      </main>
    </div>
  );
}
