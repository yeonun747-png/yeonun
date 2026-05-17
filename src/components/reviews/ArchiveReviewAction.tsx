"use client";

import { normalizeLibraryCharacterKey } from "@/lib/library-character-filters";
import type { CharacterReviewKey } from "@/lib/reviews-types";
import { starsToDisplay } from "@/lib/reviews-types";

import { useArchiveReview } from "@/hooks/useArchiveReview";
import { useWriteReviewSheet, type WriteReviewTarget } from "@/components/reviews/WriteReviewSheetProvider";

type Props = {
  target: WriteReviewTarget;
  className?: string;
};

export function ArchiveReviewAction({ target, className }: Props) {
  const { openWriteReview } = useWriteReviewSheet();
  const { record, submitted } = useArchiveReview(target.sourceType, target.sourceId);

  const onWrite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openWriteReview({
      ...target,
      characterKey: normalizeLibraryCharacterKey(target.characterKey) || "yeon",
    });
  };

  if (submitted && record) {
    return (
      <span className={`y-rv-done-badge${className ? ` ${className}` : ""}`} aria-label="작성한 리뷰">
        {starsToDisplay(record.stars)} 내 리뷰
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`y-rv-write-btn${className ? ` ${className}` : ""}`}
      onClick={onWrite}
    >
      리뷰 쓰기 →
    </button>
  );
}

export function toCharacterReviewKey(raw: string): CharacterReviewKey {
  const k = normalizeLibraryCharacterKey(raw);
  if (k === "yeo" || k === "un" || k === "byeol") return k;
  return "yeon";
}
