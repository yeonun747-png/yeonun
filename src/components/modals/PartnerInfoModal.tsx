"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { clearPartnerInfo, writePartnerInfo, type PartnerInfoPayload } from "@/lib/partner-info-storage";

/** 12시진 — 저장용 key + 화면 표시는 시간대만 */
const HOUR_BRANCHES: { key: string; range: string; hour: number }[] = [
  { key: "zi", range: "23-01시", hour: 0 },
  { key: "chou", range: "01-03시", hour: 1 },
  { key: "yin", range: "03-05시", hour: 3 },
  { key: "mao", range: "05-07시", hour: 5 },
  { key: "chen", range: "07-09시", hour: 7 },
  { key: "si", range: "09-11시", hour: 9 },
  { key: "wu", range: "11-13시", hour: 11 },
  { key: "wei", range: "13-15시", hour: 13 },
  { key: "shen", range: "15-17시", hour: 15 },
  { key: "you", range: "17-19시", hour: 17 },
  { key: "xu", range: "19-21시", hour: 19 },
  { key: "hai", range: "21-23시", hour: 21 },
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 연도 미선택 시 — 월만으로 최대 일수 (2월은 윤년 대비 29일까지) */
function maxDayForMonthOnly(month: number): number {
  if (month === 2) return 29;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

const RELATIONS = [
  { value: "lover", label: "연인" },
  { value: "crush", label: "썸·호감" },
  { value: "spouse", label: "배우자" },
  { value: "reunion", label: "재회 상대" },
  { value: "friend", label: "친구" },
  { value: "family_child", label: "가족·자녀" },
  { value: "other", label: "기타" },
];

function goFortuneStream(args: {
  router: ReturnType<typeof useRouter>;
  pathname: string;
  sp: URLSearchParams;
  product: string;
  title: string;
  price: string;
  character_key: string;
  order_no: string | null;
}) {
  const next = new URLSearchParams(args.sp.toString());
  next.set("modal", "fortune_stream");
  next.set("product", args.product);
  next.set("title", args.title);
  next.set("price", args.price);
  next.set("character_key", args.character_key);
  next.set("profile", "pair");
  if (args.order_no) next.set("order_no", args.order_no);
  args.router.replace(`${args.pathname}?${next.toString()}`);
}

export function PartnerInfoModal() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const product = sp.get("product") ?? "";
  const title = sp.get("title") ?? "";
  const price = sp.get("price") ?? "0";
  const character_key = sp.get("character_key") ?? "yeon";
  const order_no = sp.get("order_no");

  const [name, setName] = useState("");
  const [relation, setRelation] = useState("lover");
  const [y, setY] = useState("");
  const [m, setM] = useState("");
  const [d, setD] = useState("");
  const [branchKey, setBranchKey] = useState<string | null>(null);
  const [unknownTime, setUnknownTime] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | "">("female");
  const [err, setErr] = useState<string | null>(null);

  const yearChoices = useMemo(() => {
    const maxY = new Date().getFullYear();
    const a: number[] = [];
    for (let yr = maxY; yr >= 1900; yr--) a.push(yr);
    return a;
  }, []);

  const maxDayInMonth = useMemo(() => {
    const mi = Number(m);
    if (!m || !Number.isFinite(mi) || mi < 1 || mi > 12) return 0;

    const yi = Number(y);
    if (y && Number.isFinite(yi)) {
      return daysInMonth(yi, mi);
    }
    return maxDayForMonthOnly(mi);
  }, [y, m]);

  useEffect(() => {
    if (maxDayInMonth === 0) {
      if (d !== "") setD("");
      return;
    }
    if (d === "") return;
    const di = Number(d);
    if (!Number.isFinite(di) || di > maxDayInMonth) setD(String(maxDayInMonth));
  }, [maxDayInMonth, d]);

  const spStr = sp.toString();
  useEffect(() => {
    const qs = new URLSearchParams(spStr);
    qs.set("modal", "partner_info");
    const href = `${pathname}?${qs.toString()}`;
    window.history.pushState({ yPartnerInfo: 1 }, "", href);
    const onPopState = () => {
      router.replace(href);
      window.history.pushState({ yPartnerInfo: 1 }, "", href);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [pathname, spStr, router]);

  const submit = useCallback(
    (skipPartner: boolean) => {
      setErr(null);
      if (!product) {
        setErr("상품 정보가 없습니다.");
        return;
      }
      if (skipPartner) {
        clearPartnerInfo(product);
        goFortuneStream({ router, pathname, sp, product, title, price, character_key, order_no });
        return;
      }
      if (!y || !m || !d) {
        setErr("생년월일을 모두 선택해 주세요.");
        return;
      }
      const yi = Number(y);
      const mi = Number(m);
      const di = Number(d);
      const maxYear = new Date().getFullYear();
      if (!Number.isFinite(yi) || yi < 1900 || yi > maxYear) {
        setErr("생년을 확인해 주세요.");
        return;
      }
      if (!Number.isFinite(mi) || mi < 1 || mi > 12) {
        setErr("생월을 확인해 주세요.");
        return;
      }
      const dim = daysInMonth(yi, mi);
      if (!Number.isFinite(di) || di < 1 || di > dim) {
        setErr("생일을 확인해 주세요.");
        return;
      }
      if (!unknownTime && !branchKey) {
        setErr("출생 시간을 선택하거나, 모름을 체크해 주세요.");
        return;
      }
      if (!gender) {
        setErr("성별을 선택해 주세요.");
        return;
      }
      const payload: PartnerInfoPayload = {
        name: name.trim(),
        relation,
        y: yi,
        m: mi,
        d: di,
        hourBranch: unknownTime ? null : branchKey,
        unknownTime,
        gender,
      };
      writePartnerInfo(product, payload);
      goFortuneStream({ router, pathname, sp, product, title, price, character_key, order_no });
    },
    [product, name, relation, y, m, d, branchKey, unknownTime, gender, router, pathname, sp, title, price, character_key, order_no],
  );

  return (
    <YeonunSheetPortal>
    <div className="y-modal open y-partner-modal" role="dialog" aria-modal="true" aria-label="상대방 정보 입력">
      <div className="y-modal-sheet y-partner-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="y-modal-handle" />
        <div className="y-modal-head y-partner-head">
          <span className="y-partner-head-slot" aria-hidden />
          <div className="y-modal-title">상대방 정보 입력</div>
          <span className="y-partner-head-slot" aria-hidden />
        </div>

        <div className="y-modal-scroll y-partner-scroll">
          <hr className="y-partner-intro-rule" />
          <div className="y-partner-intro-gap" aria-hidden />
          <p className="y-partner-lead">
            풀이 정확도를 높이기 위해 상대방 정보를 입력해 주세요. 정확하지 않아도 괜찮아요. 아시는 만큼만 적어 주세요.
          </p>

          <div className="y-partner-field">
            <span className="y-partner-label">이름 (선택)</span>
            <input
              className="y-partner-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동 또는 그 사람이라고만"
              autoComplete="name"
            />
          </div>

          <div className="y-partner-field">
            <span className="y-partner-label">관계</span>
            <select className="y-partner-select" value={relation} onChange={(e) => setRelation(e.target.value)}>
              {RELATIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="y-partner-field">
            <span className="y-partner-label">생년월일 (양력)</span>
            <div className="y-partner-ymd">
              <select className="y-partner-select y-partner-ymd-item" value={y} onChange={(e) => setY(e.target.value)} aria-label="생년">
                <option value="">년</option>
                {yearChoices.map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr}
                  </option>
                ))}
              </select>
              <select className="y-partner-select y-partner-ymd-item" value={m} onChange={(e) => setM(e.target.value)} aria-label="생월">
                <option value="">월</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
                  <option key={mo} value={String(mo)}>
                    {String(mo).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <select
                className="y-partner-select y-partner-ymd-item"
                value={d}
                onChange={(e) => setD(e.target.value)}
                aria-label="생일"
                disabled={!m}
              >
                <option value="">일</option>
                {Array.from({ length: maxDayInMonth }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={String(day)}>
                    {String(day).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="y-partner-field">
            <span className="y-partner-label">출생 시간</span>
            <div className="y-partner-ji-grid" role="group" aria-label="시진 선택">
              {HOUR_BRANCHES.map((b) => {
                const active = !unknownTime && branchKey === b.key;
                return (
                  <button
                    key={b.key}
                    type="button"
                    className={`y-partner-ji-btn ${active ? "active" : ""}`}
                    disabled={unknownTime}
                    onClick={() => {
                      setUnknownTime(false);
                      setBranchKey(b.key);
                    }}
                  >
                    <span className="y-partner-ji-label">{b.range}</span>
                  </button>
                );
              })}
            </div>
            <label className="y-partner-check">
              <input
                type="checkbox"
                checked={unknownTime}
                onChange={(e) => {
                  const on = e.target.checked;
                  setUnknownTime(on);
                  if (on) setBranchKey(null);
                }}
              />
              <span>출생 시간을 모릅니다 (시주 제외하고 풀이)</span>
            </label>
          </div>

          <div className="y-partner-field">
            <span className="y-partner-label">성별</span>
            <div className="y-partner-gender" role="group" aria-label="성별">
              <button type="button" className={`y-partner-gender-btn ${gender === "male" ? "active" : ""}`} onClick={() => setGender("male")}>
                남자
              </button>
              <button type="button" className={`y-partner-gender-btn ${gender === "female" ? "active" : ""}`} onClick={() => setGender("female")}>
                여자
              </button>
            </div>
          </div>

          {err ? (
            <p className="y-partner-err" role="alert">
              {err}
            </p>
          ) : null}
        </div>

        <div className="y-partner-foot">
          <button type="button" className="y-partner-primary" onClick={() => submit(false)}>
            풀이 시작하기
          </button>
          <button type="button" className="y-partner-skip" onClick={() => submit(true)}>
            상대방 정보 없이 진행
          </button>
        </div>
      </div>
    </div>
    </YeonunSheetPortal>
  );
}
