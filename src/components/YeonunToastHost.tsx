"use client";

import { useEffect, useState } from "react";

export function YeonunToastHost() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<{ message?: string }>).detail;
      const m = typeof d?.message === "string" ? d.message : "";
      if (!m) return;
      setMsg(m);
      window.setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener("yeonun:toast", onToast);
    return () => window.removeEventListener("yeonun:toast", onToast);
  }, []);

  if (!msg) return null;
  return (
    <div className="y-toast-host" role="status">
      <div className="y-toast-bubble">{msg}</div>
    </div>
  );
}
