import { getOrCreateVoiceVisitorRef } from "@/lib/voice-visitor-ref";

/** 로그인 회원은 auth UUID, 비로그인은 단말 visitor ref */
export function resolveVoiceUserRef(authUserId: string | null | undefined): string {
  const uid = String(authUserId ?? "").trim();
  if (uid) return uid;
  return getOrCreateVoiceVisitorRef();
}
