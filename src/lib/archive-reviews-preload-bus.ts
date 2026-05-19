let warmFn: (() => void) | null = null;

export function registerArchiveReviewsWarm(fn: (() => void) | null) {
  warmFn = fn;
}

export function archiveReviewsWarm() {
  warmFn?.();
}
