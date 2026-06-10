import { describe, expect, it } from "vitest";

import {
  isLibraryRetentionValid,
  libraryRetentionBadge,
  libraryRetentionExpiresAtMs,
  parseLibraryRetentionFromProduct,
} from "@/lib/library-retention";

describe("library-retention KST midnight", () => {
  it("kst_day: same calendar day valid, next day 00:00 KST expired", () => {
    const policy = parseLibraryRetentionFromProduct({ library_retention_kind: "kst_day", library_retention_days: 60 });
    const anchor = "2026-06-09T15:30:00+09:00";
    const expire = libraryRetentionExpiresAtMs(anchor, policy);
    expect(expire).toBe(new Date("2026-06-10T00:00:00+09:00").getTime());
    expect(isLibraryRetentionValid(anchor, policy, new Date("2026-06-09T23:59:00+09:00").getTime())).toBe(true);
    expect(isLibraryRetentionValid(anchor, policy, new Date("2026-06-10T00:00:01+09:00").getTime())).toBe(false);
  });

  it("kst_month: valid through month end, expires on next month 1st 00:00 KST", () => {
    const policy = parseLibraryRetentionFromProduct({ library_retention_kind: "kst_month", library_retention_days: 60 });
    const anchor = "2026-06-15T10:00:00+09:00";
    const expire = libraryRetentionExpiresAtMs(anchor, policy);
    expect(expire).toBe(new Date("2026-07-01T00:00:00+09:00").getTime());
    expect(isLibraryRetentionValid(anchor, policy, new Date("2026-06-30T23:59:00+09:00").getTime())).toBe(true);
    expect(isLibraryRetentionValid(anchor, policy, new Date("2026-07-01T00:00:00+09:00").getTime())).toBe(false);
  });

  it("days: 60-day policy uses KST day boundaries from completion day", () => {
    const policy = parseLibraryRetentionFromProduct({ library_retention_kind: "days", library_retention_days: 60 });
    const anchor = "2026-06-09T22:00:00+09:00";
    const expire = libraryRetentionExpiresAtMs(anchor, policy);
    expect(expire).toBe(new Date("2026-08-08T00:00:00+09:00").getTime());
    expect(libraryRetentionBadge(anchor, policy, new Date("2026-08-07T12:00:00+09:00").getTime())).toEqual({
      kind: "days",
      left: 1,
    });
    expect(libraryRetentionBadge(anchor, policy, new Date("2026-08-08T00:00:01+09:00").getTime())).toEqual({
      kind: "expired",
    });
  });

  it("defaults to 60 days when product fields missing", () => {
    const policy = parseLibraryRetentionFromProduct({});
    expect(policy.kind).toBe("days");
    expect(policy.days).toBe(60);
  });
});
