"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { rememberSheetBackdropScrollY } from "@/components/my/MySheetBackdropFrame";
import { SheetLink } from "@/components/SheetLink";
import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";

type SearchUiState = "idle" | "typing" | "results" | "empty";

type ProductApiItem = {
  slug: string;
  title: string;
  quote: string;
  category_slug: string;
  price_krw: number;
  character_key: string;
  tags: string[];
  created_at: string;
};

type SearchProduct = {
  slug: string;
  title: string;
  quote: string;
  categorySlug: string;
  priceKrw: number;
  characterKey: string;
  characterName: string;
  emoji: string;
  characterBg: string;
  tags: string[];
  createdAt: string;
};

const SEARCH_RECENT_STORAGE_KEY = "yeonun_search_recent_v1";
const OVERLAY_TRANSITION_MS = 320;
const SEARCH_DEBOUNCE_MS = 300;

const CHARACTER_META: Record<
  string,
  { name: string; emoji: string; bg: string; cta: string }
> = {
  yeon: { name: "연화", emoji: "🌸", bg: "var(--y-yeon-bg)", cta: "연화에게 물어보기 🌸" },
  byeol: { name: "별하", emoji: "✨", bg: "var(--y-byeol-bg)", cta: "별하에게 물어보기 ✨" },
  yeo: { name: "여연", emoji: "🌿", bg: "var(--y-yeo-bg)", cta: "여연에게 물어보기 🌿" },
  un: { name: "운서", emoji: "🌙", bg: "var(--y-un-bg)", cta: "운서에게 물어보기 🌙" },
};

const POPULAR_TAGS = [
  { label: "#재회", query: "재회" },
  { label: "#올해운세", query: "올해 운세" },
  { label: "#작명", query: "작명" },
  { label: "#사주궁합", query: "사주 궁합" },
  { label: "#재물운", query: "재물운" },
  { label: "#자미두수", query: "자미두수" },
  { label: "#이직", query: "이직" },
  { label: "#길일", query: "길일" },
] as const;

const SUGGESTED_QUERIES = [
  "그 사람 마음이 궁금해요",
  "이직해도 될까요",
  "올해 재물운 어때요",
  "아이 이름 지으려고요",
  "어젯밤 꿈이 이상해요",
] as const;

const AUTOCOMPLETE_KEYWORDS = [
  "궁합",
  "궁합 잘 맞는 상대",
  "궁합 결혼",
  "사주",
  "사주풀이",
  "사주 재물운",
  "재회",
  "재회 가능성",
  "재회 타이밍",
  "이직",
  "이직 시기",
  "이직 사주",
  "올해 운세",
  "올해 재물운",
  "올해 사랑운",
  "신년운세",
  "토정비결",
  "자미두수",
  "작명",
  "아이 이름",
  "길일",
  "꿈 해몽",
  "꿈 풀이",
  "배우자",
  "결혼운",
  "결혼 시기",
] as const;

const SEARCH_TAG_ALIASES: Record<string, string[]> = {
  "dream-lastnight": ["꿈", "해몽", "꿈해석", "잠", "몽"],
  "tojeong-2026": ["토정비결", "신년", "2026", "올해", "연간", "한해"],
  "mind-now": ["마음", "생각", "상대방", "연락", "그사람", "좋아하는"],
  "calendar-2026": ["길일", "흉일", "날짜", "달력", "이사날", "결혼날"],
  "reunion-maybe": ["재회", "다시만남", "이별", "전남친", "전여친", "헤어짐"],
  "newyear-2026": ["신년운세", "올해운세", "2026", "연간", "1년"],
  "child-saju": ["자녀", "아이", "부모", "육아", "자식", "아들", "딸"],
  "taekil-goodday": ["길일", "택일", "결혼날", "이사날", "개업", "날받기"],
  "career-timing": ["이직", "승진", "커리어", "직장", "취업", "퇴직", "창업"],
  "future-spouse": ["배우자", "결혼", "이상형", "남편운", "아내운", "결혼운"],
  "saju-classic": ["사주", "사주풀이", "종합", "명식", "정통", "운명"],
  "compat-howfar": ["궁합", "연애", "커플", "남자친구", "여자친구", "사랑", "결혼"],
  "wealth-graph": ["재물", "돈", "재물운", "부자", "투자", "재산", "부의그래프"],
  "zimi-2026-flow": ["자미두수", "별", "2026", "자미", "흐름"],
  "zimi-chart": ["자미두수", "명반", "12궁위", "별자리", "자미"],
  "naming-baby": ["작명", "이름", "태명", "아기이름", "이름짓기", "작명소"],
  "lifetime-master": ["평생사주", "통합", "초년", "중년", "말년", "인생", "전체"],
};

/** 추천 검색어 → 우선 노출 상품 (정규화 키, 공백·# 제거) */
const SEARCH_QUERY_PRIMARY_SLUG: Record<string, string> = {
  "이직해도될까요": "career-timing",
  "그사람마음이궁금해요": "mind-now",
  "올해재물운어때요": "wealth-graph",
  "아이이름지으려고요": "naming-baby",
  "어젯밤꿈이이상해요": "dream-lastnight",
};

let cachedSearchProducts: SearchProduct[] | null = null;
let cachedSearchProductsPromise: Promise<SearchProduct[]> | null = null;

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function productSearchTerms(product: SearchProduct): string[] {
  const tagTerms = product.tags.map((tag) => normalizeSearchText(tag));
  const aliasTerms = (SEARCH_TAG_ALIASES[product.slug] ?? []).map((a) => normalizeSearchText(a));
  return [...tagTerms, ...aliasTerms].filter((t) => t.length >= 2);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRecentSearches(list: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return list;
  return [trimmed, ...list.filter((item) => item !== trimmed)].slice(0, 5);
}

function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item).trim()).filter(Boolean).slice(0, 5);
  } catch {
    return [];
  }
}

function writeRecentSearches(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEARCH_RECENT_STORAGE_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    // ignore storage failures
  }
}

function formatPrice(priceKrw: number): string {
  return `${priceKrw.toLocaleString("ko-KR")}원`;
}

function currentPathWithSearch(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

function toSearchProduct(product: ProductApiItem): SearchProduct {
  const meta = CHARACTER_META[product.character_key] ?? {
    name: product.character_key,
    emoji: "✨",
    bg: "var(--y-card-2)",
    cta: `${product.character_key}에게 물어보기`,
  };
  const mergedTags = Array.from(new Set([...(product.tags ?? []), ...(SEARCH_TAG_ALIASES[product.slug] ?? [])]));
  return {
    slug: product.slug,
    title: product.title,
    quote: product.quote,
    categorySlug: product.category_slug,
    priceKrw: Number(product.price_krw ?? 0),
    characterKey: product.character_key,
    characterName: meta.name,
    emoji: meta.emoji,
    characterBg: meta.bg,
    tags: mergedTags,
    createdAt: product.created_at,
  };
}

async function loadSearchProducts(): Promise<SearchProduct[]> {
  if (cachedSearchProducts) return cachedSearchProducts;
  if (cachedSearchProductsPromise) return cachedSearchProductsPromise;

  cachedSearchProductsPromise = fetch("/api/products", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("검색 데이터를 불러오지 못했습니다.");
      const payload = (await response.json()) as { data?: ProductApiItem[] };
      const products = Array.isArray(payload.data) ? payload.data.map(toSearchProduct) : [];
      cachedSearchProducts = products;
      return products;
    })
    .finally(() => {
      cachedSearchProductsPromise = null;
    });

  return cachedSearchProductsPromise;
}

function scoreSearchProduct(product: SearchProduct, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const primarySlug = SEARCH_QUERY_PRIMARY_SLUG[normalizedQuery];
  if (primarySlug && product.slug === primarySlug) return 10_000;

  const title = normalizeSearchText(product.title);
  const slug = normalizeSearchText(product.slug);
  const quote = normalizeSearchText(product.quote);
  const character = normalizeSearchText(product.characterName);
  const category = normalizeSearchText(product.categorySlug);
  const tags = product.tags.map((tag) => normalizeSearchText(tag));
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => normalizeSearchText(token))
    .filter(Boolean);

  let score = 0;

  if (title === normalizedQuery) score += 1000;
  if (title.startsWith(normalizedQuery)) score += 420;
  if (title.includes(normalizedQuery)) score += 260;
  if (slug === normalizedQuery) score += 220;
  if (slug.includes(normalizedQuery)) score += 120;
  if (character === normalizedQuery) score += 180;
  if (character.includes(normalizedQuery)) score += 120;
  if (category.includes(normalizedQuery)) score += 80;
  if (quote.includes(normalizedQuery)) score += 70;

  for (const tag of tags) {
    if (tag === normalizedQuery) score += 260;
    else if (tag.includes(normalizedQuery)) score += 140;
  }

  /** 문장형 검색 — "이직해도 될까요" → alias "이직" 포함 시 매칭 */
  for (const term of productSearchTerms(product)) {
    if (normalizedQuery.includes(term)) {
      score += term.length >= 4 ? 340 : 260;
    }
  }

  for (const token of tokens) {
    if (!token) continue;
    if (title.includes(token)) score += 35;
    if (slug.includes(token)) score += 18;
    if (character.includes(token)) score += 18;
    if (category.includes(token)) score += 10;
    if (quote.includes(token)) score += 8;
    for (const tag of tags) {
      if (tag.includes(token)) score += 16;
    }
    for (const term of productSearchTerms(product)) {
      if (token.includes(term) || term.includes(token)) score += 24;
    }
  }

  return score;
}

function rankProducts(products: SearchProduct[], query: string): SearchProduct[] {
  return [...products]
    .map((product) => ({ product, score: scoreSearchProduct(product, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.product.createdAt).getTime() - new Date(a.product.createdAt).getTime();
    })
    .map((entry) => entry.product);
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const safe = escapeRegExp(query.trim());
  if (!safe) return text;
  const regex = new RegExp(`(${safe})`, "gi");
  const normalizedQuery = query.trim().toLowerCase();
  return text.split(regex).map((part, index) =>
    part.toLowerCase() === normalizedQuery ? (
      <span key={`${part}-${index}`} className="y-search-ac-highlight">
        {part}
      </span>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    ),
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

function SearchOverlayDialog({
  active,
  onRequestClose,
  onDismissImmediately,
  markExternalNavigate,
}: {
  active: boolean;
  onRequestClose: () => void;
  /** 프로필 시트 등 외부 이동 — 닫힘 애니 중 클릭 가로채기 방지용 즉시 언마운트 */
  onDismissImmediately?: () => void;
  /** /search 단독 페이지: 닫기 후 router.back() 억제(프로필 시트 등 외부 이동) */
  markExternalNavigate?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [products, setProducts] = useState<SearchProduct[]>(() => cachedSearchProducts ?? []);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(() => !cachedSearchProducts);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const [inputValue, setInputValue] = useState("");
  const [uiState, setUiState] = useState<SearchUiState>("idle");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [currentHref] = useState(() => currentPathWithSearch());
  const debouncedInput = useDebouncedValue(inputValue.trim(), SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    let cancelled = false;
    if (cachedSearchProducts) return undefined;
    void loadSearchProducts()
      .then((nextProducts) => {
        if (cancelled) return;
        setProducts(nextProducts);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingProducts(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), OVERLAY_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onRequestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onRequestClose]);

  const autocompleteKeywords = useMemo(() => {
    if (!debouncedInput) return [];
    const normalizedQuery = normalizeSearchText(debouncedInput);
    const dynamicKeywords = products.flatMap((product) => [
      product.title,
      product.characterName,
      ...product.tags,
    ]);
    return Array.from(new Set([...AUTOCOMPLETE_KEYWORDS, ...dynamicKeywords]))
      .filter((keyword) => normalizeSearchText(keyword).includes(normalizedQuery))
      .slice(0, 5);
  }, [debouncedInput, products]);

  const previewProducts = useMemo(() => {
    if (!debouncedInput) return [];
    return rankProducts(products, debouncedInput).slice(0, 3);
  }, [debouncedInput, products]);

  const resultProducts = useMemo(() => {
    if (!submittedQuery) return [];
    return rankProducts(products, submittedQuery);
  }, [products, submittedQuery]);

  const topCharacter = resultProducts.length
    ? CHARACTER_META[resultProducts[0].characterKey] ?? null
    : null;

  const saveRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const next = buildRecentSearches(prev, query);
      writeRecentSearches(next);
      return next;
    });
  }, []);

  const executeSearch = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      if (!query) return;

      let nextProducts = products;
      if (!nextProducts.length) {
        setLoadingProducts(true);
        nextProducts = await loadSearchProducts();
        setProducts(nextProducts);
        setLoadingProducts(false);
      }

      saveRecentSearch(query);
      setInputValue(query);
      setSubmittedQuery(query);

      const ranked = rankProducts(nextProducts, query);
      setUiState(ranked.length ? "results" : "empty");
      inputRef.current?.blur();
    },
    [products, saveRecentSearch],
  );

  const clearInput = useCallback(() => {
    setInputValue("");
    setSubmittedQuery("");
    setUiState("idle");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const removeRecent = useCallback((keyword: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((item) => item !== keyword);
      writeRecentSearches(next);
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentSearches([]);
    writeRecentSearches([]);
  }, []);

  const productDetailHref = useCallback(
    (slug: string) => `/content/${slug}?sheet=1&back=${encodeURIComponent(currentHref)}`,
    [currentHref],
  );

  /** 검색 즉시 닫고 프로필 바텀시트로 이동 (오버레이가 시트 클릭을 가로채지 않도록) */
  const navigateAfterSearchClose = useCallback(
    (href: string) => {
      markExternalNavigate?.();
      if (onDismissImmediately) {
        flushSync(() => {
          onDismissImmediately();
        });
      } else {
        onRequestClose();
      }
      rememberSheetBackdropScrollY();
      router.push(href);
    },
    [markExternalNavigate, onDismissImmediately, onRequestClose, router],
  );

  const characterProfileHref = useCallback(
    (characterKey: string) => `/characters/${characterKey}?sheet=1&from=home`,
    [],
  );

  return (
    <div className={`y-search-overlay ${active ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="검색">
      <div className="y-search-header">
        <button className="y-search-back" type="button" onClick={onRequestClose} aria-label="뒤로">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <form
          className="y-search-input-wrap"
          onSubmit={(event) => {
            event.preventDefault();
            void executeSearch(inputValue);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="y-search-input"
            placeholder="어떤 고민이 있으신가요?"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={inputValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              const trimmed = nextValue.trim();
              setInputValue(nextValue);
              if (!trimmed) {
                setSubmittedQuery("");
                setUiState("idle");
                return;
              }
              if (trimmed !== submittedQuery) setUiState("typing");
            }}
          />
          {inputValue.trim() ? (
            <button className="y-search-clear visible" type="button" onClick={clearInput} aria-label="지우기">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </form>
      </div>

      <div className="y-search-body">
        {uiState === "idle" ? (
          <>
            {recentSearches.length ? (
              <div className="y-search-section" id="searchRecentSection">
                <div className="y-search-section-title">최근 검색어</div>
                <div className="y-search-recent-list">
                  {recentSearches.map((keyword) => (
                    <div key={keyword} className="y-search-recent-item">
                      <button
                        type="button"
                        className="y-search-recent-keyword"
                        onClick={() => {
                          void executeSearch(keyword);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <circle cx="11" cy="11" r="7" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        {keyword}
                      </button>
                      <button
                        type="button"
                        className="y-search-recent-del"
                        onClick={() => removeRecent(keyword)}
                        aria-label={`${keyword} 삭제`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="y-search-clear-all" onClick={clearRecent}>
                  전체 삭제
                </button>
              </div>
            ) : null}

            <div className="y-search-section">
              <div className="y-search-section-title">지금 많이 찾는</div>
              <div className="y-search-tags">
                {POPULAR_TAGS.map((tag) => (
                  <button
                    key={tag.label}
                    type="button"
                    className="y-search-tag"
                    onClick={() => {
                      void executeSearch(tag.query);
                    }}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="y-search-section">
              <div className="y-search-section-title">이런 고민도 찾아보세요</div>
              <div className="y-search-suggest-list">
                {SUGGESTED_QUERIES.map((query) => (
                  <button
                    key={query}
                    type="button"
                    className="y-search-suggest-item"
                    onClick={() => {
                      void executeSearch(query);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
                    </svg>
                    {query}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {uiState === "typing" ? (
          <>
            <div className="y-search-autocomplete">
              {autocompleteKeywords.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  className="y-search-ac-item"
                  onClick={() => {
                    void executeSearch(keyword);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>{highlightMatch(keyword, debouncedInput || inputValue)}</span>
                </button>
              ))}
            </div>

            {previewProducts.length ? (
              <div className="y-search-ac-products">
                <div className="y-search-ac-product-label">관련 상품</div>
                {previewProducts.map((product) => (
                  <button
                    key={product.slug}
                    type="button"
                    className="y-search-ac-product"
                    onClick={() => {
                      void executeSearch(product.title);
                    }}
                  >
                    <div className="y-search-ac-product-name">{product.title}</div>
                    <div className="y-search-ac-product-meta">
                      {product.characterName} · {formatPrice(product.priceKrw)}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {Boolean(debouncedInput) && !loadingProducts && !autocompleteKeywords.length && !previewProducts.length ? (
              <div className="y-search-typing-empty">자동완성 결과가 없어요. Enter로 바로 검색해 보세요.</div>
            ) : null}
          </>
        ) : null}

        {uiState === "results" ? (
          <>
            <div className="y-search-result-count" aria-live="polite">
              {submittedQuery ? `"${submittedQuery}" 검색 결과 ${resultProducts.length}개` : `검색 결과 ${resultProducts.length}개`}
            </div>
            <div className="y-search-result-list">
              {resultProducts.map((product) => (
                <div key={product.slug} className="y-search-result-item-wrap">
                  <SheetLink className="y-search-result-card" href={productDetailHref(product.slug)} scroll={false}>
                    <div className="y-search-result-icon" style={{ background: product.characterBg }}>
                      {product.emoji}
                    </div>
                    <div className="y-search-result-info">
                      <div className="y-search-result-name">{product.title}</div>
                      <div className="y-search-result-char">{product.characterName} 선생님</div>
                      <p className="y-search-result-desc">{product.quote}</p>
                    </div>
                    <div className="y-search-result-price">{formatPrice(product.priceKrw)}</div>
                  </SheetLink>
                  <div className="y-search-result-chips">
                    <button
                      type="button"
                      className={`y-search-char-chip ${product.characterKey}`}
                      onClick={() => navigateAfterSearchClose(characterProfileHref(product.characterKey))}
                    >
                      {product.characterName} 프로필 보기
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {topCharacter ? (
              <button
                type="button"
                className="y-search-connect"
                onClick={() =>
                  navigateAfterSearchClose(characterProfileHref(resultProducts[0].characterKey))
                }
              >
                <div>
                  <div className="y-search-connect-text">{topCharacter.name}에게 직접 물어보기</div>
                  <div className="y-search-connect-char">고민을 직접 말해보세요</div>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ) : null}
          </>
        ) : null}

        {uiState === "empty" ? (
          <div className="y-search-empty visible">
            <div className="y-search-empty-icon">🌙</div>
            <div className="y-search-empty-title">찾으시는 고민이 없으신가요?</div>
            <div className="y-search-empty-desc">
              다른 키워드로 검색하거나
              <br />
              안내자에게 직접 물어보세요
            </div>
            <div className="y-search-empty-btns y-search-empty-btns--grid">
              {Object.entries(CHARACTER_META).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  className="y-search-empty-btn"
                  onClick={() => navigateAfterSearchClose(characterProfileHref(key))}
                >
                  {meta.cta}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SearchOverlayTrigger() {
  const closeTimerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);

  const openOverlay = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (mounted) {
      setActive(true);
      return;
    }
    setMounted(true);
  }, [mounted]);

  const closeOverlay = useCallback(() => {
    setActive(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
    }, OVERLAY_TRANSITION_MS);
  }, []);

  const dismissImmediately = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActive(false);
    setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;
    const raf = window.requestAnimationFrame(() => setActive(true));
    return () => window.cancelAnimationFrame(raf);
  }, [mounted]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  return (
    <>
      <button className="yBtnIcon" type="button" aria-label="검색" onClick={openOverlay}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {mounted ? (
        <YeonunSheetPortal>
          <SearchOverlayDialog
            active={active}
            onRequestClose={closeOverlay}
            onDismissImmediately={dismissImmediately}
          />
        </YeonunSheetPortal>
      ) : null}
    </>
  );
}

export function SearchStandalonePage() {
  const router = useRouter();
  const closeTimerRef = useRef<number | null>(null);
  const suppressBackRef = useRef(false);
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setActive(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const markExternalNavigate = useCallback(() => {
    suppressBackRef.current = true;
  }, []);

  const closeOverlay = useCallback(() => {
    setActive(false);
    closeTimerRef.current = window.setTimeout(() => {
      if (suppressBackRef.current) {
        suppressBackRef.current = false;
        return;
      }
      if (window.history.length > 1) router.back();
      else router.push("/");
    }, OVERLAY_TRANSITION_MS);
  }, [router]);

  const dismissImmediately = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    suppressBackRef.current = true;
    setActive(false);
    setMounted(false);
  }, []);

  if (!mounted) return null;

  return (
    <SearchOverlayDialog
      active={active}
      onRequestClose={closeOverlay}
      onDismissImmediately={dismissImmediately}
      markExternalNavigate={markExternalNavigate}
    />
  );
}
