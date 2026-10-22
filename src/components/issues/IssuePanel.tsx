"use client";

import { ChevronDown, ChevronUp, CircleCheck, Keyboard, ListChecks, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { Comparison, Issue, ReviewState } from "@/lib/store/types";
import { IssueCard } from "./IssueCard";

export type IssueTab = ReviewState | "All";

interface IssuePanelProps {
  comparison: Comparison;
  issues: Issue[];
  tab: IssueTab;
  onTab: (tab: IssueTab) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStep: (direction: 1 | -1) => void;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onReveal: () => void;
}

const TABS: { value: IssueTab; label: string }[] = [
  { value: "Pending", label: "To review" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Dismissed", label: "Dismissed" },
  { value: "All", label: "All" },
];

export function tabIssues(issues: Issue[], tab: IssueTab): Issue[] {
  return tab === "All" ? issues : issues.filter((i) => i.reviewState === tab);
}

/* Right sidebar (PRD §7): issue list, selected issue details, Confirm/Dismiss, issue navigation. */
export function IssuePanel({ comparison, issues, tab, onTab, selectedId, onSelect, onStep, onConfirm, onDismiss, onReveal }: IssuePanelProps) {
  const list = tabIssues(issues, tab);
  const position = list.findIndex((i) => i.id === selectedId);
  const count = (t: IssueTab) => tabIssues(issues, t).length;
  const hidden = !comparison.regionsRevealed;

  return (
    <aside aria-label="Potential issues" className="flex min-h-0 flex-1 flex-col border-line bg-cool lg:border-l">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
        <h2 className="text-p2 font-semibold text-ink">Potential issues</h2>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-p4 text-muted tabular-nums" aria-live="polite" data-testid="issue-position">
            {position >= 0 ? `${position + 1} of ${list.length}` : `${list.length} ${list.length === 1 ? "item" : "items"}`}
          </span>
          <StepButton label="Previous issue (K)" icon={ChevronUp} onClick={() => onStep(-1)} disabled={list.length === 0} />
          <StepButton label="Next issue (J)" icon={ChevronDown} onClick={() => onStep(1)} disabled={list.length === 0} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => onTab(value as IssueTab)} className="border-b border-line bg-white px-3 pb-2">
        <TabsList variant="line" className="h-10 w-full justify-between" aria-label="Filter issues">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="h-9 px-1.5 text-p4 data-[state=active]:text-arnique-1000" data-testid={`tab-${t.value}`}>
              {t.label}
              <span className={cn("rounded-full px-1.5 text-p4 tabular-nums", tab === t.value ? "bg-arnique-200 text-arnique-1000" : "bg-cool text-muted")}>{count(t.value)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="issue-list">
        {hidden ? (
          <EmptyState icon={TriangleAlert} tone="warning" title="Check the alignment first">
            <p>These screenshots look shifted, so the highlighted regions would mostly be misleading. Recapture them, or review the regions anyway.</p>
            <button type="button" onClick={onReveal} className="mt-3 min-h-10 rounded-cta bg-brand px-4 text-p3 font-medium text-white hover:bg-brand-hover">
              Review Regions Anyway
            </button>
          </EmptyState>
        ) : issues.length === 0 ? (
          <EmptyState icon={CircleCheck} tone="success" title="No meaningful visual differences detected." testId="no-differences">
            <p>The screenshots match at this sensitivity. If you still spot something, use Add Issue to mark it by hand.</p>
          </EmptyState>
        ) : list.length === 0 ? (
          <EmptyState icon={ListChecks} tone="neutral" title={EMPTY_COPY[tab]}>
            {tab === "Pending" && (
              <Link href={`/issues?comparison=${comparison.id}`} className="mt-2 inline-flex min-h-10 items-center text-p3 font-medium text-brand underline-offset-4 hover:underline">
                Open Design Issues
              </Link>
            )}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((issue) => (
              <IssueCard key={issue.id} issue={issue} comparison={comparison} selected={issue.id === selectedId} onSelect={onSelect} onConfirm={onConfirm} onDismiss={onDismiss} />
            ))}
          </ul>
        )}
      </div>

      <div className="hidden items-center gap-2 border-t border-line bg-white px-4 py-2 text-p4 text-muted lg:flex">
        <Keyboard aria-hidden className="size-4 shrink-0" />
        <span>
          <Kbd>J</Kbd>/<Kbd>K</Kbd> move · <Kbd>C</Kbd> confirm · <Kbd>D</Kbd> dismiss · <Kbd>H</Kbd> highlights
        </span>
      </div>
    </aside>
  );
}

const EMPTY_COPY: Record<IssueTab, string> = {
  Pending: "Everything here has been reviewed.",
  Confirmed: "No confirmed issues yet. Review the highlighted differences to add bugs.",
  Dismissed: "Nothing has been dismissed.",
  All: "No issues.",
};

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded-[3px] border border-line bg-cool px-1 font-sans text-[11px] font-semibold text-ink">{children}</kbd>;
}

function StepButton({ label, icon: Icon, onClick, disabled }: { label: string; icon: typeof ChevronUp; onClick: () => void; disabled: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className="flex size-10 items-center justify-center rounded-control text-ink hover:bg-cool disabled:text-dusk-400 disabled:hover:bg-transparent"
        >
          <Icon aria-hidden className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function EmptyState({
  icon: Icon,
  tone,
  title,
  children,
  testId,
}: {
  icon: typeof CircleCheck;
  tone: "success" | "warning" | "neutral";
  title: string;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex flex-col items-start rounded-card border border-line bg-white p-5 text-p3 text-dusk-800" data-testid={testId} role="status">
      <span
        aria-hidden
        className={cn(
          "mb-3 flex size-9 items-center justify-center rounded-tile",
          tone === "success" ? "bg-moss-100 text-moss-800" : tone === "warning" ? "bg-tang-100 text-tang-800" : "bg-arnique-100 text-arnique-900",
        )}
      >
        <Icon className="size-5" />
      </span>
      <p className="text-p2 font-semibold text-ink">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
