"use client";

import { useCallback, useState } from "react";

import { AdminMemberFilePanel } from "@/components/admin/AdminMemberFilePanel";
import { useAdminInquiryResolve } from "@/hooks/useAdminInquiryResolve";
import type { AdminMemberFile } from "@/lib/admin-cs-member";

type MemberHit = {
  user_id: string;
  display_name: string;
  email: string | null;
  login_email?: string | null;
  provider: string | null;
  provider_id?: string | null;
  social_name: string | null;
};

export function AdminMemberCreditsClient() {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<MemberHit | null>(null);
  const [file, setFile] = useState<AdminMemberFile | null>(null);
  const [deltaPaid, setDeltaPaid] = useState("");
  const [deltaFree, setDeltaFree] = useState("");
  const [adjustKind, setAdjustKind] = useState<"cs_refund" | "admin_adjust">("cs_refund");
  const [memo, setMemo] = useState("");
  const [refId, setRefId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "ok" | "err">("info");

  const loadFile = useCallback(async (userId: string) => {
    const res = await fetch(`/api/admin/credits/file?user_id=${encodeURIComponent(userId)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.file) throw new Error(data.error || "조회 실패");
    setFile(data.file as AdminMemberFile);
  }, []);

  const search = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    setFile(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/admin/credits/search?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "검색 실패");
      setMembers(data.members ?? []);
      setSearched(true);
      if ((data.members ?? []).length === 0) {
        setMessageTone("info");
        setMessage("검색 결과가 없습니다.");
      }
    } catch (e) {
      setMessageTone("err");
      setMessage(e instanceof Error ? e.message : "검색 오류");
    } finally {
      setBusy(false);
    }
  }, [query]);

  const pickMember = useCallback(
    async (m: MemberHit) => {
      setSelected(m);
      setBusy(true);
      setMessage(null);
      try {
        await loadFile(m.user_id);
      } catch (e) {
        setFile(null);
        setMessageTone("err");
        setMessage(e instanceof Error ? e.message : "회원 파일 조회 오류");
      } finally {
        setBusy(false);
      }
    },
    [loadFile],
  );

  const applyAdjust = useCallback(async () => {
    if (!selected) return;
    const dp = Number(deltaPaid) || 0;
    const df = Number(deltaFree) || 0;
    if (dp === 0 && df === 0) {
      setMessageTone("err");
      setMessage("조정 크레딧을 입력해 주세요.");
      return;
    }
    if (!memo.trim()) {
      setMessageTone("err");
      setMessage("사유(메모)를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selected.user_id,
          delta_paid: dp,
          delta_free: df,
          kind: adjustKind,
          memo: memo.trim(),
          ref_id: refId.trim() || undefined,
          ref_type: refId.trim() ? "order" : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "조정 실패");
      setDeltaPaid("");
      setDeltaFree("");
      setMemo("");
      setMessageTone("ok");
      setMessage("반영되었습니다.");
      await loadFile(selected.user_id);
    } catch (e) {
      setMessageTone("err");
      setMessage(e instanceof Error ? e.message : "조정 오류");
    } finally {
      setBusy(false);
    }
  }, [adjustKind, deltaFree, deltaPaid, loadFile, memo, refId, selected]);

  const { busyId: resolvingInquiryId, resolve: resolveInquiryRaw } = useAdminInquiryResolve(async () => {
    if (!selected) return;
    setMessageTone("ok");
    setMessage("문의를 처리완료했습니다.");
    await loadFile(selected.user_id);
  });

  const resolveInquiry = useCallback(
    (inquiryId: string) => {
      void resolveInquiryRaw(inquiryId);
    },
    [resolveInquiryRaw],
  );

  return (
    <div className="y-admin-member-credits">
      <p className="y-admin-member-credits-lead">
        로그인 회원 CS 파일카드 · 이메일 · 닉네임 · UUID · 주문번호(YN…) 검색
      </p>

      <div className="y-admin-member-credits-search">
        <label className="y-admin-member-credits-search-label" htmlFor="admin-credits-q">
          회원 검색
        </label>
        <div className="y-admin-member-credits-search-row">
          <input
            id="admin-credits-q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="CS이메일·@앞 id(macju), 카카오ID, 닉네임, UUID, YN주문"
            onKeyDown={(e) => {
              if (e.key === "Enter") void search();
            }}
          />
          <button
            type="button"
            className="y-admin-member-credits-search-btn"
            disabled={busy || !query.trim()}
            onClick={() => void search()}
          >
            {busy ? "검색 중…" : "검색"}
          </button>
        </div>
      </div>

      {message ? (
        <p className={`y-admin-member-credits-msg y-admin-member-credits-msg--${messageTone}`} role="status">
          {message}
        </p>
      ) : null}

      {members.length > 0 ? (
        <div className="y-admin-member-credits-block">
          <h3 className="y-admin-member-credits-block-title">검색 결과 ({members.length})</h3>
          <ul className="y-admin-member-credits-hits">
            {members.map((m) => (
              <li key={m.user_id}>
                <button
                  type="button"
                  className={selected?.user_id === m.user_id ? "active" : ""}
                  onClick={() => void pickMember(m)}
                  disabled={busy}
                >
                  <span className="y-admin-member-credits-hit-name">{m.display_name || m.social_name || "(이름 없음)"}</span>
                  <span className="y-admin-member-credits-hit-email">{m.email ?? m.login_email ?? "이메일 없음"}</span>
                  {m.provider ? (
                    <span className="y-admin-member-credits-hit-provider">
                      {m.provider}
                      {m.provider_id ? ` · ${m.provider_id}` : ""}
                    </span>
                  ) : null}
                  <span className="y-admin-member-credits-hit-id" title="회원 UUID">
                    {m.user_id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {selected && file ? (
        <AdminMemberFilePanel
          file={file}
          adjust={{
            busy,
            deltaPaid,
            deltaFree,
            adjustKind,
            memo,
            refId,
            onDeltaPaid: setDeltaPaid,
            onDeltaFree: setDeltaFree,
            onAdjustKind: setAdjustKind,
            onMemo: setMemo,
            onRefId: setRefId,
            onAdjust: () => void applyAdjust(),
          }}
          inquiryResolve={{
            busyId: resolvingInquiryId,
            onResolve: resolveInquiry,
          }}
        />
      ) : searched && members.length > 0 && selected && !file && busy ? (
        <p className="y-admin-member-credits-empty">회원 파일을 불러오는 중…</p>
      ) : searched && members.length > 0 && !selected ? (
        <p className="y-admin-member-credits-empty">목록에서 회원을 선택하면 파일카드가 열립니다.</p>
      ) : null}
    </div>
  );
}
