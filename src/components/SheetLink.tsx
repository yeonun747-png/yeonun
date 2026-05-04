"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { rememberSheetBackdropScrollY } from "@/components/my/MySheetBackdropFrame";

type Props = Omit<ComponentProps<typeof Link>, "onClick" | "children"> & {
  children: ReactNode;
};

export function SheetLink({ children, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={() => {
        rememberSheetBackdropScrollY();
      }}
    >
      {children}
    </Link>
  );
}
