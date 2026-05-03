"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useModalControls } from "@/components/modals/useModalControls";
import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import {
  chatConsultAppendMessages,
  chatConsultGetSession,
  chatConsultNewSession,
  type ChatConsultMessage,
  type ChatConsultSession,
} from "@/lib/chat-consult-archive";
import {
  CHAT_SESSION_OPENING_USER_PROMPT,
  chatConsultOpeningFor,
  readYeonunSajuJsonFromLocalStorage,
} from "@/lib/chat-consult-openings";
import { appendKstToManseContext } from "@/lib/datetime/kst";
import { formatUserManseFromYeonunSajuJson } from "@/lib/fortune-manse-context";
import { CREDIT_CHAT_PER_USER_MESSAGE } from "@/lib/credit-policy";
import { spendableTotalCredits, trySpendChatMessageCredits, YEONUN_CREDIT_UPDATE_EVENT } from "@/lib/credit-balance-local";

const CHAR_NAME: Record<string, string> = {
  yeon: "연화",
  byeol: "별하",
  yeo: "여연",
  un: "운서",
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildManseContextString(): string {
  const j = readYeonunSajuJsonFromLocalStorage();
  if (!j) return "";
  const block = formatUserManseFromYeonunSajuJson(j).trim();
  if (!block) return "";
  return appendKstToManseContext(block);
}

function tryAnthropicTextDelta(line: string, onText: (t: string) => void): void {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return;
  const data = trimmed.slice(5).trim();
  if (!data || data === "[DONE]") return;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return;
  }
  if (j.type === "error") {
    const msg = typeof j.error === "object" && j.error && typeof (j.error as { message?: string }).message === "string"
      ? (j.error as { message: string }).message
      : "요청 오류";
    throw new Error(msg);
  }
  if (j.type === "content_block_delta") {
    const delta = j.delta as Record<string, unknown> | undefined;
    if (delta?.type === "text_delta" && typeof delta.text === "string") onText(delta.text);
  }
}

export function ChatConsultModal() {
  const { close } = useModalControls();
  const router = useRouter();
  const sp = useSearchParams();

  const characterKey = sp.get("character_key") ?? "yeon";
  const resumeId = sp.get("chat_session") ?? "";
  const charName = CHAR_NAME[characterKey] ?? "연운";
  const charHan = useMemo(() => {
    const m: Record<string, string> = { yeon: "蓮", byeol: "星", yeo: "易", un: "運" };
    return m[characterKey] ?? "緣";
  }, [characterKey]);

  const [credits, setCredits] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatConsultMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatConsultMessage[]>([]);
  messagesRef.current = messages;
  /** LS에 아직 없는 신규 세션 껍데(첫 append 시 ensureSession으로 기록) */
  const pendingSessionRef = useRef<ChatConsultSession | null>(null);

  const refreshCredits = useCallback(() => setCredits(spendableTotalCredits()), []);

  /** 입력 가능(readOnly 아님)일 때만 포커스 + 캐럿 — busy일 땐 blur로 캐럿 없음 */
  const restoreInputCaret = useCallback(() => {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        const el = taRef.current;
        if (!el || el.disabled || el.readOnly) return;
        el.focus({ preventScroll: true });
        try {
          const n = el.value.length;
          el.setSelectionRange(n, n);
        } catch {
          /* 일부 환경에서 빈 값 등에서 무시 */
        }
      });
    });
  }, []);

  useEffect(() => {
    refreshCredits();
    const on = () => refreshCredits();
    window.addEventListener(YEONUN_CREDIT_UPDATE_EVENT, on);
    return () => window.removeEventListener(YEONUN_CREDIT_UPDATE_EVENT, on);
  }, [refreshCredits]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (resumeId) {
      pendingSessionRef.current = null;
      const s = chatConsultGetSession(resumeId);
      if (s && s.character_key === characterKey) {
        setSessionId(s.id);
        setMessages(s.messages);
        return;
      }
    }
    const s = chatConsultNewSession(characterKey);
    pendingSessionRef.current = s;
    setSessionId(s.id);
    setMessages(s.messages);
  }, [characterKey, resumeId]);

  /** 신규 세션: Claude 첫 인사 스트림 — 저장 시 입장 크레딧 1회 차감(유저 메시지 없이 나가도 소진) */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionId || resumeId) return;
    const s0 =
      chatConsultGetSession(sessionId) ??
      (pendingSessionRef.current?.id === sessionId ? pendingSessionRef.current : null);
    if (!s0 || s0.messages.some((m) => m.role === "assistant")) return;

    let cancelled = false;
    const ac = new AbortController();

    const persistOpening = (asstId: string, finalBody: string): boolean => {
      const spent = trySpendChatMessageCredits(CREDIT_CHAT_PER_USER_MESSAGE);
      if (!spent) {
        setStreamError("크레딧이 부족해요.");
        return false;
      }
      const hid = uid();
      const now = new Date().toISOString();
      const triggerMsg: ChatConsultMessage = {
        id: hid,
        role: "user",
        body: CHAT_SESSION_OPENING_USER_PROMPT,
        created_at: now,
        ui_hidden: true,
      };
      const assistantMsg: ChatConsultMessage = {
        id: asstId,
        role: "assistant",
        body: finalBody,
        created_at: now,
      };
      chatConsultAppendMessages(sessionId, [triggerMsg, assistantMsg], CREDIT_CHAT_PER_USER_MESSAGE, {
        ensureSession: pendingSessionRef.current?.id === sessionId ? pendingSessionRef.current : undefined,
      });
      if (pendingSessionRef.current?.id === sessionId) pendingSessionRef.current = null;
      setMessages(chatConsultGetSession(sessionId)?.messages ?? []);
      refreshCredits();
      return true;
    };

    (async () => {
      if (spendableTotalCredits() < CREDIT_CHAT_PER_USER_MESSAGE) {
        setStreamError("첫 인사를 받으려면 크레딧이 필요해요.");
        return;
      }
      setBusy(true);
      setTyping(true);
      setStreamError(null);
      const manse = buildManseContextString();
      const apiMessages = [{ role: "user" as const, content: CHAT_SESSION_OPENING_USER_PROMPT }];
      const asstId = uid();
      let acc = "";
      let asstPlaced = false;
      const pushDelta = (t: string) => {
        if (cancelled) return;
        acc += t;
        if (!asstPlaced) {
          asstPlaced = true;
          setMessages((prev) => [
            ...prev,
            { id: asstId, role: "assistant", body: acc, created_at: new Date().toISOString() },
          ]);
        } else {
          setMessages((prev) => {
            const i = prev.findIndex((m) => m.id === asstId);
            if (i < 0) return prev;
            const next = prev.slice();
            next[i] = { ...next[i], body: acc };
            return next;
          });
        }
      };

      try {
        const res = await fetch("/api/chat/consult-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character_key: characterKey,
            manse_context: manse || undefined,
            messages: apiMessages,
          }),
          signal: ac.signal,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(typeof (j as { error?: string }).error === "string" ? (j as { error: string }).error : "응답을 불러오지 못했어요.");
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("스트림을 열 수 없습니다.");

        const dec = new TextDecoder();
        let lineBuf = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          lineBuf += dec.decode(value, { stream: true });
          for (;;) {
            const nl = lineBuf.indexOf("\n");
            if (nl < 0) break;
            const line = lineBuf.slice(0, nl);
            lineBuf = lineBuf.slice(nl + 1);
            tryAnthropicTextDelta(line, pushDelta);
          }
        }
        if (!cancelled && lineBuf.trim()) tryAnthropicTextDelta(lineBuf, pushDelta);
      } catch (e) {
        if (cancelled || (e as Error).name === "AbortError") return;
        setStreamError(e instanceof Error ? e.message : "오류가 났어요.");
        setMessages((prev) => prev.filter((m) => m.id !== asstId));
        const fallback = chatConsultOpeningFor(characterKey, readYeonunSajuJsonFromLocalStorage());
        persistOpening(uid(), fallback);
        setTyping(false);
        setBusy(false);
        return;
      }

      if (cancelled) {
        setMessages((prev) => prev.filter((m) => m.id !== asstId));
        setTyping(false);
        setBusy(false);
        return;
      }

      setTyping(false);
      const finalBody = acc.trim() || chatConsultOpeningFor(characterKey, readYeonunSajuJsonFromLocalStorage());
      if (!finalBody) {
        setMessages((prev) => prev.filter((m) => m.id !== asstId));
        setBusy(false);
        return;
      }
      if (!persistOpening(asstId, finalBody)) {
        setMessages((prev) => prev.filter((m) => m.id !== asstId));
      }
      setBusy(false);
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [sessionId, resumeId, characterKey, refreshCredits]);

  const shortBalance = credits < CREDIT_CHAT_PER_USER_MESSAGE;
  const needMore = Math.max(0, CREDIT_CHAT_PER_USER_MESSAGE - credits);

  const resizeTa = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 22 * 4;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  };

  useEffect(() => {
    resizeTa();
  }, [input]);

  useLayoutEffect(() => {
    if (busy) {
      taRef.current?.blur();
      return;
    }
    if (shortBalance || typing) return;
    restoreInputCaret();
  }, [sessionId, shortBalance, busy, typing, restoreInputCaret]);

  /** 긴 대화·스트리밍 시 스레드가 맨 아래를 따라가도록 */
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, typing, busy]);

  const openCharge = () => {
    close();
    router.push("/checkout/credit");
  };

  const send = async () => {
    const text = input.replace(/\r\n/g, "\n").trim();
    if (!text || busy || !sessionId) return;
    if (credits < CREDIT_CHAT_PER_USER_MESSAGE) return;

    setStreamError(null);
    setBusy(true);
    setTyping(true);

    const userMsg: ChatConsultMessage = {
      id: uid(),
      role: "user",
      body: text,
      created_at: new Date().toISOString(),
    };
    const asstId = uid();
    setInput("");
    setMessages((prev) => [...prev, userMsg]);

    const manse = buildManseContextString();
    const history = [...messagesRef.current, userMsg]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-500);
    const apiMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.body,
    }));

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    let acc = "";
    let asstPlaced = false;
    try {
      const res = await fetch("/api/chat/consult-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_key: characterKey,
          manse_context: manse || undefined,
          messages: apiMessages,
        }),
        signal: ac.signal,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof (j as { error?: string }).error === "string" ? (j as { error: string }).error : "응답을 불러오지 못했어요.");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("스트림을 열 수 없습니다.");

      const dec = new TextDecoder();
      let lineBuf = "";
      const pushDelta = (t: string) => {
        acc += t;
        if (!asstPlaced) {
          asstPlaced = true;
          setMessages((prev) => [
            ...prev,
            { id: asstId, role: "assistant", body: acc, created_at: new Date().toISOString() },
          ]);
        } else {
          setMessages((prev) => {
            const i = prev.findIndex((m) => m.id === asstId);
            if (i < 0) return prev;
            const next = prev.slice();
            next[i] = { ...next[i], body: acc };
            return next;
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuf += dec.decode(value, { stream: true });
        for (;;) {
          const nl = lineBuf.indexOf("\n");
          if (nl < 0) break;
          const line = lineBuf.slice(0, nl);
          lineBuf = lineBuf.slice(nl + 1);
          tryAnthropicTextDelta(line, pushDelta);
        }
      }
      if (lineBuf.trim()) tryAnthropicTextDelta(lineBuf, pushDelta);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setBusy(false);
        setTyping(false);
        return;
      }
      setStreamError(e instanceof Error ? e.message : "오류가 났어요.");
      setMessages((prev) => prev.filter((m) => m.id !== asstId && m.id !== userMsg.id));
      setBusy(false);
      setTyping(false);
      return;
    }

    setTyping(false);

    const finalBody = acc.trim();
    if (!finalBody) {
      setMessages((prev) => prev.filter((m) => m.id !== asstId && m.id !== userMsg.id));
      setBusy(false);
      return;
    }

    const spent = trySpendChatMessageCredits(CREDIT_CHAT_PER_USER_MESSAGE);
    if (!spent) {
      setStreamError("크레딧이 부족해요.");
      setMessages((prev) => prev.filter((m) => m.id !== asstId && m.id !== userMsg.id));
      setBusy(false);
      return;
    }

    const assistantMsg: ChatConsultMessage = {
      id: asstId,
      role: "assistant",
      body: finalBody,
      created_at: new Date().toISOString(),
    };
    chatConsultAppendMessages(sessionId, [userMsg, assistantMsg], CREDIT_CHAT_PER_USER_MESSAGE, {
      ensureSession: pendingSessionRef.current?.id === sessionId ? pendingSessionRef.current : undefined,
    });
    if (pendingSessionRef.current?.id === sessionId) pendingSessionRef.current = null;
    refreshCredits();
    setBusy(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <YeonunSheetPortal>
    <div className="y-modal open y-chat-consult-root" role="dialog" aria-modal="true" aria-label="채팅 상담" onMouseDown={close}>
      <div className="y-modal-sheet y-chat-consult-sheet" onMouseDown={(ev) => ev.stopPropagation()}>
        <div className="y-modal-handle" />
        <header className="y-chat-consult-head">
          <div className={`y-chat-consult-avatar ${characterKey}`} aria-hidden>
            {charHan}
          </div>
          <div className="y-chat-consult-head-text">
            <div className="y-chat-consult-title">
              {charName}
              <span className="y-chat-consult-title-sub">채팅 상담</span>
            </div>
            <div className="y-chat-consult-credit">잔여 {credits.toLocaleString("ko-KR")} 크레딧</div>
          </div>
          <button className="y-modal-close" type="button" onClick={close} aria-label="닫기">
            ×
          </button>
        </header>

        <div ref={threadRef} className="y-chat-consult-thread" role="log" aria-live="polite">
          {messages.map((m) => {
            if (m.role === "system") {
              return (
                <div key={m.id} className="y-chat-consult-system">
                  {m.body}
                </div>
              );
            }
            if (m.role === "user") {
              if (m.ui_hidden) return null;
              return (
                <div key={m.id} className="y-chat-consult-row user">
                  <div className="y-chat-consult-bubble user">{m.body}</div>
                </div>
              );
            }
            return (
              <div key={m.id} className="y-chat-consult-row assistant">
                <div className="y-chat-consult-bubble assistant">{m.body}</div>
              </div>
            );
          })}
          {typing ? (
            <div className="y-chat-consult-row assistant" aria-hidden>
              <div className="y-chat-consult-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
        </div>

        {streamError ? <div className="y-chat-consult-err">{streamError}</div> : null}

        <footer className="y-chat-consult-foot">
          {shortBalance ? (
            <div className="y-chat-consult-low">
              <p>
                크레딧이 부족해요. {needMore.toLocaleString("ko-KR")} 크레딧이 필요해요.
              </p>
              <button type="button" className="y-chat-consult-charge-btn" onClick={openCharge}>
                크레딧 충전하기
              </button>
            </div>
          ) : null}
          <div className="y-chat-consult-input-row">
            <textarea
              ref={taRef}
              className="y-chat-consult-ta"
              rows={1}
              maxLength={4000}
              placeholder="메시지를 입력하세요..."
              value={input}
              readOnly={busy}
              disabled={shortBalance}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              className="y-chat-consult-send"
              aria-label="전송"
              disabled={busy || shortBalance || !input.trim()}
              onClick={() => {
                void send();
              }}
            >
              <svg className="y-chat-consult-send-icon" viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </footer>
      </div>
    </div>
    </YeonunSheetPortal>
  );
}
