import { describe, expect, it, beforeAll } from "vitest";

import { createDailyWordShareToken, verifyDailyWordShareToken } from "@/lib/today-daily-word-share-token";

describe("today-daily-word-share-token", () => {
  beforeAll(() => {
    process.env.DAILY_WORD_SHARE_SECRET = "test-share-secret";
  });

  it("roundtrips a signed payload", () => {
    const token = createDailyWordShareToken({
      character_key: "byeol",
      character_label: "별하",
      quote: "오늘 별의 자리가 흔들려요.",
      kst_date: "2026-05-19",
    });
    const parsed = verifyDailyWordShareToken(token);
    expect(parsed?.c).toBe("byeol");
    expect(parsed?.l).toBe("별하");
    expect(parsed?.q).toBe("오늘 별의 자리가 흔들려요.");
    expect(parsed?.d).toBe("2026-05-19");
  });

  it("rejects tampered tokens", () => {
    const token = createDailyWordShareToken({
      character_key: "yeon",
      character_label: "연화",
      quote: "테스트",
      kst_date: "2026-05-19",
    });
    const tampered = `${token}x`;
    expect(verifyDailyWordShareToken(tampered)).toBeNull();
  });
});
