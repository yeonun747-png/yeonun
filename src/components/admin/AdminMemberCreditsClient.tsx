"use client";

import { useCallback, useState } from "react";

type MemberHit = {
  user_id: string;
  display_name: string;
  email: string | null;
  provider: string | null;
  social_name: string | null;
};

type WalletView = {
  paid: number;
  free: number;
  total: number;
  free_expires_at: string;
  first_purchase_done: boolean;
};

type LedgerRow = {
  id: string;
  delta_paid: number;
  delta_free: number;
  paid_balance_after: number;
  free_balance_after: number;
  kind: string;
  memo: string | null;
  admin_actor: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  purchase: "충전",
  spend_chat: "채팅 차감",
  spend_voice: "음성 차감",
  spend_fortune: "점사 차감",
  admin_adjust: "어드민 조정",
  cs_refund: "CS 환불",
  migration_import: "이전",
  trial_grant: "체험 지급",
};

export function AdminMemberCreditsClient() {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<MemberHit | null>(null);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [deltaPaid, setDeltaPaid] = useState("");
  const [deltaFree, setDeltaFree] = useState("");
  const [adjustKind, setAdjustKind] = useState<"cs_refund" | "admin_adjust">("cs_refund");
  const [memo, setMemo] = useState("");
  const [refId, setRefId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "ok" | "err">("info");

  const loadWallet = useCallback(async (userId: string) => {
    const res = await fetch(`/api/admin/credits/wallet?user_id=${encodeURIComponent(userId)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "조회 실패");
    setWallet(data.wallet ?? null);
    setLedger(Array.isArray(data.ledger) ? data.ledger : []);
  }, []);

  const search = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/credits/search?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "검색 실패");
      setMembers(data.members ?? []);
      setSearched(true);
      setSelected(null);
      setWallet(null);
      setLedger([]);
      if ((data.members ?? []).length === 0) {
        setMessageTone("info");
        setMessage("검색 결과가 없습니다. 이메일·닉네임·UUID·주문번호를 다시 확인해 주세요.");
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
        await loadWallet(m.user_id);
      } catch (e) {
        setMessageTone("err");
        setMessage(e instanceof Error ? e.message : "조회 오류");
      } finally {
        setBusy(false);
      }
    },
    [loadWallet],
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
      setWallet(data.wallet ?? null);
      setLedger((prev) => [data.ledger, ...prev].filter(Boolean));
      setDeltaPaid("");
      setDeltaFree("");
      setMemo("");
      setMessageTone("ok");
      setMessage("반영되었습니다. 회원이 앱을 다시 열면 잔액이 동기화됩니다.");
    } catch (e) {
      setMessageTone("err");
      setMessage(e instanceof Error ? e.message : "조정 오류");
    } finally {
      setBusy(false);
    }
  }, [adjustKind, deltaFree, deltaPaid, memo, refId, selected]);

  const freeExpiresLabel =
    wallet?.free_expires_at != null
      ? new Date(wallet.free_expires_at).toLocaleDateString("ko-KR", { dateStyle: "medium" })
      : null;

  return (
    <div className="y-admin-member-credits">
      <p className="y-admin-member-credits-lead">
        로그인 회원만 대상입니다. 이메일 · 닉네임 · UUID · 주문번호(YN…)로 검색한 뒤 유료/무료 크레딧을 조정하세요.
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
            placeholder="이메일, 닉네임, UUID, 주문번호"
            onKeyDown={(e) => {
              if (e.key === "Enter") void search();
            }}
          />
          <button type="button" className="y-admin-member-credits-search-btn" disabled={busy || !query.trim()} onClick={() => void search()}>
            {busy ? "검색 중…" : "검색"}
          </button>
        </div>
      </div>

      {message ? (
        <p className={`y-admin-member-credits-msg y-admin-member-credits-msg--${messageTone}`} role="status">
          {message}
        </p>
      ) : null}

      {searched && members.length === 0 ? null : members.length > 0 ? (
        <div className="y-admin-member-credits-block">
          <h3 className="y-admin-member-credits-block-title">검색 결과 ({members.length})</h3>
          <ul className="y-admin-member-credits-hits">
            {members.map((m) => (
              <li key={m.user_id}>
                <button
                  type="button"
                  className={selected?.user_id === m.user_id ? "active" : ""}
                  onClick={() => void pickMember(m)}
                >
                  <span className="y-admin-member-credits-hit-name">{m.display_name || m.social_name || "(이름 없음)"}</span>
                  <span className="y-admin-member-credits-hit-email">{m.email ?? "이메일 없음"}</span>
                  {m.provider ? <span className="y-admin-member-credits-hit-provider">{m.provider}</span> : null}
                  <span className="y-admin-member-credits-hit-id">{m.user_id}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {selected && wallet ? (
        <div className="y-admin-member-credits-detail">
          <div className="y-admin-member-credits-profile">
            <h3 className="y-admin-member-credits-block-title">선택 회원</h3>
            <p className="y-admin-member-credits-profile-name">
              {selected.display_name || selected.social_name || "(이름 없음)"}
            </p>
            <p className="y-admin-member-credits-profile-meta">{selected.email ?? "이메일 없음"}</p>
            <p className="y-admin-member-credits-profile-meta y-admin-member-credits-profile-id">{selected.user_id}</p>
            {wallet.first_purchase_done ? (
              <span className="y-admin-member-credits-badge">첫 구매 완료</span>
            ) : (
              <span className="y-admin-member-credits-badge y-admin-member-credits-badge--muted">첫 구매 미완료</span>
            )}
          </div>

          <div className="y-admin-member-credits-balances">
            <div className="y-admin-member-credits-balance-card">
              <span className="y-admin-member-credits-balance-label">유료</span>
              <strong className="y-admin-member-credits-balance-value">{wallet.paid.toLocaleString("ko-KR")}</strong>
            </div>
            <div className="y-admin-member-credits-balance-card">
              <span className="y-admin-member-credits-balance-label">무료</span>
              <strong className="y-admin-member-credits-balance-value">{wallet.free.toLocaleString("ko-KR")}</strong>
              {freeExpiresLabel ? (
                <span className="y-admin-member-credits-balance-sub">만료 {freeExpiresLabel}</span>
              ) : null}
            </div>
            <div className="y-admin-member-credits-balance-card y-admin-member-credits-balance-card--total">
              <span className="y-admin-member-credits-balance-label">합계</span>
              <strong className="y-admin-member-credits-balance-value">{wallet.total.toLocaleString("ko-KR")}</strong>
            </div>
          </div>

          <div className="y-admin-member-credits-block">
            <h3 className="y-admin-member-credits-block-title">크레딧 조정</h3>
            <div className="y-admin-form compact y-admin-member-credits-adjust">
              <label className="y-admin-member-credits-field">
                <span className="y-admin-member-credits-field-label">유료 조정 (+/-)</span>
                <input inputMode="numeric" value={deltaPaid} onChange={(e) => setDeltaPaid(e.target.value)} placeholder="예: 390" />
              </label>
              <label className="y-admin-member-credits-field">
                <span className="y-admin-member-credits-field-label">무료 조정 (+/-)</span>
                <input inputMode="numeric" value={deltaFree} onChange={(e) => setDeltaFree(e.target.value)} placeholder="예: 130" />
              </label>
              <label className="y-admin-member-credits-field">
                <span className="y-admin-member-credits-field-label">사유 유형</span>
                <select value={adjustKind} onChange={(e) => setAdjustKind(e.target.value as "cs_refund" | "admin_adjust")}>
                  <option value="cs_refund">CS 환불</option>
                  <option value="admin_adjust">어드민 조정</option>
                </select>
              </label>
              <label className="y-admin-member-credits-field">
                <span className="y-admin-member-credits-field-label">주문번호 (선택)</span>
                <input value={refId} onChange={(e) => setRefId(e.target.value)} placeholder="YN…" />
              </label>
              <label className="y-admin-member-credits-field full">
                <span className="y-admin-member-credits-field-label">메모 (필수)</span>
                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} placeholder="스트림 오류 3건 환불" />
              </label>
              <button type="button" className="y-admin-member-credits-submit" disabled={busy} onClick={() => void applyAdjust()}>
                크레딧 반영
              </button>
            </div>
          </div>

          <div className="y-admin-member-credits-block y-admin-member-credits-ledger">
            <h3 className="y-admin-member-credits-block-title">최근 원장</h3>
            {ledger.length === 0 ? (
              <p className="y-admin-member-credits-empty">원장 내역이 없습니다.</p>
            ) : (
              <div className="y-admin-member-credits-table-wrap">
                <table className="y-admin-member-credits-table">
                  <thead>
                    <tr>
                      <th>시각</th>
                      <th>유형</th>
                      <th>유료</th>
                      <th>무료</th>
                      <th>잔액 (유료/무료)</th>
                      <th>메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr key={row.id}>
                        <td className="y-admin-member-credits-cell-time">
                          {new Date(row.created_at).toLocaleString("ko-KR")}
                        </td>
                        <td>
                          <span className="y-admin-member-credits-kind">{KIND_LABEL[row.kind] ?? row.kind}</span>
                        </td>
                        <td className={row.delta_paid > 0 ? "plus" : row.delta_paid < 0 ? "minus" : ""}>
                          {row.delta_paid ? (row.delta_paid > 0 ? `+${row.delta_paid.toLocaleString("ko-KR")}` : row.delta_paid.toLocaleString("ko-KR")) : "—"}
                        </td>
                        <td className={row.delta_free > 0 ? "plus" : row.delta_free < 0 ? "minus" : ""}>
                          {row.delta_free ? (row.delta_free > 0 ? `+${row.delta_free.toLocaleString("ko-KR")}` : row.delta_free.toLocaleString("ko-KR")) : "—"}
                        </td>
                        <td className="y-admin-member-credits-cell-balance">
                          {row.paid_balance_after.toLocaleString("ko-KR")} / {row.free_balance_after.toLocaleString("ko-KR")}
                        </td>
                        <td className="y-admin-member-credits-cell-memo">{row.memo ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : searched && members.length > 0 && !selected ? (
        <p className="y-admin-member-credits-empty">위 목록에서 회원을 선택하면 잔액과 조정 폼이 표시됩니다.</p>
      ) : null}
    </div>
  );
}
