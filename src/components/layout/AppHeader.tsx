"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { summarizeStatuses } from "@/lib/issues/workflow";
import { cn } from "@/lib/cn";
import { useQaState } from "@/lib/store/hooks";
import { visibleIssues } from "@/lib/store/records";

/* Simple top navigation (PRD §7): product name, the two places to go, and where the data lives. */
export function AppHeader() {
  const pathname = usePathname();
  const { comparisons, issues, ready } = useQaState();
  const unresolved = useMemo(() => {
    const s = summarizeStatuses(visibleIssues(issues, comparisons));
    return s.total - s.verified;
  }, [issues, comparisons]);

  const links = [
    { href: "/", label: "New Comparison", active: pathname === "/" },
    { href: "/issues", label: "Design Issues", active: pathname.startsWith("/issues"), count: ready ? unresolved : null },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="flex h-14 items-center gap-3 px-4 md:gap-4 md:px-6">
        <Link href="/" className="flex min-h-10 shrink-0 items-center gap-3 rounded-control" aria-label="DesignSync QA — new comparison">
          <Image src="/brand/arnifi-logo.svg" alt="" width={72} height={20} priority className="hidden sm:block" />
          <span aria-hidden className="hidden h-5 w-px bg-line sm:block" />
          <span className="text-p2 font-semibold whitespace-nowrap text-heading">DesignSync QA</span>
        </Link>

        <nav aria-label="Main" className="flex min-w-0 items-center gap-1 md:ml-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={cn(
                "relative flex min-h-10 items-center gap-2 rounded-control px-3 text-p3 font-medium whitespace-nowrap transition-colors",
                link.active ? "text-brand" : "text-muted hover:bg-cool hover:text-ink",
                link.active && "after:absolute after:inset-x-3 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-brand",
              )}
            >
              <span className={cn(link.href === "/" && "hidden sm:inline")}>{link.label}</span>
              {link.href === "/" && <span className="sm:hidden">New</span>}
              {link.count != null && link.count > 0 && (
                <span className="rounded-full bg-ruby-100 px-1.5 text-p4 font-semibold text-ruby-800 tabular-nums" aria-label={`${link.count} unresolved`}>
                  {link.count}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="ml-auto hidden min-h-10 items-center gap-1.5 rounded-control px-2 text-p4 font-medium text-muted lg:flex"
            >
              <Lock aria-hidden className="size-3.5" />
              Processed in this browser
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-72">
            Screenshots are compared on this device and saved only in this browser. Nothing is uploaded to a server or an AI service.
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
