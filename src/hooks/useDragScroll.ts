"use client";

import { useEffect, useRef } from "react";

const DRAG_THRESHOLD_PX = 4;

/**
 * PC(정밀 포인터)에서 마우스 클릭·드래그로 가로 스크롤.
 * 실제 드래그가 있었을 때만 자식 클릭을 억제합니다.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mq = window.matchMedia("(pointer: fine)");
    if (!mq.matches) return;

    el.classList.add("y-drag-scroll");

    let active = false;
    let startX = 0;
    let scrollLeft = 0;
    let dragged = false;

    const endDrag = () => {
      if (!active) return;
      active = false;
      el.classList.remove("y-drag-scroll--active");

      if (dragged) {
        const suppressClick = (ev: MouseEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          el.removeEventListener("click", suppressClick, true);
        };
        el.addEventListener("click", suppressClick, true);
      }

      dragged = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      active = true;
      startX = e.pageX;
      scrollLeft = el.scrollLeft;
      dragged = false;
      el.classList.add("y-drag-scroll--active");
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!active) return;
      const dx = e.pageX - startX;
      if (!dragged && Math.abs(dx) >= DRAG_THRESHOLD_PX) dragged = true;
      if (!dragged) return;
      e.preventDefault();
      el.scrollLeft = scrollLeft - dx;
    };

    el.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", endDrag);

    return () => {
      el.classList.remove("y-drag-scroll", "y-drag-scroll--active");
      el.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", endDrag);
    };
  }, []);

  return ref;
}
