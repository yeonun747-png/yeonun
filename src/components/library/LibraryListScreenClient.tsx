"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LIBRARY_CHARACTER_FILTER_ORDER } from "@/lib/library-character-filters";
import type { LibraryListItemVm } from "@/lib/library-list-vm";

import { LibraryListSheet } from "./LibraryListSheet";

type FilterKey = "all" | "yeon" | "byeol" | "yeo" | "un";

function kickerClass(characterKey: LibraryListItemVm["characterKey"]): string {
  if (characterKey === "yeon") return "y-lib-mock-kicker--yeon";
  if (characterKey === "byeol") return "y-lib-mock-kicker--byeol";
  if (characterKey === "yeo") return "y-lib-mock-kicker--yeo";
  if (characterKey === "un") return "y-lib-mock-kicker--un";
  return "y-lib-mock-kicker--neutral";
}

export function LibraryListScreenClient({ backHref = "/my" }: { backHref?: string }) {
  const [items, setItems] = useState<LibraryListItemVm[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      void (async () => {
        try {
          const r = await fetch("/api/my/fortune-library-list", { method: "GET", cache: "no-store" });
          const j = (await r.json()) as
            | { ok: true; items: LibraryListItemVm[] }
            | { ok: false; error?: string };
          if (cancelled) return;
          if (!j.ok) {
            setLoadError(typeof j.error === "string" ? j.error : "목록을 불러오지 못했습니다.");
            setItems([]);
            setLoaded(true);
            return;
          }
          setLoadError(null);
          setItems(Array.isArray(j.items) ? j.items : []);
        } catch {
          if (!cancelled) setLoadError("목록을 불러오지 못했습니다.");
        } finally {
          if (!cancelled) setLoaded(true);
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.characterKey === filter);
  }, [items, filter]);

  return (
    <LibraryListSheet backHref={backHref}>
      <div className="y-lib-mock-wrap">
        {loadError ? (
          <p className="y-lib-error y-lib-error--sheet" role="alert">
            {loadError}
          </p>
        ) : null}

        {!loadError ? (
          <>
            <div className="y-lib-filter-row" role="tablist" aria-label="캐릭터 필터">
              <button
                type="button"
                role="tab"
                aria-selected={filter === "all"}
                className={`y-lib-filter-pill${filter === "all" ? " y-lib-filter-pill--active" : ""}`}
                onClick={() => setFilter("all")}
              >
                전체
              </button>
              {LIBRARY_CHARACTER_FILTER_ORDER.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  className={`y-lib-filter-pill${filter === key ? " y-lib-filter-pill--active" : ""}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="y-lib-mock-policy">구매한 풀이는 60일간 보관됩니다.</p>
          </>
        ) : null}

        {loaded && !loadError && items.length === 0 ? (
          <div className="y-lib-empty y-lib-empty--sheet">
            <p className="y-lib-empty-desc">아직 저장된 풀이가 없습니다.</p>
            <Link className="y-lib-empty-cta" href="/content">
              풀이 둘러보기 →
            </Link>
          </div>
        ) : null}

        {loaded && !loadError && items.length > 0 && filtered.length === 0 ? (
          <p className="y-lib-mock-empty-filter">이 인연의 저장 풀이가 없습니다.</p>
        ) : null}

        {loaded && !loadError && filtered.length > 0 ? (
          <ul className="y-lib-mock-list" aria-label="저장된 풀이 목록">
            {filtered.map((item) => (
              <li key={item.requestId}>
                <Link className="y-lib-mock-card" href={`/library/${item.requestId}`}>
                  <div className="y-lib-mock-card-body">
                    <span className={`y-lib-mock-kicker ${kickerClass(item.characterKey)}`}>{item.productLine}</span>
                    <span className="y-lib-mock-title">{item.title}</span>
                    <span className="y-lib-mock-meta">
                      {item.dateYmd} {item.visibleChars.toLocaleString("ko-KR")}자
                    </span>
                  </div>
                  {item.badge.kind === "expired" ? (
                    <span className="y-lib-mock-badge y-lib-mock-badge--expired">만료</span>
                  ) : (
                    <span className="y-lib-mock-badge">D-{item.badge.left}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {!loadError ? (
          <p className="y-lib-mock-foot">열람 기간·환불은 상품별 안내를 따릅니다.</p>
        ) : null}
      </div>
    </LibraryListSheet>
  );
}
