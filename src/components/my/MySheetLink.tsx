"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { rememberMySheetScrollY } from "@/components/my/MySheetBackdropFrame";

type Props = Omit<ComponentProps<typeof Link>, "onClick" | "children"> & {
  children: ReactNode;
};

export function MySheetLink({ children, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={() => {
        rememberMySheetScrollY();
      }}
    >
      {children}
    </Link>
  );
}
