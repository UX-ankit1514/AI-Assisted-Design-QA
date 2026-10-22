import { cn } from "@/lib/cn";
import type { IssueStatus, ReviewState, Severity } from "@/lib/store/types";

/* Status colour always comes with text — never colour alone. Subtle 100 fill + 800 text, per the DS. */

export const STATUS_STYLE: Record<IssueStatus, { chip: string; dot: string }> = {
  Open: { chip: "bg-ruby-100 text-ruby-800", dot: "bg-ruby-700" },
  "In Progress": { chip: "bg-tang-100 text-tang-800", dot: "bg-tang-500" },
  Fixed: { chip: "bg-trueblue-100 text-trueblue-800", dot: "bg-trueblue-700" },
  Verified: { chip: "bg-moss-100 text-moss-800", dot: "bg-moss-700" },
};

export const SEVERITY_STYLE: Record<Severity, { chip: string; dot: string }> = {
  Untriaged: { chip: "bg-cool text-dusk-800", dot: "bg-dusk-500" },
  Low: { chip: "bg-trueblue-100 text-trueblue-800", dot: "bg-trueblue-700" },
  Medium: { chip: "bg-tang-100 text-tang-800", dot: "bg-tang-500" },
  High: { chip: "bg-ruby-100 text-ruby-800", dot: "bg-ruby-700" },
};

const REVIEW_STYLE: Record<ReviewState, { label: string; chip: string }> = {
  Pending: { label: "Potential difference", chip: "bg-ruby-100 text-ruby-800" },
  Confirmed: { label: "Confirmed bug", chip: "bg-arnique-100 text-arnique-900" },
  Dismissed: { label: "Dismissed", chip: "bg-cool text-dusk-700" },
};

const chipBase = "inline-flex items-center gap-1.5 rounded-control px-1.5 py-0.5 text-p4 font-medium whitespace-nowrap";

export function Dot({ className }: { className: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className)} />;
}

export function StatusChip({ status, className }: { status: IssueStatus; className?: string }) {
  return (
    <span className={cn(chipBase, STATUS_STYLE[status].chip, className)}>
      <Dot className={STATUS_STYLE[status].dot} />
      {status}
    </span>
  );
}

export function SeverityChip({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span className={cn(chipBase, SEVERITY_STYLE[severity].chip, className)}>
      <Dot className={SEVERITY_STYLE[severity].dot} />
      {severity}
    </span>
  );
}

export function ReviewChip({ state, className }: { state: ReviewState; className?: string }) {
  return <span className={cn(chipBase, REVIEW_STYLE[state].chip, className)}>{REVIEW_STYLE[state].label}</span>;
}

export function IdChip({ id, confirmed, className }: { id: string; confirmed: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-[2px] px-1.5 text-p4 font-semibold tabular-nums", confirmed ? "bg-ruby-700 text-white" : "bg-ruby-100 text-ruby-800", className)}>
      {id}
    </span>
  );
}
