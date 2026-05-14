"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { readAuthStubLoggedIn, YEONUN_AUTH_STUB_EVENT } from "@/lib/auth-stub";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  characterKey: string;
  className?: string;
  children: React.ReactNode;
};

function useLoggedInClient() {
  const [loggedIn, setLoggedIn] = useState(() => readAuthStubLoggedIn());

  const refresh = useCallback(async () => {
    if (readAuthStubLoggedIn()) {
      setLoggedIn(true);
      return;
    }
    const sb = supabaseBrowser();
    const session = sb ? (await sb.auth.getSession()).data.session : null;
    setLoggedIn(Boolean(session?.access_token));
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      void refresh();
    });
    window.addEventListener(YEONUN_AUTH_STUB_EVENT, refresh);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener(YEONUN_AUTH_STUB_EVENT, refresh);
    };
  }, [refresh]);

  return loggedIn;
}

export function MeetChatButton({ characterKey, className, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const loggedIn = useLoggedInClient();

  const buildNextParams = () =>
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

  const openChat = () => {
    const next = buildNextParams();
    next.set("modal", "chat_consult");
    next.set("character_key", characterKey);
    next.delete("chat_session");
    router.push(`${pathname}?${next.toString()}`);
  };

  const openAuthThenChat = () => {
    const next = buildNextParams();
    next.set("modal", "auth");
    next.set("after_auth", `chat:${characterKey}`);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <button type="button" className={className} onClick={() => (loggedIn ? openChat() : openAuthThenChat())}>
      {children}
    </button>
  );
}
