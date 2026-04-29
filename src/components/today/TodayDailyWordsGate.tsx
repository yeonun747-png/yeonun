"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import Link from "next/link";

import { __YEONUN_SAJU_STORAGE_KEY__ } from "@/components/my/MySajuCardClient";
import {
  readAuthStubLoggedIn,
  YEONUN_AUTH_STUB_EVENT,
  YEONUN_AUTH_STUB_KEY,
} from "@/lib/auth-stub";
import { playCartesiaCharacterLine, stopCartesiaWebPlayback } from "@/lib/tts/cartesiaWebPlayer";
import { supabaseBrowser } from "@/lib/supabase/client";

const SAJU_UPDATED = "yeonun:saju-updated";

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

const WORDS = [
  { key: "yeon", han: "蓮", name: "연화에게서", text: "그 사람도 오늘 같은 마음이에요. 먼저 다가갈 필요는 없지만, 닫지도 말아요." },
  { key: "byeol", han: "星", name: "별하에게서", text: "오늘 별의 자리가 흔들려요. 큰 결정은 내일로 미뤄도 늦지 않아요." },
  { key: "yeo", han: "麗", name: "여연에게서", text: "오늘은 듣는 날입니다. 답은 그다음에 옵니다." },
  { key: "un", han: "雲", name: "운서에게서", text: "오늘 본 꿈, 잊지 마세요. 한 글자씩 적어두면 사주의 흐름이 보여요." },
] as const;

type CharKey = (typeof WORDS)[number]["key"];

/** 옵션 B: 로그인 + 사주 입력까지 완료해야 해금 */
export function TodayDailyWordsGate({ kstMd }: { kstMd: string }) {
  const [hasSaju, setHasSaju] = useState(false);
  /** null = 세션 확인 중 */
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [ttsPlayingKey, setTtsPlayingKey] = useState<CharKey | null>(null);
  const playSeqRef = useRef(0);

  const syncSaju = () => setHasSaju(readHasValidSaju());

  useLayoutEffect(() => {
    syncSaju();
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

    const onSaju = () => syncSaju();
    window.addEventListener(SAJU_UPDATED, onSaju);

    const onStorage = (e: StorageEvent) => {
      if (e.key === __YEONUN_SAJU_STORAGE_KEY__) syncSaju();
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

  const onListenTts = useCallback(async (key: CharKey, text: string) => {
    const id = ++playSeqRef.current;
    stopCartesiaWebPlayback();
    setTtsPlayingKey(key);
    await playCartesiaCharacterLine(key, text);
    if (playSeqRef.current === id) {
      setTtsPlayingKey(null);
    }
  }, []);

  const unlocked = authed === true && hasSaju;

  const unlockHref =
    authed === true
      ? "/my?modal=saju"
      : "/my?modal=auth";

  return (
    <div className="y-daily-words-section" aria-label="오늘의 한 마디">
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
          {WORDS.map((w) => (
            <div key={w.key} className="y-daily-word-card">
              <div className="y-dw-head">
                <div className={`y-dw-avatar ${w.key}`}>{w.han}</div>
                <div className="y-dw-name">{w.name}</div>
              </div>
              <div className="y-dw-text">{w.text}</div>
              <button
                type="button"
                className="y-dw-listen"
                aria-label={`${w.name.replace("에게서", "")}의 한 마디 목소리로 듣기`}
                aria-busy={ttsPlayingKey === w.key}
                onClick={() => void onListenTts(w.key, w.text)}
              >
                목소리로 듣기
              </button>
            </div>
          ))}
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
