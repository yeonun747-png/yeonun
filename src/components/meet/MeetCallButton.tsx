"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { clearSheetBackdropSnapshot } from "@/components/my/MySheetBackdropFrame";

type Props = {
  characterKey: string;
  className?: string;
  children: React.ReactNode;
  /** 홈·만남 인터셉트 시트 위에서 — 전체 화면 /call-dcc 로 hard navigate */
  fullPageTransition?: boolean;
};

const UNLOCK_KEY = "yeonun_voice_unlocked_v1";

async function warmupAudioAndMic() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      await ctx.resume?.();
      ctx.close?.();
    }
  } catch {
    // ignore
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    // ignore
  }
}

/** 비회원 3분 무료·크레딧 안내는 /call-dcc 화면에서 처리(채팅 상담과 동일) */
export function MeetCallButton({ characterKey, className, children, fullPageTransition = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const goCall = async () => {
    if (busy) return;
    setBusy(true);
    try {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      await warmupAudioAndMic();
      const href = `/call-dcc?character_key=${encodeURIComponent(characterKey)}`;
      if (fullPageTransition) {
        clearSheetBackdropSnapshot();
        window.location.assign(href);
        return;
      }
      router.push(href);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={className} onClick={() => void goCall()} disabled={busy}>
      {children}
    </button>
  );
}

export const __YEONUN_VOICE_UNLOCK_KEY__ = UNLOCK_KEY;
