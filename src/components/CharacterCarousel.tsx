"use client";

import { useEffect } from "react";

import { SheetLink } from "@/components/SheetLink";
import { useDragScroll } from "@/hooks/useDragScroll";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";
import { preloadContentCatalog } from "@/lib/content-catalog-cache";
import {
  CAROUSEL_CHAR,
  CAROUSEL_CHAR_KEYS,
  characterSheetHref,
  type CarouselCharKey,
} from "@/lib/characters/character-carousel-static";

function Motif({ k }: { k: CarouselCharKey }) {
  if (k === "yeon") {
    return (
      <div className="yCharMotif" aria-hidden="true">
        <svg viewBox="0 0 280 350" preserveAspectRatio="xMidYMid slice">
          <g transform="translate(80,90)" opacity="0.4">
            <ellipse cx="0" cy="0" rx="38" ry="14" fill="rgba(221, 88, 120, 0.22)" transform="rotate(-30)" />
            <ellipse cx="0" cy="0" rx="38" ry="14" fill="rgba(221, 88, 120, 0.18)" transform="rotate(30)" />
            <ellipse cx="0" cy="0" rx="38" ry="14" fill="rgba(221, 88, 120, 0.18)" transform="rotate(-90)" />
            <ellipse cx="0" cy="0" rx="38" ry="14" fill="rgba(221, 88, 120, 0.22)" transform="rotate(90)" />
            <ellipse cx="0" cy="0" rx="38" ry="14" fill="rgba(221, 88, 120, 0.2)" transform="rotate(0)" />
            <ellipse cx="0" cy="0" rx="38" ry="14" fill="rgba(221, 88, 120, 0.2)" transform="rotate(60)" />
            <ellipse cx="0" cy="0" rx="38" ry="14" fill="rgba(221, 88, 120, 0.22)" transform="rotate(120)" />
            <ellipse cx="0" cy="0" rx="38" ry="14" fill="rgba(221, 88, 120, 0.2)" transform="rotate(150)" />
            <circle cx="0" cy="0" r="10" fill="rgba(221, 88, 120, 0.42)" />
          </g>
        </svg>
      </div>
    );
  }

  if (k === "byeol") {
    return (
      <div className="yCharMotif" aria-hidden="true">
        <svg viewBox="0 0 280 350" preserveAspectRatio="xMidYMid slice">
          <circle cx="220" cy="100" r="42" fill="rgba(77, 61, 122, 0.16)" />
          <circle cx="218" cy="98" r="36" fill="rgba(224, 216, 238, 0.5)" />
          <g fill="rgba(77, 61, 122, 0.55)">
            <circle cx="80" cy="60" r="2" />
            <circle cx="140" cy="40" r="1.5" />
            <circle cx="180" cy="180" r="1.8" />
            <circle cx="50" cy="200" r="2" />
            <circle cx="240" cy="220" r="1.5" />
            <circle cx="120" cy="160" r="1.5" />
          </g>
          <path
            d="M 80 60 Q 110 100 140 40 T 180 180"
            stroke="rgba(77, 61, 122, 0.2)"
            strokeWidth="0.5"
            fill="none"
            strokeDasharray="2,3"
          />
        </svg>
      </div>
    );
  }

  if (k === "yeo") {
    return (
      <div className="yCharMotif" aria-hidden="true">
        <svg viewBox="0 0 280 350" preserveAspectRatio="xMidYMid slice">
          <path
            d="M 0 220 L 60 130 L 110 175 L 170 100 L 230 165 L 280 140 L 280 350 L 0 350 Z"
            fill="rgba(45, 84, 68, 0.15)"
          />
          <path
            d="M 0 250 L 80 180 L 140 220 L 200 160 L 280 200 L 280 350 L 0 350 Z"
            fill="rgba(45, 84, 68, 0.22)"
          />
          <circle
            cx="220"
            cy="80"
            r="22"
            fill="rgba(255,255,255,0.4)"
            stroke="rgba(45, 84, 68, 0.35)"
            strokeWidth="0.8"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="yCharMotif" aria-hidden="true">
      <svg viewBox="0 0 280 350" preserveAspectRatio="xMidYMid slice">
        <path
          d="M 30 100 Q 60 80 100 90 T 180 95 Q 220 85 250 100"
          stroke="rgba(42, 49, 66, 0.3)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M 50 130 Q 90 115 140 125 T 230 130"
          stroke="rgba(42, 49, 66, 0.22)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M 20 165 Q 80 150 130 160 T 250 165"
          stroke="rgba(42, 49, 66, 0.18)"
          strokeWidth="1"
          fill="none"
        />
        <g transform="translate(50,200) rotate(-25)">
          <rect x="0" y="0" width="60" height="3" fill="rgba(42, 49, 66, 0.4)" />
          <path d="M 60 -2 L 78 1.5 L 60 5 Z" fill="rgba(42, 49, 66, 0.55)" />
        </g>
      </svg>
    </div>
  );
}

function CardVisual({ k }: { k: CarouselCharKey }) {
  const c = CAROUSEL_CHAR[k];
  return (
    <>
      <div className="yCharVisual">
        <div className="yCharHanBg" aria-hidden="true">
          {c.han}
        </div>
        <Motif k={k} />
        <div className="yCharNameBlock">
          <span className="yCharSpecTag">{c.spec}</span>
          <div className="yCharName">{c.name}</div>
          <div className="yCharNameEn">{c.en}</div>
        </div>
      </div>
      <div className="yCharMeta">
        <p className="yCharQuote">{c.quote}</p>
        <div className="yCharTags">{c.tags}</div>
      </div>
    </>
  );
}

export function CharacterCarousel() {
  const prefetchRoutes = CAROUSEL_CHAR_KEYS.map((k) => characterSheetHref(k, "home"));
  const carouselRef = useDragScroll<HTMLDivElement>();

  useEffect(() => {
    void preloadContentCatalog();
  }, []);

  return (
    <section aria-label="오늘의 인연 안내자">
      <RoutePrefetcher routes={prefetchRoutes} />

      <div className="ySectionHead">
        <h2 className="ySectionTitle">
          <span className="hash">#</span> 오늘의 인연 안내자
        </h2>
      </div>

      <div className="yCarousel" ref={carouselRef}>
        <div className="yCarouselTrack">
          {CAROUSEL_CHAR_KEYS.map((k) => (
            <SheetLink
              key={k}
              href={characterSheetHref(k, "home")}
              className={`yCharCard ${k}`}
              aria-label={`${CAROUSEL_CHAR[k].name} 상세로 이동`}
            >
              <CardVisual k={k} />
            </SheetLink>
          ))}
        </div>
      </div>
    </section>
  );
}
