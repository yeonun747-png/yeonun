"use client";

export type DailyChipKey = "dream" | "resolution" | "feeling" | "event" | "other";

const s = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function DailyRecordChipGlyph({ chipKey }: { chipKey: DailyChipKey }) {
  switch (chipKey) {
    case "dream":
      return (
        <svg className="y-daily-record-chip-svg" viewBox="0 0 20 20" aria-hidden>
          <path {...s} d="M14.5 11a5 5 0 1 1-7-7" />
          <path {...s} d="M5 16h2.5" strokeWidth="1.2" opacity="0.75" />
        </svg>
      );
    case "resolution":
      return (
        <svg className="y-daily-record-chip-svg" viewBox="0 0 20 20" aria-hidden>
          <circle {...s} cx="10" cy="10" r="6" />
          <circle {...s} cx="10" cy="10" r="2.5" fill="currentColor" stroke="none" opacity="0.35" />
        </svg>
      );
    case "feeling":
      return (
        <svg className="y-daily-record-chip-svg" viewBox="0 0 20 20" aria-hidden>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 16.2l-.6-.5C6.2 12.8 4 10.7 4 8.2 4 6.7 5.2 5.5 6.9 5.5c1 0 2 .5 2.6 1.3.2.3.4.3.5 0C10.6 6 11.6 5.5 12.7 5.5 14.4 5.5 15.6 6.7 15.6 8.2c0 2.5-2.2 4.6-5.4 7.5l-.6.5z"
          />
        </svg>
      );
    case "event":
      return (
        <svg className="y-daily-record-chip-svg" viewBox="0 0 20 20" aria-hidden>
          <path {...s} d="M10 3l1.8 4.2L16 8.5l-3.5 3 1 4.5L10 14.2 6.5 16l1-4.5-3.5-3 4.2-1.3z" />
        </svg>
      );
    case "other":
      return (
        <svg className="y-daily-record-chip-svg" viewBox="0 0 20 20" aria-hidden>
          <path {...s} d="M5.5 6h9M5.5 10h9M5.5 14h6" />
        </svg>
      );
    default:
      return null;
  }
}
