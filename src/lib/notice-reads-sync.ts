"use client";

import {
  markNoticeReadInStorage,
  mergeNoticeSlugsIntoStorage,
  readNoticeSlugsFromStorage,
} from "@/lib/notice-reads";

/** 로그인 후 서버 읽음 목록 → localStorage 병합 */
export async function syncNoticeReadsFromServer(accessToken: string): Promise<void> {
  try {
    const res = await fetch("/api/me/notice-reads", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; slugs?: string[] };
    if (!res.ok || !data.ok || !Array.isArray(data.slugs)) return;

    const local = readNoticeSlugsFromStorage();
    const merged = [...new Set([...local, ...data.slugs])];
    mergeNoticeSlugsIntoStorage(merged);

    const onlyLocal = [...local].filter((s) => !data.slugs!.includes(s));
    if (onlyLocal.length > 0) {
      await fetch("/api/me/notice-reads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slugs: [...local] }),
      });
    }
  } catch {
    /* ignore */
  }
}

export async function pushNoticeReadToServer(accessToken: string, slug: string): Promise<void> {
  try {
    await fetch("/api/me/notice-reads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slug }),
    });
  } catch {
    /* ignore */
  }
}

/** localStorage + 로그인 시 서버 저장 */
export function markNoticeRead(slug: string, accessToken?: string | null): void {
  markNoticeReadInStorage(slug);
  const tok = accessToken?.trim();
  if (tok) void pushNoticeReadToServer(tok, slug);
}
