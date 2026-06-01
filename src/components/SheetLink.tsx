"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

import { rememberSheetBackdropScrollY } from "@/components/my/MySheetBackdropFrame";

type Props = Omit<ComponentProps<typeof Link>, "children"> & {
  children: ReactNode;
};

export function SheetLink({ children, href, scroll = false, onPointerEnter, onClick, ...props }: Props) {
  const router = useRouter();
  const hrefStr = typeof href === "string" ? href : null;

  return (
    <Link
      {...props}
      href={href}
      scroll={scroll}
      prefetch={props.prefetch ?? true}
      onPointerEnter={(e) => {
        const shouldPrefetch = props.prefetch ?? true;
        if (hrefStr && shouldPrefetch) router.prefetch(hrefStr);
        onPointerEnter?.(e);
      }}
      onClick={(e) => {
        rememberSheetBackdropScrollY();
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
