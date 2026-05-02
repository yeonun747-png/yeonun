"use client";

import type { MissionId } from "@/lib/daily-missions";

/** 미션별 24×24 라인 아이콘 (목업 톤에 맞춘 의미별 글리프) */
export function MissionGlyph({ id }: { id: MissionId }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "M01":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path {...common} d="M8 6h11v14H8zM5 4v16" />
          <path {...common} d="M10 10h6M10 13h4" />
        </svg>
      );
    case "M02":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path {...common} d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" />
          <path {...common} d="M8 18h8M10 21h4" />
        </svg>
      );
    case "M03":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle {...common} cx="12" cy="12" r="4" />
          <path {...common} d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case "M04":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path {...common} d="M6 8h5v4H6zM13 8h5v4h-5zM6 14h5v4H6zM13 14h5v4h-5z" />
        </svg>
      );
    case "M05":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path {...common} d="M18 11a6 6 0 1 1-8-8" />
          <path {...common} d="M6 18h3M9 18h2" strokeWidth="1.2" opacity="0.7" />
        </svg>
      );
    case "M06":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path {...common} d="M4 20l4-10 4 5 4-12 4 9" />
          <path {...common} d="M4 20h16" />
        </svg>
      );
    case "M07":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle {...common} cx="9" cy="10" r="3" />
          <circle {...common} cx="15" cy="10" r="3" />
          <path {...common} d="M6 18c1.5-2 4.5-2 6 0 1.5-2 4.5-2 6 0" />
        </svg>
      );
    case "M08":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle {...common} cx="9" cy="8" r="3" />
          <circle {...common} cx="16" cy="9" r="2.5" />
          <path {...common} d="M3 19c2-3 5-4 6-4s4 1 6 4" />
          <path {...common} d="M14 19c1.5-2 3-2.5 4-2.5" />
        </svg>
      );
    case "M09":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path {...common} d="M6 6h12l-1 12H7L6 6z" />
          <path {...common} d="M9 6V5a3 3 0 0 1 6 0v1" />
          <circle {...common} cx="12" cy="14" r="1" fill="currentColor" />
        </svg>
      );
    case "M10":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path {...common} d="M7 4h10v16H7z" />
          <path {...common} d="M10 8h4M10 11h4M10 14h3" strokeWidth="1.2" />
          <path {...common} d="M9 20h6" opacity="0.4" strokeWidth="1" />
        </svg>
      );
    case "M11":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path {...common} d="M6 4h12v16H6z" />
          <path {...common} d="M9 9h6M9 12h4M9 15h5" strokeWidth="1.2" />
        </svg>
      );
    case "M12":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle {...common} cx="18" cy="5" r="2.5" />
          <circle {...common} cx="6" cy="12" r="2.5" />
          <circle {...common} cx="18" cy="19" r="2.5" />
          <path {...common} d="M8.5 11l7-4M8.5 13l7 4" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle {...common} cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
