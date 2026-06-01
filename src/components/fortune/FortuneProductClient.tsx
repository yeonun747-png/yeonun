"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useState, type ReactNode } from "react";

import { FortuneProductLoadingShell } from "@/components/fortune/FortuneProductLoadingShell";
import {
  preloadFortuneProduct,
  readFortuneProductCache,
  type FortuneProductBundle,
} from "@/lib/fortune-product-cache";
import { registerFortunePrefetchSajuInvalidation } from "@/lib/fortune-prefetch-invalidation";

/** Three.js/WebGL — SSR 시 서버 500 방지 */
const FortunePage = dynamic(
  () => import("@/components/fortune/FortunePage").then((m) => m.FortunePage),
  { ssr: false },
);

class FortuneFlowErrorBoundary extends Component<
  { children: ReactNode; backHref: string; title?: string; onRetry: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <FortuneLoadErrorPanel
          backHref={this.props.backHref}
          title={this.props.title}
          onRetry={() => {
            this.setState({ hasError: false });
            this.props.onRetry();
          }}
        />
      );
    }
    return this.props.children;
  }
}

function FortuneLoadErrorPanel({
  backHref,
  title,
  onRetry,
}: {
  backHref: string;
  title?: string;
  onRetry: () => void;
}) {
  return (
    <div className="y-fortune-v2-root" data-fortune-load-error="1">
      <header className="y-fortune-v2-header">
        <Link href={backHref} className="y-fortune-v2-back" aria-label="뒤로" prefetch={false}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18 L9 12 L15 6" />
          </svg>
        </Link>
        <div className="y-fortune-v2-header-title">
          <h1>{title?.trim() || "점사"}</h1>
        </div>
        <span className="y-fortune-v2-header-link" aria-hidden="true" />
      </header>
      <main className="y-fortune-v2-stage y-fortune-v2-stage--forward is-ready">
        <p className="y-fortune-product-loading-msg" role="alert">
          풀이 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <button type="button" className="y-fortune-product-retry-btn" onClick={onRetry}>
          다시 시도
        </button>
      </main>
    </div>
  );
}

export function FortuneProductClient({
  slug,
  themeKey,
  backRaw,
  menuCardEntry,
  loadingTitle,
}: {
  slug: string;
  themeKey: string;
  backRaw?: string;
  menuCardEntry: boolean;
  /** SSR 메타용 제목 — 로딩 셸에만 표시 */
  loadingTitle?: string;
}) {
  const [bundle, setBundle] = useState<FortuneProductBundle | null>(() => readFortuneProductCache(slug));
  const [loadError, setLoadError] = useState(false);
  const [flowKey, setFlowKey] = useState(0);

  useEffect(() => {
    void import("@/components/fortune/FortunePage");
    return registerFortunePrefetchSajuInvalidation();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);

    const cached = readFortuneProductCache(slug);
    if (cached) setBundle(cached);

    void preloadFortuneProduct(slug, { force: !cached }).then((next) => {
      if (cancelled) return;
      if (!next) {
        setLoadError(true);
        return;
      }
      setBundle(next);
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const backHref = backRaw?.trim() || "/content";

  const retryLoad = () => {
    setLoadError(false);
    void preloadFortuneProduct(slug, { force: true }).then((next) => {
      if (next) setBundle(next);
      else setLoadError(true);
    });
  };

  const retryFlow = () => {
    setFlowKey((k) => k + 1);
    retryLoad();
  };

  if (loadError && !bundle) {
    return <FortuneLoadErrorPanel backHref={backHref} title={loadingTitle} onRetry={retryLoad} />;
  }

  if (!bundle) {
    return <FortuneProductLoadingShell backHref={backHref} title={loadingTitle} />;
  }

  return (
    <FortuneFlowErrorBoundary backHref={backHref} title={loadingTitle} onRetry={retryFlow}>
      <FortunePage
        key={flowKey}
        product={bundle.product}
        character={bundle.character}
        themeKey={themeKey}
        backRaw={backRaw}
        menuCardEntry={menuCardEntry}
      />
    </FortuneFlowErrorBoundary>
  );
}
