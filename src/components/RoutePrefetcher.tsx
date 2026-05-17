"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

const MY_SHEET_PRIORITY = new Set(["/content", "/my", "/history/chats", "/reviews"]);

function isEagerSheetRoute(route: string) {
  return route.startsWith("/characters/") && route.includes("sheet=1");
}

export function RoutePrefetcher({ routes }: { routes: string[] }) {
  const router = useRouter();
  const uniqueRoutes = useMemo(() => [...new Set(routes.filter(Boolean))], [routes]);
  const key = uniqueRoutes.join("|");

  useEffect(() => {
    if (!uniqueRoutes.length) return;

    const priority = uniqueRoutes.filter((r) => MY_SHEET_PRIORITY.has(r) || isEagerSheetRoute(r));
    const rest = uniqueRoutes.filter((r) => !MY_SHEET_PRIORITY.has(r) && !isEagerSheetRoute(r));

    const prefetch = (list: string[]) => {
      for (const route of list) router.prefetch(route);
    };

    /** 마이 보관함 등: 첫 페인트 직후 바로 프리페치( idle 전 클릭 대비 ) */
    if (priority.length) prefetch(priority);

    const runRest = () => prefetch(rest);

    const idleWindow = window as IdleWindow;
    if (rest.length && idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(runRest, { timeout: 900 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    if (rest.length) {
      const id = window.setTimeout(runRest, 120);
      return () => window.clearTimeout(id);
    }

    return undefined;
  }, [key, router, uniqueRoutes]);

  return null;
}
