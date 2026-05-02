"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  readAuthStubLoggedIn,
  YEONUN_AUTH_STUB_EVENT,
} from "@/lib/auth-stub";
import {
  deleteDailyNoteById,
  type DailyNoteCategory,
  type DailyNoteEntry,
  getNoteByKstDate,
  groupNotesByKstMonth,
  loadAllNotes,
  upsertDailyNote,
} from "@/lib/daily-notes-catalog";
import { formatKstDateKey } from "@/lib/datetime/kst";

import { DailyRecordChipGlyph, type DailyChipKey } from "@/components/today/DailyRecordChipGlyph";

const MAX_LEN = 200;
const WARN_FROM = 180;

const CHIPS: { category: DailyNoteCategory; label: string; chipKey: DailyChipKey }[] = [
  { category: "dream", label: "꿈 기록", chipKey: "dream" },
  { category: "resolution", label: "오늘의 다짐", chipKey: "resolution" },
  { category: "feeling", label: "오늘의 느낌", chipKey: "feeling" },
  { category: "event", label: "특별한 일", chipKey: "event" },
];

/** 목업 헤더용 MM.DD (KST 날짜 키) */
function formatShortKstDate(kst: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(kst.trim());
  if (!m) return "";
  return `${m[2]}.${m[3]}`;
}

function parseKstYmd(kst: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(kst.trim());
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

/** 목록 행: 큰 일자 + 오늘 또는 요일 */
function listRowDayParts(kst: string, kstToday: string): { day: string; sub: string } {
  const p = parseKstYmd(kst);
  if (!p) return { day: "", sub: "" };
  const day = String(p.d).padStart(2, "0");
  if (kst === kstToday) return { day, sub: "오늘" };
  const dt = new Date(p.y, p.mo - 1, p.d);
  const wd = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(dt);
  return { day, sub: wd };
}

/** 나의 기록 목록 칩: 카테고리 → 칩 글리프 키 */
function categoryToChipKey(category: DailyNoteCategory): DailyChipKey {
  switch (category) {
    case "dream":
      return "dream";
    case "resolution":
      return "resolution";
    case "feeling":
      return "feeling";
    case "event":
      return "event";
    default:
      return "other";
  }
}

/** 나의 기록 목록 칩 라벨 (이모지 없음) */
function recordCategoryLabel(category: DailyNoteCategory): string {
  switch (category) {
    case "dream":
      return "꿈 기록";
    case "resolution":
      return "오늘의 다짐";
    case "feeling":
      return "오늘의 느낌";
    case "event":
      return "특별한 일";
    default:
      return "기타";
  }
}

/** 상세 바텀시트 헤더: yyyy년 m월 d일 */
function formatKstDetailTitle(kst: string): string {
  const p = parseKstYmd(kst);
  if (!p) return kst;
  return `${p.y}년 ${p.mo}월 ${p.d}일`;
}

/** 상세 메타 앞부분: "2026년 5월 3일 일요일 · " (카테고리는 SVG+라벨로 별도 표시) */
function formatKstDetailMetaPrefix(kst: string): string {
  const p = parseKstYmd(kst);
  if (!p) return "";
  const dt = new Date(p.y, p.mo - 1, p.d);
  const wd = new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(dt);
  return `${p.y}년 ${p.mo}월 ${p.d}일 ${wd} · `;
}

export function TodayDailyRecordClient() {
  const [authed, setAuthed] = useState(false);
  const [kstToday, setKstToday] = useState(() => formatKstDateKey(new Date()));
  const [editing, setEditing] = useState(true);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<DailyNoteCategory>("dream");
  const [savedFlash, setSavedFlash] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [detail, setDetail] = useState<DailyNoteEntry | null>(null);
  const [editingPastKst, setEditingPastKst] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const syncAuth = useCallback(() => setAuthed(readAuthStubLoggedIn()), []);

  useEffect(() => {
    syncAuth();
    window.addEventListener(YEONUN_AUTH_STUB_EVENT, syncAuth);
    return () => window.removeEventListener(YEONUN_AUTH_STUB_EVENT, syncAuth);
  }, [syncAuth]);

  useEffect(() => {
    const t = setInterval(() => setKstToday(formatKstDateKey(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  const todayRow = useMemo(() => getNoteByKstDate(kstToday), [kstToday, savedFlash, listOpen, detail]);

  useEffect(() => {
    if (!authed) return;
    const row = getNoteByKstDate(kstToday);
    if (editingPastKst && editingPastKst !== kstToday) return;
    if (row?.body) {
      setText(row.body);
      setCategory(row.category);
      setEditing(false);
    } else {
      setText("");
      setCategory("dream");
      setEditing(true);
    }
  }, [authed, kstToday, editingPastKst]);

  /** 알약은 기록 종류만 선택(저장 시 category 반영). 마지막 클릭이 유효. 입력란에는 글자를 넣지 않음 */
  const onChipSelect = (cat: DailyNoteCategory) => {
    setCategory(cat);
    requestAnimationFrame(() => {
      taRef.current?.focus();
      const len = taRef.current?.value.length ?? 0;
      taRef.current?.setSelectionRange(len, len);
    });
  };

  const onSave = useCallback(() => {
    const body = text.trim();
    if (body.length < 1) return;
    const targetKst = editingPastKst ?? kstToday;
    const prior = getNoteByKstDate(targetKst);
    const firstSaveOfDay = targetKst === kstToday && !prior?.body?.trim();
    upsertDailyNote(targetKst, body, category);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
    setEditing(false);
    setEditingPastKst(null);
    if (firstSaveOfDay) {
      window.dispatchEvent(new CustomEvent("yeonun:daily-note-first-save", { detail: { kstDate: kstToday } }));
    }
  }, [text, category, kstToday, editingPastKst]);

  const onEdit = () => setEditing(true);

  const grouped = useMemo(() => groupNotesByKstMonth(loadAllNotes()), [listOpen, savedFlash, detail]);

  const openDetail = (row: DailyNoteEntry) => {
    setDetail(row);
    setListOpen(false);
  };

  const onDeleteDetail = () => {
    if (!detail) return;
    deleteDailyNoteById(detail.id);
    setDetail(null);
    if (detail.kst_date === kstToday) {
      setText("");
      setEditing(true);
    }
    try {
      window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message: "기록을 삭제했어요" } }));
    } catch {
      // ignore
    }
  };

  const onEditFromDetail = () => {
    if (!detail) return;
    setDetail(null);
    setListOpen(false);
    setEditingPastKst(detail.kst_date);
    setText(detail.body);
    setCategory(detail.category);
    setEditing(true);
    if (detail.kst_date !== kstToday) {
      try {
        window.dispatchEvent(
          new CustomEvent("yeonun:toast", {
            detail: { message: `${detail.kst_date} 기록을 불러왔어요. 저장 시 해당 날짜에 덮어씁니다.` },
          }),
        );
      } catch {
        // ignore
      }
    }
  };

  const saveLabelKst = editingPastKst ?? kstToday;
  const isPastEdit = editingPastKst != null && editingPastKst !== kstToday;

  if (!authed) {
    return (
      <section id="today-daily-record" className="y-daily-record" aria-label="오늘의 기록">
        <div className="y-daily-record-inner y-daily-record-guest">
          <p className="y-daily-record-guest-msg">로그인 후 기록할 수 있어요</p>
          <Link className="y-daily-record-login" href="/my?modal=auth">
            로그인
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section id="today-daily-record" className="y-daily-record" aria-label="오늘의 기록">
      <div className="y-daily-record-inner">
        <div className="y-daily-record-head">
          <h2 className="ySectionTitle y-daily-record-head-title">오늘의 기록</h2>
          <div className="y-daily-record-head-actions">
            <button type="button" className="y-daily-record-pill-btn" onClick={() => setListOpen(true)}>
              기록 보기
            </button>
            <span className="y-daily-record-date">{formatShortKstDate(kstToday)}</span>
          </div>
        </div>
        <p className="y-daily-record-lede">
          오늘의 꿈·다짐·느낌을 기록해주세요. 꿈해몽 풀이 요청 시 자동으로 불러옵니다.
        </p>
        {isPastEdit ? (
          <p className="y-daily-record-past-hint" role="status">
            {saveLabelKst} 기록 편집 중 · 저장 시 해당 날짜에 반영됩니다
          </p>
        ) : null}

        <div className="y-daily-record-chips">
          {CHIPS.map((c) => (
            <button
              key={c.category}
              type="button"
              className={`y-daily-record-chip${category === c.category ? " is-selected" : ""}`}
              aria-pressed={category === c.category}
              onClick={() => onChipSelect(c.category)}
            >
              <DailyRecordChipGlyph chipKey={c.chipKey} />
              <span className="y-daily-record-chip-label">{c.label}</span>
            </button>
          ))}
        </div>

        <div className="y-daily-record-field">
          <div className="y-daily-record-ta-shell">
            <textarea
              ref={taRef}
              className="y-daily-record-ta"
              maxLength={MAX_LEN}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              readOnly={!editing}
              placeholder="오늘 떠오르는 것을 자유롭게 적어보세요..."
              aria-label="오늘의 기록"
            />
          </div>
          <div className={`y-daily-record-counter${text.length >= WARN_FROM ? " warn" : ""}`}>
            {text.length} / {MAX_LEN}
          </div>
        </div>

        <div className="y-daily-record-footer-row">
          <div className="y-daily-record-footer-left">
            {savedFlash ? (
              <div className="y-daily-record-saved-inline" role="status" aria-live="polite">
                <span className="y-daily-record-saved-check" aria-hidden>
                  ✓
                </span>
                <span>저장됐어요 (기기에만 저장되요)</span>
              </div>
            ) : (
              <div className="y-daily-record-privacy">
                <svg className="y-daily-record-privacy-icon" viewBox="0 0 24 24" aria-hidden>
                  <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    d="M8 11V8a4 4 0 0 1 8 0v3"
                  />
                </svg>
                <span>나만 볼 수 있어요 (기기에만 저장되요)</span>
              </div>
            )}
          </div>
          <div className="y-daily-record-actions">
            {editing ? (
              <button
                type="button"
                className="y-daily-record-save"
                disabled={text.trim().length < 1}
                onClick={() => onSave()}
              >
                저장
              </button>
            ) : (
              <button type="button" className="y-daily-record-save secondary" onClick={onEdit}>
                수정
              </button>
            )}
          </div>
        </div>
      </div>

      {listOpen ? (
        <div
          className="y-modal open"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setListOpen(false);
          }}
        >
          <div
            className="y-modal-sheet y-notes-records-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="y-notes-records-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="y-modal-handle" />
            <div className="y-modal-head y-modal-head--notes">
              <button type="button" className="y-modal-back" onClick={() => setListOpen(false)} aria-label="뒤로">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M15 18 L9 12 L15 6" />
                </svg>
              </button>
              <div className="y-modal-title" id="y-notes-records-title">
                나의 기록
              </div>
              <button type="button" className="y-modal-close" onClick={() => setListOpen(false)} aria-label="닫기">
                ×
              </button>
            </div>
            <div className="y-modal-scroll y-notes-records-scroll">
              {grouped.length === 0 ? (
                <p className="y-notes-records-empty">저장된 기록이 없어요</p>
              ) : (
                grouped.map((g) => (
                  <section key={g.key} className="y-notes-month-block">
                    <div className="y-notes-month-bar">{g.label}</div>
                    <ul className="y-notes-records-ul">
                      {g.items.map((row) => {
                        const { day, sub } = listRowDayParts(row.kst_date, kstToday);
                        return (
                          <li key={row.id} className="y-notes-records-li-wrap">
                            <button type="button" className="y-notes-records-li" onClick={() => openDetail(row)}>
                              <div className="y-notes-records-li-date">
                                <span className="y-notes-records-li-day">{day}</span>
                                <span className="y-notes-records-li-sub">{sub}</span>
                              </div>
                              <div className="y-notes-records-li-main">
                                <p className="y-notes-records-li-preview">{row.body}</p>
                                <span className="y-notes-records-li-chip">
                                  <DailyRecordChipGlyph chipKey={categoryToChipKey(row.category)} />
                                  <span className="y-notes-records-li-chip-label">{recordCategoryLabel(row.category)}</span>
                                </span>
                              </div>
                              <span className="y-notes-records-li-chev" aria-hidden>
                                ›
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div
          className="y-modal open"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div
            className="y-modal-sheet y-notes-detail-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="y-notes-detail-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="y-modal-handle" />
            <div className="y-modal-head y-notes-detail-head">
              <button
                type="button"
                className="y-modal-back"
                onClick={() => {
                  setDetail(null);
                  setListOpen(true);
                }}
                aria-label="뒤로"
              >
                <svg className="y-notes-detail-icon-back" viewBox="0 0 24 24" aria-hidden>
                  <path d="M15 18 L9 12 L15 6" />
                </svg>
              </button>
              <div className="y-modal-title" id="y-notes-detail-title">
                {formatKstDetailTitle(detail.kst_date)}
              </div>
              <button type="button" className="y-modal-close" onClick={() => setDetail(null)} aria-label="닫기">
                <svg className="y-notes-detail-icon-close" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M18 6 L6 18 M6 6 L18 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="y-modal-scroll y-notes-detail-scroll">
              <p className="y-notes-detail-meta">
                <span className="y-notes-detail-meta-date">{formatKstDetailMetaPrefix(detail.kst_date)}</span>
                <span className="y-notes-detail-meta-cat">
                  <DailyRecordChipGlyph chipKey={categoryToChipKey(detail.category)} />
                  <span className="y-notes-detail-meta-cat-label">{recordCategoryLabel(detail.category)}</span>
                </span>
              </p>
              <div className="y-notes-detail-body">{detail.body}</div>
              <div className="y-notes-detail-actions">
                <button type="button" className="y-notes-detail-btn-del" onClick={onDeleteDetail}>
                  삭제
                </button>
                <button type="button" className="y-notes-detail-btn-edit" onClick={onEditFromDetail}>
                  수정하기
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
