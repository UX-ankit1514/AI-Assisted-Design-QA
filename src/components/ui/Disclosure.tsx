"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Progressive disclosure row (DS accordion anatomy). Collapsed content is inert so it isn't tabbable or read out. */
interface DisclosureProps {
  title: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  id?: string;
}

export function Disclosure({ title, icon: Icon, children, defaultOpen = false, open, onOpenChange, className, id }: DisclosureProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const panelId = useId();

  function toggle() {
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div id={id} className={cn("border-t border-line", className)}>
      <h3>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={toggle}
          className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-p2 font-semibold text-ink transition-colors hover:text-brand"
        >
          {Icon && (
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-tile bg-arnique-100 text-arnique-900">
              <Icon className="size-4" />
            </span>
          )}
          <span className="flex-1">{title}</span>
          <ChevronDown aria-hidden className={cn("size-5 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        inert={!isOpen}
        className={cn("grid transition-[grid-template-rows] duration-200", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="overflow-hidden">
          <div className="pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
