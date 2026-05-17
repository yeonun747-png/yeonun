"use client";

import { useRouter } from "next/navigation";

import {
  CREDIT_VOICE_MIN_TO_START,
  voiceConsultCreditsShortfall,
} from "@/lib/voice-consult-credit-gate";

type Props = {
  className?: string;
  onBack?: () => void;
};

/** 채팅 상담 `y-chat-consult-low`와 동일한 크레딧 부족 안내 */
export function VoiceConsultCreditGate({ className = "", onBack }: Props) {
  const router = useRouter();
  const needMore = voiceConsultCreditsShortfall();

  return (
    <div className={`y-voice-credit-gate ${className}`.trim()} role="alert">
      <p className="y-voice-credit-gate-text">
        크레딧이 부족해요. {(needMore > 0 ? needMore : CREDIT_VOICE_MIN_TO_START).toLocaleString("ko-KR")}
        크레딧이 필요해요.
      </p>
      <button
        type="button"
        className="y-chat-consult-charge-btn"
        onClick={() => router.push("/checkout/credit")}
      >
        크레딧 충전하기
      </button>
      {onBack ? (
        <button type="button" className="y-voice-credit-gate-back" onClick={onBack}>
          돌아가기
        </button>
      ) : null}
    </div>
  );
}
