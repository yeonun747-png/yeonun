"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { YEONUN_AUTH_SESSION_CHANGED } from "@/lib/auth-session-events";

import { syncProfileFromServer } from "@/lib/profile-sync-from-api";
import { supabaseBrowser } from "@/lib/supabase/client";

export type YeonunAuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Supabase 미설정 등으로 클라이언트 세션 사용 불가 */
  authUnavailable: boolean;
};

const YeonunAuthContext = createContext<YeonunAuthContextValue | null>(null);

export function YeonunAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUnavailable, setAuthUnavailable] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setAuthUnavailable(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void sb.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) {
        setSession(s);
        setLoading(false);
        const tok = s?.access_token;
        if (tok) void syncProfileFromServer(tok);
      }
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      const tok = s?.access_token;
      if (tok) void syncProfileFromServer(tok);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      authUnavailable,
    }),
    [session, loading, authUnavailable],
  );

  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent(YEONUN_AUTH_SESSION_CHANGED));
    } catch {
      /* ignore */
    }
  }, [session?.user?.id]);

  return <YeonunAuthContext.Provider value={value}>{children}</YeonunAuthContext.Provider>;
}

export function useYeonunAuth(): YeonunAuthContextValue {
  const ctx = useContext(YeonunAuthContext);
  if (!ctx) throw new Error("useYeonunAuth requires YeonunAuthProvider");
  return ctx;
}

/** 로딩 중에는 게스트로 취급 */
export function useYeonunMember(): boolean {
  const { user, loading } = useYeonunAuth();
  return !loading && !!user;
}
