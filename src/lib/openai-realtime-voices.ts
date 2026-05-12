/** OpenAI Realtime(gpt-realtime-2) 내장 출력 보이스 — `tts_voices.external_id`에 그대로 저장 */
export type OpenAiRealtimeVoiceId =
  | "alloy"
  | "ash"
  | "ballad"
  | "coral"
  | "echo"
  | "sage"
  | "shimmer"
  | "verse"
  | "marin"
  | "cedar";

export type OpenAiRealtimeVoiceRow = {
  id: OpenAiRealtimeVoiceId;
  labelKo: string;
  vibeKo: string;
  /** UI/통계용 */
  gender: "female" | "male" | "other";
  sort_order: number;
};

export const OPENAI_REALTIME_VOICE_CATALOG: OpenAiRealtimeVoiceRow[] = [
  { id: "alloy", labelKo: "Alloy", vibeKo: "중립적", gender: "other", sort_order: 10 },
  { id: "ash", labelKo: "Ash", vibeKo: "감정표현 강함", gender: "other", sort_order: 20 },
  { id: "ballad", labelKo: "Ballad", vibeKo: "부드럽고 스토리텔링 느낌", gender: "female", sort_order: 30 },
  { id: "coral", labelKo: "Coral", vibeKo: "밝고 친근", gender: "female", sort_order: 40 },
  { id: "echo", labelKo: "Echo", vibeKo: "따뜻함", gender: "male", sort_order: 50 },
  { id: "sage", labelKo: "Sage", vibeKo: "성숙하고 안정적", gender: "female", sort_order: 60 },
  { id: "shimmer", labelKo: "Shimmer", vibeKo: "energetic", gender: "female", sort_order: 70 },
  { id: "verse", labelKo: "Verse", vibeKo: "표현력 강함", gender: "other", sort_order: 80 },
  { id: "marin", labelKo: "Marin", vibeKo: "가장 자연스러운 축", gender: "female", sort_order: 90 },
  { id: "cedar", labelKo: "Cedar", vibeKo: "conversational 최강 축", gender: "male", sort_order: 100 },
];

const ALLOWED = new Set<string>(OPENAI_REALTIME_VOICE_CATALOG.map((r) => r.id));

export function isOpenAiRealtimeVoiceId(v: string): v is OpenAiRealtimeVoiceId {
  return ALLOWED.has(String(v || "").trim());
}

export function normalizeOpenAiRealtimeVoice(v: string | null | undefined): OpenAiRealtimeVoiceId {
  const t = String(v ?? "").trim();
  if (isOpenAiRealtimeVoiceId(t)) return t;
  return "marin";
}

export const OPENAI_REALTIME_MODEL = "gpt-realtime-2" as const;
