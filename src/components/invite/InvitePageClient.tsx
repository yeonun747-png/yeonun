"use client";

import { useCallback, useEffect, useState } from "react";

import { formatKstConsultHeaderKo } from "@/lib/datetime/kst";
import { readM08AssignedKst } from "@/lib/referral-pending";
import { supabaseBrowser } from "@/lib/supabase/client";

function formatKstDateKeyKo(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return key;
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

export function InvitePageClient() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareBusy, setShareBusy] = useState(false);
  const inviteLinkStartKey = readM08AssignedKst();
  const inviteLinkStartLabel = formatKstDateKeyKo(inviteLinkStartKey);
  const todayLabel = formatKstConsultHeaderKo(new Date());

  useEffect(() => {
    void (async () => {
      const sb = supabaseBrowser();
      const session = sb ? (await sb.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/referral/code", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string };
        if (res.ok && data.ok && data.code) setCode(data.code);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const inviteUrl = code
    ? `${typeof window !== "undefined" ? window.location.origin : "https://yeonun.com"}/?ref=${encodeURIComponent(code)}&m08_kst=${inviteLinkStartKey}`
    : "";

  const shareInvite = useCallback(async () => {
    if (!inviteUrl || shareBusy) return;
    setShareBusy(true);
    try {
      const text = "연운에서 함께 운세·상담을 시작해요";
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "연운 친구 초대", text, url: inviteUrl });
          return;
        } catch (e: unknown) {
          const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
          if (name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(`${text}\n${inviteUrl}`);
      window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message: "초대 링크가 복사됐어요" } }));
    } finally {
      setShareBusy(false);
    }
  }, [inviteUrl, shareBusy]);

  return (
    <main className="yeonunPage" style={{ maxWidth: 520, margin: "0 auto", padding: "24px 20px 48px" }}>
      <h1 className="ySectionTitle" style={{ marginBottom: 8 }}>
        친구 초대
      </h1>
      <p style={{ fontSize: 13, color: "var(--y-mute)", lineHeight: 1.7, marginBottom: 20 }}>
        초대 링크로 가입한 친구와 나 모두 3,900 크레딧을 받아요.
        <br />
        이 링크를 만든 날({inviteLinkStartLabel})부터 7일 안에 가입한 친구에게 적용돼요.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--y-mute)" }}>초대 코드 불러오는 중…</p>
      ) : code ? (
        <>
          <div
            style={{
              border: "1px solid var(--y-line)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 16,
              fontSize: 13,
              wordBreak: "break-all",
            }}
          >
            {inviteUrl}
          </div>
          <button type="button" className="y-my-credit-login-btn" disabled={shareBusy} onClick={() => void shareInvite()}>
            {shareBusy ? "공유 중…" : "초대 링크 공유"}
          </button>
        </>
      ) : (
        <p style={{ fontSize: 13, color: "var(--y-mute)" }}>
          로그인 후 초대 코드를 발급할 수 있어요.{" "}
          <a href="/my?modal=auth" style={{ color: "var(--y-ink)" }}>
            로그인
          </a>
        </p>
      )}

      <p style={{ marginTop: 24, fontSize: 11.5, color: "var(--y-mute)" }}>
        오늘 {todayLabel} · 친구는 여러 명 초대할 수 있어요
      </p>
    </main>
  );
}
