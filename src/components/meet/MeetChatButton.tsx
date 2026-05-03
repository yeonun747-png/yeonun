"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { readAuthStubLoggedIn, YEONUN_AUTH_STUB_EVENT } from "@/lib/auth-stub";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  characterKey: string;
  className?: string;
  children: React.ReactNode;
};

function useLoggedInClient() {
  const [loggedIn, setLoggedIn] = useState(false);

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
    void refresh();
    window.addEventListener(YEONUN_AUTH_STUB_EVENT, refresh);
    return () => window.removeEventListener(YEONUN_AUTH_STUB_EVENT, refresh);
  }, [refresh]);

  return loggedIn;
}

export function MeetChatButton({ characterKey, className, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const loggedIn = useLoggedInClient();

  const openChat = () => {
    const next = new URLSearchParams(sp.toString());
    next.set("modal", "chat_consult");
    next.set("character_key", characterKey);
    next.delete("chat_session");
    router.push(`${pathname}?${next.toString()}`);
  };

  const openAuthThenChat = () => {
    const next = new URLSearchParams(sp.toString());
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
