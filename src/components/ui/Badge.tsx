import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Status tag. Always pairs colour with text (and usually an icon) — status never relies on colour alone. */
export type BadgeTone = "brand" | "neutral" | "success" | "warning" | "info";

const tones: Record<BadgeTone, string> = {
  brand: "bg-arnique-100 text-arnique-900 border-arnique-200",
  neutral: "bg-cool text-dusk-800 border-line",
  success: "bg-moss-100 text-moss-800 border-moss-100",
  warning: "bg-tang-100 text-tang-800 border-tang-100",
  info: "bg-trueblue-100 text-trueblue-700 border-trueblue-100",
};

export function Badge({ tone = "neutral", icon: Icon, children, className }: { tone?: BadgeTone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-p4 font-medium", tones[tone], className)}>
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
      {children}
    </span>
  );
}
