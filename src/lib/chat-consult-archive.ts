import { CREDIT_CHAT_PER_USER_MESSAGE } from "@/lib/credit-policy";

const LS = "yeonun_chat_consult_sessions_v1";

export type ChatConsultMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  body: string;
  created_at: string;
  /** true면 채팅 UI에만 숨김(API 히스토리·Claude 순서 유지용) */
  ui_hidden?: boolean;
};

export type ChatConsultSession = {
  id: string;
  character_key: string;
  topic_tag: string;
  last_preview: string;
  message_count: number;
  credits_used: number;
  updated_at: string;
  messages: ChatConsultMessage[];
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const RETENTION_MS = 30 * 86400000;

function loadAll(): ChatConsultSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS);
    const arr = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(arr)) return [];
    const list = arr.filter(Boolean) as ChatConsultSession[];
    const now = Date.now();
    const kept = list.filter((s) => {
      const t = Date.parse(s.updated_at);
      return Number.isFinite(t) && now - t < RETENTION_MS;
    });
    if (kept.length !== list.length) {
      try {
        localStorage.setItem(LS, JSON.stringify(kept));
      } catch {
        /* ignore */
      }
    }
    return kept;
  } catch {
    return [];
  }
}

function saveAll(list: ChatConsultSession[]) {
  try {
    localStorage.setItem(LS, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function chatConsultListSessions(): ChatConsultSession[] {
  chatConsultPruneEmptySessions();
  return loadAll()
    .slice()
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

/** 마지막 활동 기준 보관 만료 시각(ms) */
export function chatConsultExpiresAtMs(session: ChatConsultSession): number {
  const t = Date.parse(session.updated_at);
  if (!Number.isFinite(t)) return Date.now() + RETENTION_MS;
  return t + RETENTION_MS;
}

export function chatConsultGetSession(id: string): ChatConsultSession | null {
  return loadAll().find((s) => s.id === id) ?? null;
}

/** 목록·요약용: 화면에 나오는 유저(숨김 제외)·어시스턴트 말풍선 수 */
export function chatConsultThreadPublicCount(s: ChatConsultSession): number {
  return s.messages.filter((m) => (m.role === "user" && !m.ui_hidden) || m.role === "assistant").length;
}

/** 미리보기 문자열: 저장된 last_preview가 비었으면 마지막 대화 턴에서 유도 */
export function chatConsultListPreview(s: ChatConsultSession): string {
  const p = (s.last_preview ?? "").trim();
  if (p) return p.slice(0, 80);
  const last = [...s.messages].reverse().find((m) => (m.role === "user" && !m.ui_hidden) || m.role === "assistant");
  return (last?.body ?? "").trim().slice(0, 80);
}

/** 아직 한 턴도 저장되지 않은 빈 껍데 세션(예: 모달만 열고 닫음) — 보관함에서 제거 */
export function chatConsultPruneEmptySessions(): number {
  const all = loadAll();
  const kept = all.filter((s) => chatConsultThreadPublicCount(s) > 0 || s.credits_used > 0);
  const removed = all.length - kept.length;
  if (removed > 0) saveAll(kept);
  return removed;
}

/** LS에 쓰지 않고 메모리용 세션 객체만 만듦. 첫 `chatConsultAppendMessages`에 `ensureSession`으로 넘겨야 보관됨 */
export function chatConsultNewSession(characterKey: string): ChatConsultSession {
  return {
    id: uid(),
    character_key: characterKey,
    topic_tag: "채팅 상담",
    last_preview: "",
    message_count: 0,
    credits_used: 0,
    updated_at: new Date().toISOString(),
    messages: [
      {
        id: uid(),
        role: "system",
        body: `입장 시·보낸 메시지마다 각 ${CREDIT_CHAT_PER_USER_MESSAGE} 크레딧 차감`,
        created_at: new Date().toISOString(),
      },
    ],
  };
}

/** @deprecated 첫 대화 저장 전 LS에 빈 행이 생겨 보관함이 지저분해짐. `chatConsultNewSession` + 첫 append만 사용 */
export function chatConsultCreateSession(characterKey: string): ChatConsultSession {
  const s = chatConsultNewSession(characterKey);
  const all = loadAll();
  all.unshift(s);
  saveAll(all);
  return s;
}

export function chatConsultUpsertSession(next: ChatConsultSession) {
  const all = loadAll().filter((s) => s.id !== next.id);
  all.unshift(next);
  saveAll(all);
}

export function chatConsultAppendMessages(
  sessionId: string,
  msgs: ChatConsultMessage[],
  extraCredits: number,
  opts?: { ensureSession?: ChatConsultSession },
) {
  chatConsultPruneEmptySessions();
  const all = loadAll();
  let idx = all.findIndex((s) => s.id === sessionId);
  if (idx < 0) {
    const es = opts?.ensureSession;
    if (!es || es.id !== sessionId) return;
    all.unshift(es);
    idx = all.findIndex((s) => s.id === sessionId);
    if (idx < 0) return;
  }
  const s = all[idx];
  const messages = [...s.messages, ...msgs];
  const userAdds = msgs.filter((m) => m.role === "user" && !m.ui_hidden).length;
  const lastUser = [...messages].reverse().find((m) => m.role === "user" && !m.ui_hidden);
  const lastAsst = [...messages].reverse().find((m) => m.role === "assistant");
  const previewFrom = lastUser?.body?.trim() || lastAsst?.body?.trim() || "";
  const next: ChatConsultSession = {
    ...s,
    messages,
    message_count: s.message_count + userAdds,
    credits_used: s.credits_used + extraCredits,
    last_preview: previewFrom ? previewFrom.slice(0, 80) : s.last_preview,
    updated_at: new Date().toISOString(),
  };
  all.splice(idx, 1);
  all.unshift(next);
  saveAll(all);
}
