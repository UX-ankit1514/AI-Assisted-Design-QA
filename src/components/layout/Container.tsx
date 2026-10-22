import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/* Laptop grid: 1120px content (1440 − 2 × 160). 24px margins on mobile, 32px from tablet. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[74rem] px-6 md:px-8", className)} {...props} />;
}
