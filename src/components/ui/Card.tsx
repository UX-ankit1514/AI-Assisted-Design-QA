import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/* DS composed card: white, 8px radius, 1px border-default. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-white", className)} {...props} />;
}

export function Eyebrow({ children, className }: { children: string; className?: string }) {
  return <p className={cn("text-sph5 font-semibold uppercase text-arnique-700", className)}>{children}</p>;
}
