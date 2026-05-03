"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export function RoutePrefetcher({ routes }: { routes: string[] }) {
  const router = useRouter();
  const uniqueRoutes = useMemo(() => [...new Set(routes.filter(Boolean))], [routes]);
  const key = uniqueRoutes.join("|");

  useEffect(() => {
    if (!uniqueRoutes.length) return;

    const run = () => {
      for (const route of uniqueRoutes) router.prefetch(route);
    };

    const idleWindow = window as IdleWindow;
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(run, { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(run, 250);
    return () => window.clearTimeout(id);
  }, [key, router, uniqueRoutes]);

  return null;
}
