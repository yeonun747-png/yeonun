"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  characterKey: string;
  className?: string;
  children: React.ReactNode;
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

/** 비회원도 첫 3분 무료 음성 상담 진입 가능(/call-dcc에서 시간 제한). */
export function MeetCallButton({ characterKey, className, children }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const goCall = async () => {
    if (busy) return;
    setBusy(true);
    try {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      await warmupAudioAndMic();
      router.push(`/call-dcc?character_key=${encodeURIComponent(characterKey)}`);
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
