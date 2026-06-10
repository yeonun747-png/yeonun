"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import type { MyFortuneListSnapshot } from "@/hooks/useMyShelfListsPreload";
import { LIBRARY_CHARACTER_FILTER_ORDER } from "@/lib/library-character-filters";
import type { LibraryListItemVm } from "@/lib/library-list-vm";
import { fortuneSnapshotWithCache } from "@/lib/my-shelf-lists-cache";

import { ArchiveReviewAction, toCharacterReviewKey } from "@/components/reviews/ArchiveReviewAction";
import { LibraryListSheet } from "./LibraryListSheet";

type FilterKey = "all" | "yeon" | "byeol" | "yeo" | "un";

function kickerClass(characterKey: LibraryListItemVm["characterKey"]): string {
  if (characterKey === "yeon") return "y-lib-mock-kicker--yeon";
  if (characterKey === "byeol") return "y-lib-mock-kicker--byeol";
  if (characterKey === "yeo") return "y-lib-mock-kicker--yeo";
  if (characterKey === "un") return "y-lib-mock-kicker--un";
  return "y-lib-mock-kicker--neutral";
}

function FortuneListSkeleton() {
  return (
    <div className="y-my-shelf-skel" aria-hidden>
      <div className="y-my-shelf-skel-pills">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="y-my-shelf-skel-pill" />
        ))}
      </div>
      <div className="y-my-shelf-skel-line y-my-shelf-skel-line--short" />
      <ul className="y-my-shelf-skel-cards">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="y-my-shelf-skel-card" />
        ))}
      </ul>
    </div>
  );
}

export function LibraryListScreenClient({
  backHref = "/my",
  fortuneSnapshot,
}: {
  backHref?: string;
  fortuneSnapshot: MyFortuneListSnapshot;
}) {
  const { user } = useYeonunAuth();
  const userId = user?.id ?? "";
  const initial = fortuneSnapshotWithCache(fortuneSnapshot, userId);
  const [items, setItems] = useState<LibraryListItemVm[]>(() => initial.items);
  const [loadError, setLoadError] = useState<string | null>(() => initial.loadError);
  const [loaded, setLoaded] = useState(() => initial.settled);

  useEffect(() => {
    const next = fortuneSnapshotWithCache(fortuneSnapshot, userId);
    setItems(next.items);
    setLoadError(next.loadError);
    setLoaded(next.settled);
  }, [fortuneSnapshot, userId]);

  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.characterKey === filter);
  }, [items, filter]);

  const showSkeleton = !loadError && !loaded;

  return (
    <LibraryListSheet backHref={backHref}>
      <div className="y-lib-mock-wrap">
        {loadError ? (
          <p className="y-lib-error y-lib-error--sheet" role="alert">
            {loadError}
          </p>
        ) : null}

        {showSkeleton ? <FortuneListSkeleton /> : null}

        {!loadError && loaded ? (
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
            <p className="y-lib-mock-policy">구매한 풀이는 상품별 기간 동안 보관됩니다. (KST 자정 기준)</p>
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
                      <span className="y-lib-mock-meta-datetime">
                        <span>{item.dateYmd}</span>
                        {item.timeLabel ? <span className="y-lib-mock-meta-time">{item.timeLabel}</span> : null}
                      </span>
                      <span className="y-lib-mock-meta-chars">{item.visibleChars.toLocaleString("ko-KR")}자</span>
                    </span>
                  </div>
                  <div className="y-archive-card-side">
                    {item.badge.kind === "expired" ? (
                      <span className="y-lib-mock-badge y-lib-mock-badge--expired">만료</span>
                    ) : (
                      <span className="y-lib-mock-badge">D-{item.badge.left}</span>
                    )}
                    <ArchiveReviewAction
                      target={{
                        sourceType: "fortune",
                        sourceId: item.requestId,
                        productSlug: item.productSlug || "saju-classic",
                        characterKey: toCharacterReviewKey(item.characterKey),
                        productLine: item.productLine,
                        title: item.title,
                        subline: item.timeLabel ? `${item.dateYmd} · ${item.timeLabel}` : item.dateYmd,
                      }}
                    />
                  </div>
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
