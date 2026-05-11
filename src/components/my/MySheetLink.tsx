"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

import { rememberMySheetScrollY } from "@/components/my/MySheetBackdropFrame";

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
      }}
      onFocus={() => {
        if (prefetchHref) router.prefetch(prefetchHref);
      }}
      onClick={() => {
        rememberMySheetScrollY();
        if (prefetchHref) router.prefetch(prefetchHref);
      }}
    >
      {children}
    </Link>
  );
}
