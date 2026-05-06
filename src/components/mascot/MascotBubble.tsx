"use client";

import gsap from "gsap";
import { useEffect, useRef, type CSSProperties } from "react";
import type { BubblePayload } from "./useMascotState";

export type MascotBubbleAnchor = "yeon" | "un";

const anchorStyle: Record<MascotBubbleAnchor, CSSProperties> = {
  yeon: {
    position: "fixed",
    right: 20,
    bottom: "calc(100px + 200px)",
    transform: "translateX(0)",
    zIndex: 9001,
    pointerEvents: "none",
    maxWidth: 220,
  },
  un: {
    position: "fixed",
    left: 20,
    bottom: "calc(100px + 200px)",
    transform: "translateX(0)",
    zIndex: 9001,
    pointerEvents: "none",
    maxWidth: 220,
  },
};

export function MascotBubble({
  anchor,
  payload,
  onClear,
}: {
  anchor: MascotBubbleAnchor;
  payload: BubblePayload | null;
  onClear: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    const el = rootRef.current;
    if (!el || !payload) return;

    gsap.killTweensOf(el);
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" });

    if (payload.durationMs > 0) {
      hideTimerRef.current = window.setTimeout(() => {
        gsap.to(el, {
          opacity: 0,
          duration: 0.25,
          ease: "power2.in",
          onComplete: () => onClear(),
        });
      }, payload.durationMs);
    }

    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [onClear, payload]);

  if (!payload) return null;

  return (
    <div style={anchorStyle[anchor]}>
      <div
        ref={rootRef}
        style={{
          position: "relative",
          background: "#ffffff",
          border: "2px solid #DD5878",
          borderRadius: 16,
          padding: "10px 12px",
          fontSize: 13,
          lineHeight: 1.6,
          color: "#222",
          boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          opacity: 0,
        }}
        role="status"
        aria-live="polite"
      >
        {payload.text}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: -9,
            width: 14,
            height: 14,
            transform: "translateX(-50%) rotate(45deg)",
            background: "#ffffff",
            borderRight: "2px solid #DD5878",
            borderBottom: "2px solid #DD5878",
          }}
        />
      </div>
    </div>
  );
}
