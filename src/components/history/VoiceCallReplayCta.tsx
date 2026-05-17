"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

const VOICE_BRIEF_KEY = "yeonun_fortune_voice_brief";

export function VoiceCallReplayCta({
  characterKey,
  characterName,
  voiceBrief,
}: {
  characterKey: string;
  characterName: string;
  voiceBrief: string;
}) {
  const router = useRouter();

  const onConsult = useCallback(() => {
    const brief = voiceBrief.trim();
    if (brief) {
      try {
        sessionStorage.setItem(
          VOICE_BRIEF_KEY,
          JSON.stringify({
            summary: `[이전 음성 상담 주제]\n${brief}`,
            title: `${characterName}와 음성 상담`,
            character_key: characterKey,
            ts: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
    }
    router.push(`/call-dcc?character_key=${encodeURIComponent(characterKey)}`);
  }, [characterKey, characterName, voiceBrief, router]);

  return (
    <button type="button" className="y-tchat-detail-cta" onClick={onConsult}>
      이 주제로 다시 상담하기 →
    </button>
  );
}
