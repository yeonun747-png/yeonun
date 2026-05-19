"use client";

import { useCallback, useState } from "react";

import type {
  AdminMemberFile,
  AdminMemberFilePaymentRow,
  AdminMemberFileUsageRow,
} from "@/lib/admin-cs-member";

type MemberHit = {
  user_id: string;
  display_name: string;
  email: string | null;
  login_email?: string | null;
  provider: string | null;
  provider_id?: string | null;
  social_name: string | null;
};

type FileTab = "info" | "usage" | "payments";

function fmtDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function fmtKrw(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{value}</td>
    </tr>
  );
}

function CreditBalanceCards({
  wallet,
}: {
  wallet: AdminMemberFile["wallet"];
}) {
  const freeExpiresLabel =
    wallet.free_expires_at && wallet.free > 0
      ? new Date(wallet.free_expires_at).toLocaleDateString("ko-KR", { dateStyle: "medium" })
      : null;

  return (
    <div className="y-admin-member-credits-balances y-admin-cs-balance-cards">
      <div className="y-admin-member-credits-balance-card y-admin-member-credits-balance-card--paid">
        <span className="y-admin-member-credits-balance-label">유료</span>
        <strong className="y-admin-member-credits-balance-value">{wallet.paid.toLocaleString("ko-KR")}</strong>
      </div>
      <div className="y-admin-member-credits-balance-card y-admin-member-credits-balance-card--free">
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
  );
}

function MemberFileCard({
  file,
  busy,
  deltaPaid,
  deltaFree,
  adjustKind,
  memo,
  refId,
  onDeltaPaid,
  onDeltaFree,
  onAdjustKind,
  onMemo,
  onRefId,
  onAdjust,
}: {
  file: AdminMemberFile;
  busy: boolean;
  deltaPaid: string;
  deltaFree: string;
  adjustKind: "cs_refund" | "admin_adjust";
  memo: string;
  refId: string;
  onDeltaPaid: (v: string) => void;
  onDeltaFree: (v: string) => void;
  onAdjustKind: (v: "cs_refund" | "admin_adjust") => void;
  onMemo: (v: string) => void;
  onRefId: (v: string) => void;
  onAdjust: () => void;
}) {
  const [tab, setTab] = useState<FileTab>("info");
  const { member, wallet, profiles, payment_totals_by_year, payments, usage_log, activity } = file;
  const email = member.email ?? "—";

  return (
    <div className="y-admin-cs-file">
      <div className="y-admin-cs-file-banner">
        <strong>{email}</strong>
        <span>님의 회원 파일</span>
      </div>

      <div className="y-admin-cs-file-tabs" role="tablist">
        {(
          [
            ["info", "회원정보"],
            ["usage", "이용로그"],
            ["payments", "결제로그"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "info" ? (
        <div className="y-admin-cs-file-panel y-admin-cs-file-panel--stack">
          <h4 className="y-admin-cs-file-panel-title">회원정보</h4>
            <table className="y-admin-cs-file-kv">
              <tbody>
                <InfoRow label="회원 UUID" value={<code className="y-admin-cs-mono">{member.user_id}</code>} />
                <InfoRow label="아이디(이메일)" value={email} />
                <InfoRow
                  label="SNS"
                  value={
                    member.provider_label
                      ? `${member.provider_label}${member.provider_id ? ` · ${member.provider_id}` : ""}`
                      : "—"
                  }
                />
                <InfoRow label="표시명" value={member.display_name || member.social_name || "—"} />
                <InfoRow
                  label="결제금액 (3년)"
                  value={
                    payment_totals_by_year.length > 0 ? (
                      <ul className="y-admin-cs-year-totals">
                        {payment_totals_by_year.map((y) => (
                          <li key={y.year}>
                            {y.year}년 : {fmtKrw(y.total_krw)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )
                  }
                />
                <InfoRow label="가입일" value={fmtDt(member.joined_at)} />
                <InfoRow label="최근 로그인" value={fmtDt(member.last_login_at)} />
                <InfoRow label="프로필 수정" value={fmtDt(member.profile_updated_at)} />
                <InfoRow
                  label="활동 요약"
                  value={`점사 ${activity.fortune_requests} · 음성 ${activity.voice_sessions} · 채팅 ${activity.text_chat_sessions}`}
                />
                <InfoRow
                  label="첫 구매"
                  value={wallet.first_purchase_done ? "완료" : "미완료"}
                />
                {!wallet.wallet_exists ? (
                  <InfoRow
                    label="지갑"
                    value={<span className="y-admin-cs-warn">서버 지갑 없음 — 크레딧 반영 시 생성됩니다</span>}
                  />
                ) : null}
              </tbody>
            </table>

            <section className="y-admin-cs-file-section">
              <h4 className="y-admin-cs-file-panel-title">생년월일 · 사주 입력 (서버 profiles)</h4>
              {profiles.length === 0 ? (
                <p className="y-admin-member-credits-empty">온보딩 미완료 — profiles 행 없음</p>
              ) : (
                <table className="y-admin-cs-file-data">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>이름</th>
                      <th>성별</th>
                      <th>생년월일</th>
                      <th>시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p, i) => (
                      <tr key={i}>
                        <td>{p.is_primary ? "대표" : i + 1}</td>
                        <td>{p.name}</td>
                        <td>{p.gender_label}</td>
                        <td>{p.birth_label}</td>
                        <td>{p.birth_branch_label ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="y-admin-cs-file-note">궁합 상대·기기 전용 사주는 DB에 없으며 profiles 대표 1건만 표시됩니다.</p>
            </section>

            <div className="y-admin-cs-adjust-box">
              <h5>크레딧 조정 (CS)</h5>
              <CreditBalanceCards wallet={wallet} />
              <div className="y-admin-form compact y-admin-member-credits-adjust">
                <label className="y-admin-member-credits-field">
                  <span className="y-admin-member-credits-field-label">유료 (+/-)</span>
                  <input inputMode="numeric" value={deltaPaid} onChange={(e) => onDeltaPaid(e.target.value)} placeholder="예: 3900" />
                </label>
                <label className="y-admin-member-credits-field">
                  <span className="y-admin-member-credits-field-label">무료 (+/-)</span>
                  <input inputMode="numeric" value={deltaFree} onChange={(e) => onDeltaFree(e.target.value)} placeholder="예: 130" />
                </label>
                <label className="y-admin-member-credits-field">
                  <span className="y-admin-member-credits-field-label">사유 유형</span>
                  <select value={adjustKind} onChange={(e) => onAdjustKind(e.target.value as "cs_refund" | "admin_adjust")}>
                    <option value="cs_refund">CS 환불</option>
                    <option value="admin_adjust">어드민 조정</option>
                  </select>
                </label>
                <label className="y-admin-member-credits-field">
                  <span className="y-admin-member-credits-field-label">주문번호 (선택)</span>
                  <input value={refId} onChange={(e) => onRefId(e.target.value)} placeholder="YN…" />
                </label>
                <label className="y-admin-member-credits-field full">
                  <span className="y-admin-member-credits-field-label">메모 (필수)</span>
                  <textarea value={memo} onChange={(e) => onMemo(e.target.value)} rows={2} placeholder="사유 입력" />
                </label>
                <button type="button" className="y-admin-member-credits-submit" disabled={busy} onClick={onAdjust}>
                  크레딧 반영
                </button>
              </div>
            </div>
        </div>
      ) : null}

      {tab === "usage" ? (
        <div className="y-admin-cs-file-panel y-admin-cs-file-panel--full">
          <p className="y-admin-cs-file-subhead">
            {email}님의 이용로그 · 총 {usage_log.length}건
          </p>
          <UsageLogTable rows={usage_log} />
        </div>
      ) : null}

      {tab === "payments" ? (
        <div className="y-admin-cs-file-panel y-admin-cs-file-panel--full">
          <p className="y-admin-cs-file-subhead">
            {email}님의 결제로그 · 총 {payments.length}건 (최근 3년, 결제완료)
          </p>
          <PaymentLogTable rows={payments} />
        </div>
      ) : null}
    </div>
  );
}

function UsageLogTable({ rows }: { rows: AdminMemberFileUsageRow[] }) {
  if (rows.length === 0) {
    return <p className="y-admin-member-credits-empty">이용 내역이 없습니다.</p>;
  }
  return (
    <div className="y-admin-member-credits-table-wrap">
      <table className="y-admin-cs-file-data y-admin-member-credits-table">
        <thead>
          <tr>
            <th>이용타입</th>
            <th>유형</th>
            <th>크레딧</th>
            <th>유료/무료</th>
            <th>코드</th>
            <th>내역</th>
            <th>이용일시</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className={`y-admin-cs-usage-type y-admin-cs-usage-type--${row.usage_type}`}>{row.usage_type_label}</span>
              </td>
              <td>{row.kind_label}</td>
              <td className={row.amount > 0 ? "plus" : row.amount < 0 ? "minus" : ""}>
                {row.amount > 0 ? `+${row.amount.toLocaleString("ko-KR")}` : row.amount.toLocaleString("ko-KR")}
              </td>
              <td className="y-admin-cs-num">
                {row.delta_paid ? row.delta_paid.toLocaleString("ko-KR") : "0"} / {row.delta_free ? row.delta_free.toLocaleString("ko-KR") : "0"}
              </td>
              <td className="y-admin-cs-mono">{row.code ?? "—"}</td>
              <td>{row.code_name}</td>
              <td className="y-admin-member-credits-cell-time">{fmtDt(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentLogTable({ rows }: { rows: AdminMemberFilePaymentRow[] }) {
  if (rows.length === 0) {
    return <p className="y-admin-member-credits-empty">결제 내역이 없습니다.</p>;
  }
  return (
    <div className="y-admin-member-credits-table-wrap">
      <table className="y-admin-cs-file-data y-admin-member-credits-table">
        <thead>
          <tr>
            <th>주문번호</th>
            <th>결제방식</th>
            <th>결제정보</th>
            <th>결제금액</th>
            <th>지급크레딧</th>
            <th>상품</th>
            <th>구매일시</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="y-admin-cs-mono">{row.order_no}</td>
              <td>
                <span className="y-admin-cs-pay-badge">{row.method_label}</span>
              </td>
              <td>{row.payment_info}</td>
              <td className="y-admin-cs-num">{fmtKrw(row.amount_krw)}</td>
              <td className="y-admin-cs-num">{row.bonus_credits > 0 ? row.bonus_credits.toLocaleString("ko-KR") : "—"}</td>
              <td>{row.title}</td>
              <td className="y-admin-member-credits-cell-time">{fmtDt(row.paid_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
            placeholder="CS이메일(kakao.*@oauth), 카카오ID, 닉네임, UUID, YN주문"
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
        <MemberFileCard
          file={file}
          busy={busy}
          deltaPaid={deltaPaid}
          deltaFree={deltaFree}
          adjustKind={adjustKind}
          memo={memo}
          refId={refId}
          onDeltaPaid={setDeltaPaid}
          onDeltaFree={setDeltaFree}
          onAdjustKind={setAdjustKind}
          onMemo={setMemo}
          onRefId={setRefId}
          onAdjust={() => void applyAdjust()}
        />
      ) : searched && members.length > 0 && selected && !file && busy ? (
        <p className="y-admin-member-credits-empty">회원 파일을 불러오는 중…</p>
      ) : searched && members.length > 0 && !selected ? (
        <p className="y-admin-member-credits-empty">목록에서 회원을 선택하면 파일카드가 열립니다.</p>
      ) : null}
    </div>
  );
}
