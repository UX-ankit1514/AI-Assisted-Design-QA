import { cn } from "@/lib/cn";

/* DS skeleton loader: rounded blocks with a 1s linear shimmer, mirroring the real layout. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-card", className)} />;
}
