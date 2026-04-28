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
  // 1) 오디오 컨텍스트 언락 (일부 브라우저에서 필요)
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      await ctx.resume?.();
      // 즉시 닫아도 “사용자 제스처”를 통한 언락은 남는다.
      ctx.close?.();
    }
  } catch {
    // ignore
  }

  // 2) 마이크 권한 선요청 (call 입장 후 추가 터치 없이 STT/바지인 가능하게)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    // ignore (권한 거부 시 call에서 다시 안내)
  }
}

export function MeetCallButton({ characterKey, className, children }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      await warmupAudioAndMic();
    } finally {
      // 이동은 항상 수행
      router.push(`/call?character_key=${encodeURIComponent(characterKey)}`);
      setBusy(false);
    }
  };

  return (
    <button type="button" className={className} onClick={onClick} disabled={busy}>
      {children}
    </button>
  );
}

export const __YEONUN_VOICE_UNLOCK_KEY__ = UNLOCK_KEY;

