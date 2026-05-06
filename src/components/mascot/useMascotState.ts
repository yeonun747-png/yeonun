"use client";

/**
 * 서비스에서 이벤트 발행 예시 (window CustomEvent):
 *
 * window.dispatchEvent(new CustomEvent("fortuneStart", { detail: { product: "재회비책" } }));
 * window.dispatchEvent(new CustomEvent("fortuneComplete"));
 * window.dispatchEvent(new CustomEvent("creditLow"));
 * window.dispatchEvent(new CustomEvent("attendanceComplete"));
 * window.dispatchEvent(new CustomEvent("tabChange", { detail: { tab: "content" } }));
 * // tab: "today" | "meet" | "content" | "my"
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { YEON, UN } from "./mascotAssets";

export type MascotHandle = {
  playClip: (clipName: string, loop: boolean) => void;
  /** 운이: 야간 Idle_3 감속 */
  setIdleTimeScale: (scale: number) => void;
};

export type BubblePayload = { text: string; durationMs: number; key: number };

type MascotCtx = {
  yeonRef: MutableRefObject<MascotHandle | null>;
  unRef: MutableRefObject<MascotHandle | null>;
  sayYeon: (text: string, durationMs: number) => void;
  sayUn: (text: string, durationMs: number) => void;
  hideYeonBubble: () => void;
  hideUnBubble: () => void;
  yeonBubble: BubblePayload | null;
  unBubble: BubblePayload | null;
  allowMouseFollow: boolean;
  isNight: boolean;
};

const Ctx = createContext<MascotCtx | null>(null);

function isNightNow() {
  const h = new Date().getHours();
  return h >= 22 || h < 6;
}

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
}

function isLowEndDevice() {
  if (typeof navigator === "undefined") return false;
  const n = navigator.hardwareConcurrency;
  return typeof n === "number" && n > 0 && n <= 4;
}

export function MascotStateProvider({ children }: { children: ReactNode }) {
  const yeonRef = useRef<MascotHandle | null>(null);
  const unRef = useRef<MascotHandle | null>(null);
  const [yeonBubble, setYeonBubble] = useState<BubblePayload | null>(null);
  const [unBubble, setUnBubble] = useState<BubblePayload | null>(null);
  const bubbleKey = useRef(0);

  const [allowMouseFollow, setAllowMouseFollow] = useState(
    () => typeof window !== "undefined" && !isTouchDevice() && !isLowEndDevice(),
  );
  const [isNight] = useState(() => isNightNow());

  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 480px)") : null;
    const onChange = () => setAllowMouseFollow(!isTouchDevice() && !isLowEndDevice());
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  const sayYeon = useCallback((text: string, durationMs: number) => {
    bubbleKey.current += 1;
    setYeonBubble({ text, durationMs, key: bubbleKey.current });
  }, []);

  const sayUn = useCallback((text: string, durationMs: number) => {
    bubbleKey.current += 1;
    setUnBubble({ text, durationMs, key: bubbleKey.current });
  }, []);

  const hideYeonBubble = useCallback(() => setYeonBubble(null), []);
  const hideUnBubble = useCallback(() => {
    setUnBubble(null);
    if (isNight) {
      queueMicrotask(() => {
        bubbleKey.current += 1;
        setUnBubble({ text: "...zZZ", durationMs: 0, key: bubbleKey.current });
      });
    }
  }, [isNight]);

  useEffect(() => {
    const idleScaleNight = isNight ? 0.5 : 1;
    unRef.current?.setIdleTimeScale(idleScaleNight);
  }, [isNight]);

  useEffect(() => {
    // 1~2. Idle는 각 캐릭터 마운트 시 처리
    // 3. 마우스 팔로우는 MascotYeon 내부
    // 4~6. 아래 리스너 + 클릭은 MascotScene 오버레이
    // 7~8. 인사 말풍선
    const t7 = window.setTimeout(() => {
      sayYeon("안녕하세요! 저 연이에요 🌸", 3000);
    }, 3000);
    const t8 = window.setTimeout(() => {
      if (!isNightNow()) sayUn("...✨", 2000);
    }, 5000);

    const onFortuneStart = (ev: Event) => {
      const d = (ev as CustomEvent<{ product?: string }>).detail;
      const product = d?.product ?? "풀이";
      yeonRef.current?.playClip(YEON.thinking, false);
      unRef.current?.playClip(UN.idle, true);
      sayYeon(`${product} 풀이를 읽고 있어요 🌸`, 0);
    };

    const onFortuneComplete = () => {
      hideYeonBubble();
      yeonRef.current?.playClip(YEON.happy, false);
      unRef.current?.playClip(UN.happy, false);
      sayYeon("다 됐어요! 확인해보세요 💗", 3000);
      sayUn("✨", 2000);
    };

    const onCreditLow = () => {
      yeonRef.current?.playClip(YEON.thinking, true);
      sayYeon("크레딧이 부족해요! 충전하러 가요 →", 4000);
    };

    const onAttendanceComplete = () => {
      yeonRef.current?.playClip(YEON.dance, false);
      unRef.current?.playClip(UN.dance, false);
      sayYeon("출석 완료! 보상이 적립됐어요 🌸", 3000);
    };

    const onTabChange = (ev: Event) => {
      const tab = (ev as CustomEvent<{ tab?: string }>).detail?.tab;
      const map: Record<string, string> = {
        today: "오늘 일진 확인하셨나요? 🌸",
        meet: "어떤 안내자와 이야기 나눠볼까요?",
        content: "풀이 받아보실 거예요? 같이 봐요!",
        my: "보관함에 소중한 풀이들이 있어요 💗",
      };
      if (tab && map[tab]) sayYeon(map[tab], 3000);
    };

    window.addEventListener("fortuneStart", onFortuneStart);
    window.addEventListener("fortuneComplete", onFortuneComplete);
    window.addEventListener("creditLow", onCreditLow);
    window.addEventListener("attendanceComplete", onAttendanceComplete);
    window.addEventListener("tabChange", onTabChange);

    return () => {
      window.clearTimeout(t7);
      window.clearTimeout(t8);
      window.removeEventListener("fortuneStart", onFortuneStart);
      window.removeEventListener("fortuneComplete", onFortuneComplete);
      window.removeEventListener("creditLow", onCreditLow);
      window.removeEventListener("attendanceComplete", onAttendanceComplete);
      window.removeEventListener("tabChange", onTabChange);
    };
  }, [hideYeonBubble, sayUn, sayYeon]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (isNight) sayUn("...zZZ", 0);
      else hideUnBubble();
    });
    return () => cancelAnimationFrame(id);
  }, [hideUnBubble, isNight, sayUn]);

  const value = useMemo(
    () => ({
      yeonRef,
      unRef,
      sayYeon,
      sayUn,
      hideYeonBubble,
      hideUnBubble,
      yeonBubble,
      unBubble,
      allowMouseFollow,
      isNight,
    }),
    [allowMouseFollow, hideUnBubble, hideYeonBubble, isNight, sayUn, sayYeon, unBubble, yeonBubble],
  );

  /* refs in context are imperative handles; not read during render by consumers */
  // eslint-disable-next-line react-hooks/refs -- stable ref objects for MascotYeon/MascotUn imperative API
  return createElement(Ctx.Provider, { value }, children);
}

export function useMascotState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMascotState must be used within MascotStateProvider");
  return v;
}
