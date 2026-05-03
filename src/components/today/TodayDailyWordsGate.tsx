"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import Link from "next/link";

import { __YEONUN_SAJU_STORAGE_KEY__ } from "@/components/my/MySajuCardClient";
import {
  readAuthStubLoggedIn,
  YEONUN_AUTH_STUB_EVENT,
  YEONUN_AUTH_STUB_KEY,
} from "@/lib/auth-stub";
import { formatKstDateKey, getKstParts } from "@/lib/datetime/kst";
import { markMissionFactM04ReadNow } from "@/lib/mission-reconcile";
import { buildDailyWordShareText } from "@/lib/today-daily-words-share";
import {
  playCartesiaCharacterLine,
  prefetchCartesiaCharacterLines,
  stopCartesiaWebPlayback,
  touchCartesiaCharacterLineCache,
  warmCartesiaAudioContext,
} from "@/lib/tts/cartesiaWebPlayer";
import { supabaseBrowser } from "@/lib/supabase/client";

const SAJU_UPDATED = "yeonun:saju-updated";
/** KST 날짜 + 사주 키별로 4인 한마디를 localStorage에 보관 */
const DAILY_WORDS_CACHE_PREFIX = "yeonun:today-daily-words:v1:";

function readHasValidSaju(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(__YEONUN_SAJU_STORAGE_KEY__);
    if (!raw) return false;
    const j = JSON.parse(raw) as { year?: string; month?: string; day?: string };
    return !!(j?.year && j?.month && j?.day);
  } catch {
    return false;
  }
}

function pad2(n: number) {
  return String(Math.trunc(n)).padStart(2, "0");
}

type SajuApiBody = {
  name: string;
  calendarType: string;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  gender: string;
};

function parseStoredSaju(raw: string | null): SajuApiBody | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const year = String(j.year ?? "").trim();
    const month = String(j.month ?? "").trim();
    const day = String(j.day ?? "").trim();
    if (!year || !month || !day) return null;
    const y = parseInt(year, 10);
    const mo = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const ct = String(j.calendarType ?? "solar");
    const calendarType = ct === "lunar" || ct === "lunar-leap" ? ct : "solar";
    const hour = j.hour != null ? String(j.hour).trim() : "";
    const minute = String(j.minute ?? "0").trim() || "0";
    const gender = j.gender === "male" || j.gender === "female" ? j.gender : "female";
    return {
      name: String(j.name ?? "").trim(),
      calendarType,
      year,
      month,
      day,
      hour,
      minute,
      gender,
    };
  } catch {
    return null;
  }
}

function stableSajuKey(b: SajuApiBody): string {
  return [b.calendarType, b.year, b.month, b.day, b.hour, b.minute, b.gender].join("|");
}

const WORDS = [
  { key: "yeon" as const, han: "蓮", name: "연화에게서", text: "그 사람도 오늘 같은 마음이에요. 먼저 다가갈 필요는 없지만, 닫지도 말아요." },
  { key: "byeol" as const, han: "星", name: "별하에게서", text: "오늘 별의 자리가 흔들려요. 큰 결정은 내일로 미뤄도 늦지 않아요." },
  { key: "yeo" as const, han: "麗", name: "여연에게서", text: "오늘은 듣는 날입니다. 답은 그다음에 옵니다." },
  { key: "un" as const, han: "雲", name: "운서에게서", text: "오늘 본 꿈, 잊지 마세요. 한 글자씩 적어두면 사주의 흐름이 보여요." },
];

type CharKey = (typeof WORDS)[number]["key"];

function shortCharacterLabel(fullName: string): string {
  return fullName.replace(/에게서$/, "");
}

/** 옵션 B: 로그인 + 사주 입력까지 완료해야 해금 */
export function TodayDailyWordsGate({ kstMd }: { kstMd: string }) {
  const [hasSaju, setHasSaju] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [ttsPlayingKey, setTtsPlayingKey] = useState<CharKey | null>(null);
  const [lineByKey, setLineByKey] = useState<Partial<Record<CharKey, string>>>({});
  const [sajuNonce, setSajuNonce] = useState(0);
  const [shareFlashKey, setShareFlashKey] = useState<CharKey | null>(null);
  const playSeqRef = useRef(0);
  /** pointerdown + click 이중 호출 방지 */
  const ttsLastStartRef = useRef<{ key: CharKey; at: number } | null>(null);
  const shareBusyRef = useRef(false);

  const syncSaju = () => {
    setHasSaju(readHasValidSaju());
    setSajuNonce((n) => n + 1);
  };

  useLayoutEffect(() => {
    setHasSaju(readHasValidSaju());
  }, []);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;

    const refreshLoggedIn = () => {
      const stub = readAuthStubLoggedIn();
      if (!supabase) {
        setAuthed(stub);
        return;
      }
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!cancelled) setAuthed(!!session?.user || stub);
      });
    };

    refreshLoggedIn();

    const { data: sub } = supabase
      ? supabase.auth.onAuthStateChange(() => {
          refreshLoggedIn();
        })
      : { data: { subscription: { unsubscribe: () => {} } } };

    const onStub = () => refreshLoggedIn();
    window.addEventListener(YEONUN_AUTH_STUB_EVENT, onStub);

    const onSaju = () => {
      setHasSaju(readHasValidSaju());
      setSajuNonce((n) => n + 1);
    };
    window.addEventListener(SAJU_UPDATED, onSaju);

    const onStorage = (e: StorageEvent) => {
      if (e.key === __YEONUN_SAJU_STORAGE_KEY__) onSaju();
      if (e.key === YEONUN_AUTH_STUB_KEY) refreshLoggedIn();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener(YEONUN_AUTH_STUB_EVENT, onStub);
      window.removeEventListener(SAJU_UPDATED, onSaju);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const unlocked = authed === true && hasSaju;

  useEffect(() => {
    if (!unlocked) return;
    warmCartesiaAudioContext();
  }, [unlocked]);

  const dailyLinesReady =
    !!lineByKey.yeon && !!lineByKey.byeol && !!lineByKey.yeo && !!lineByKey.un;

  useEffect(() => {
    if (!unlocked || !dailyLinesReady) return;
    prefetchCartesiaCharacterLines(
      (["yeon", "byeol", "yeo", "un"] as const).map((k) => ({
        characterKey: k,
        transcript: lineByKey[k]!,
      })),
    );
  }, [unlocked, dailyLinesReady, lineByKey.yeon, lineByKey.byeol, lineByKey.yeo, lineByKey.un]);

  useEffect(() => {
    if (!unlocked) {
      setLineByKey({});
      return;
    }

    const raw = typeof window !== "undefined" ? window.localStorage.getItem(__YEONUN_SAJU_STORAGE_KEY__) : null;
    const body = parseStoredSaju(raw);
    if (!body) {
      setLineByKey({});
      return;
    }

    const kst = getKstParts(new Date());
    const kstKey = `${kst.year}-${pad2(kst.month)}-${pad2(kst.day)}`;
    const cacheKey = `${DAILY_WORDS_CACHE_PREFIX}${kstKey}:${stableSajuKey(body)}`;

    try {
      const hit = window.localStorage.getItem(cacheKey);
      if (hit) {
        const j = JSON.parse(hit) as { yeon?: string; byeol?: string; yeo?: string; un?: string };
        if (j?.yeon && j?.byeol && j?.yeo && j?.un) {
          setLineByKey({ yeon: j.yeon, byeol: j.byeol, yeo: j.yeo, un: j.un });
          return;
        }
      }
    } catch {
      // 캐시 무시
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/today/daily-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = (await res.json()) as {
          yeon?: string;
          byeol?: string;
          yeo?: string;
          un?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || j.error || !j.yeon || !j.byeol || !j.yeo || !j.un) {
          setLineByKey({});
          return;
        }
        const next = { yeon: j.yeon, byeol: j.byeol, yeo: j.yeo, un: j.un };
        setLineByKey(next);
        markMissionFactM04ReadNow();
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(next));
        } catch {
          // ignore
        }
      } catch {
        if (!cancelled) setLineByKey({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [unlocked, sajuNonce]);

  const flashShareDone = useCallback((key: CharKey) => {
    setShareFlashKey(key);
    window.setTimeout(() => setShareFlashKey(null), 800);
  }, []);

  const postShareLogBg = useCallback((character_key: CharKey, channel: "native" | "clipboard", accessToken: string) => {
    const kst_date = formatKstDateKey(new Date());
    void fetch("/api/today/daily-words-share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ character_key, channel, kst_date }),
    }).catch(() => {});
  }, []);

  const onShareDailyWord = useCallback(
    async (w: (typeof WORDS)[number], lineText: string) => {
      if (shareBusyRef.current) return;
      shareBusyRef.current = true;
      try {
        const shortName = w.name.replace(/에게서$/, "");
        const textBody = buildDailyWordShareText(shortName, lineText);
        const title = `${shortName}의 오늘 한 마디`;

        let channel: "native" | "clipboard" = "clipboard";
        let ok = false;

        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
          try {
            await navigator.share({ title, text: textBody });
            ok = true;
            channel = "native";
          } catch (e: unknown) {
            const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
            if (name === "AbortError") return;
            try {
              await navigator.clipboard.writeText(textBody);
              ok = true;
              channel = "clipboard";
              try {
                window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message: "클립보드에 복사됐어요" } }));
              } catch {
                /* ignore */
              }
            } catch {
              return;
            }
          }
        } else {
          try {
            await navigator.clipboard.writeText(textBody);
            ok = true;
            channel = "clipboard";
            try {
              window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message: "클립보드에 복사됐어요" } }));
            } catch {
              /* ignore */
            }
          } catch {
            return;
          }
        }

        if (!ok) return;

        flashShareDone(w.key);

        const sb = supabaseBrowser();
        const session = sb ? (await sb.auth.getSession()).data.session : null;
        if (session?.access_token && session.user) {
          postShareLogBg(w.key, channel, session.access_token);
          try {
            window.dispatchEvent(
              new CustomEvent("yeonun:daily-words-share-complete", {
                detail: { kstDate: formatKstDateKey(new Date()) },
              }),
            );
          } catch {
            /* ignore */
          }
        }
      } finally {
        shareBusyRef.current = false;
      }
    },
    [flashShareDone, postShareLogBg],
  );

  const onListenTts = useCallback(async (key: CharKey, text: string) => {
    const now = Date.now();
    const prev = ttsLastStartRef.current;
    if (prev && prev.key === key && now - prev.at < 280) return;
    ttsLastStartRef.current = { key, at: now };

    const id = ++playSeqRef.current;
    stopCartesiaWebPlayback();
    setTtsPlayingKey(key);
    await playCartesiaCharacterLine(key, text);
    if (playSeqRef.current === id) {
      setTtsPlayingKey(null);
    }
  }, []);

  const unlockHref =
    authed === true
      ? "/my?modal=saju"
      : "/my?modal=auth";

  return (
    <div id="today-daily-words" className="y-daily-words-section" aria-label="오늘의 한 마디">
      <div className="ySectionHead y-daily-words-head">
        <h2 className="ySectionTitle">
          <span className="hash">#</span> 오늘의 한 마디
        </h2>
        <span className="ySectionMore" style={{ cursor: "default" }}>
          {kstMd}
        </span>
      </div>

      {unlocked ? (
        <div className="y-daily-words-grid">
          {WORDS.map((w) => {
            const text = lineByKey[w.key] ?? w.text;
            const canWarmTts = dailyLinesReady;
            return (
              <div key={w.key} className="y-daily-word-card">
                <div className="y-dw-head">
                  <div className="y-dw-head-main">
                    <div className={`y-dw-avatar ${w.key}`}>{w.han}</div>
                    <div className="y-dw-name">{w.name}</div>
                  </div>
                  <button
                    type="button"
                    className={`y-dw-share${shareFlashKey === w.key ? " is-done" : ""}`}
                    aria-label={`${shortCharacterLabel(w.name)} 한 마디 공유`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onShareDailyWord(w, text);
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <circle cx="18" cy="5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="18" cy="19" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M8.2 13.4l6.6 3.8M15.8 6.8l-6.6 3.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                <div className="y-dw-text">{text}</div>
                <button
                  type="button"
                  className="y-dw-listen"
                  aria-label={`${w.name.replace("에게서", "")}의 한 마디 목소리로 듣기`}
                  aria-busy={ttsPlayingKey === w.key}
                  onPointerEnter={() => {
                    if (!canWarmTts) return;
                    touchCartesiaCharacterLineCache(w.key, text);
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    void onListenTts(w.key, text);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    void onListenTts(w.key, text);
                  }}
                  onClick={() => void onListenTts(w.key, text)}
                >
                  목소리로 듣기
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="y-daily-words-locked-wrap">
          <div className="y-daily-words-locked" aria-live="polite">
            <div className="y-daily-words-locked-hanja" aria-hidden="true">
              蓮 星 麗 雲
            </div>
            <p className="y-daily-words-locked-msg">
              <span className="y-daily-words-locked-line">4명의 한 마디는 사주 입력 후</span>
              <span className="y-daily-words-locked-line">당신만을 위해 작성됩니다</span>
            </p>
            <Link
              href={unlockHref}
              className="y-daily-words-unlock-btn"
              aria-busy={authed === null}
            >
              잠금 해제하기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
