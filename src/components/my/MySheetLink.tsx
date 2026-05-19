"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

import { rememberMySheetScrollY } from "@/components/my/MySheetBackdropFrame";
import { archiveReviewsWarm } from "@/lib/archive-reviews-preload-bus";
import { myShelfListsWarm } from "@/lib/my-shelf-lists-preload-bus";
import { preloadMyPayments } from "@/lib/my-payments-cache";

type Props = Omit<ComponentProps<typeof Link>, "onClick" | "children"> & {
  children: ReactNode;
};

export function MySheetLink({ children, href, ...props }: Props) {
  const router = useRouter();

  const prefetchHref = typeof href === "string" ? href : null;

  return (
    <Link
      {...props}
      href={href}
      onPointerEnter={() => {
        if (prefetchHref) router.prefetch(prefetchHref);
        if (prefetchHref === "/my/payments") void preloadMyPayments();
        if (prefetchHref?.includes("shelf=fortune") || prefetchHref?.includes("shelf=voice")) {
          myShelfListsWarm();
          archiveReviewsWarm();
        }
        if (prefetchHref?.includes("shelf=chat") || prefetchHref === "/history/chats") {
          archiveReviewsWarm();
        }
      }}
      onFocus={() => {
        if (prefetchHref) router.prefetch(prefetchHref);
        if (prefetchHref === "/my/payments") void preloadMyPayments();
        if (prefetchHref?.includes("shelf=fortune") || prefetchHref?.includes("shelf=voice")) {
          myShelfListsWarm();
          archiveReviewsWarm();
        }
        if (prefetchHref?.includes("shelf=chat") || prefetchHref === "/history/chats") {
          archiveReviewsWarm();
        }
      }}
      onClick={() => {
        rememberMySheetScrollY();
        if (prefetchHref) router.prefetch(prefetchHref);
        if (prefetchHref === "/my/payments") void preloadMyPayments();
        if (prefetchHref?.includes("shelf=fortune") || prefetchHref?.includes("shelf=voice")) {
          myShelfListsWarm();
          archiveReviewsWarm();
        }
        if (prefetchHref?.includes("shelf=chat") || prefetchHref === "/history/chats") {
          archiveReviewsWarm();
        }
      }}
    >
      {children}
    </Link>
  );
}
