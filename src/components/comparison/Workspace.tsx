"use client";

import { Download, Info, ListChecks, Plus, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IssuePanel, tabIssues, type IssueTab } from "@/components/issues/IssuePanel";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewport } from "@/components/viewer/useViewport";
import { Viewer, type ViewerSettings } from "@/components/viewer/Viewer";
import { SENSITIVITY_LABELS } from "@/lib/engine/presets";
import type { Rect } from "@/lib/engine/types";
import { downloadText } from "@/lib/download";
import { formatDateTime, formatPercent, plural } from "@/lib/format";
import { csvFileName, issuesToCsv } from "@/lib/issues/csv";
import { summarizeReview, trackedIssues } from "@/lib/issues/workflow";
import { cn } from "@/lib/cn";
import { useQaState } from "@/lib/store/hooks";
import { qaStore } from "@/lib/store/qa-store";
import { displayId, type Comparison, type Issue } from "@/lib/store/types";
import { WorkspaceNotices } from "./WorkspaceNotices";

/* Screen 2 — Comparison Workspace (PRD §7), the most important screen. */
export function Workspace({ id, initialIssueId }: { id: string; initialIssueId?: string }) {
  const { ready, comparisons, issues } = useQaState();
  const comparison = comparisons.find((c) => c.id === id);
  const own = useMemo(() => sortIssues(issues.filter((i) => i.comparisonId === id)), [issues, id]);

  if (!ready) return <WorkspaceSkeleton />;
  if (!comparison) return <MissingComparison />;
  return <LoadedWorkspace key={comparison.id} comparison={comparison} issues={own} initialIssueId={initialIssueId} />;
}

/** Reading order for detected regions (R1, R2…), manual issues after them. */
function sortIssues(issues: Issue[]): Issue[] {
  const rank = (i: Issue) => (i.source === "manual" ? 100_000 : 0) + (Number.parseInt(i.label.slice(1), 10) || 0);
  return issues.sort((a, b) => rank(a) - rank(b));
}

type LastAction = { kind: "confirmed" | "dismissed"; id: string; label: string; bug?: string };

function LoadedWorkspace({ comparison, issues, initialIssueId }: { comparison: Comparison; issues: Issue[]; initialIssueId?: string }) {
  // While a likely misalignment is unresolved, detected regions stay hidden (PRD §9.4).
  const visible = useMemo(() => (comparison.regionsRevealed ? issues : issues.filter((i) => i.source === "manual")), [issues, comparison.regionsRevealed]);
  const review = summarizeReview(visible);
  const confirmedCount = review.confirmed;

  const initial = visible.find((i) => i.id === initialIssueId);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);
  const [tab, setTab] = useState<IssueTab>(initial ? initial.reviewState : review.pending > 0 ? "Pending" : "All");
  const [settings, setSettings] = useState<ViewerSettings>({
    mode: "side-by-side",
    showHighlights: true,
    showDismissed: false,
    addMode: false,
    overlayOpacity: 50,
    overlayBlend: "normal",
  });
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [exportError, setExportError] = useState(false);
  const viewport = useViewport({ width: comparison.width, height: comparison.height });
  const focusedInitial = useRef(false);

  const byId = useMemo(() => new Map(visible.map((i) => [i.id, i])), [visible]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  function syncUrl(issueId: string | null) {
    const url = `/comparisons/${comparison.id}${issueId ? `?issue=${issueId}` : ""}`;
    window.history.replaceState(window.history.state, "", url);
  }

  /** `animate` is off for keyboard-driven selection: actions repeated many times a minute should feel instant. */
  function select(issueId: string | null, focus = true, animate = true) {
    setSelectedId(issueId);
    syncUrl(issueId);
    const issue = issueId ? byId.get(issueId) : undefined;
    if (!issue) return;
    // Keep the card visible: switch to its tab if the current one filters it out.
    setTab((current) => (current === "All" || current === issue.reviewState ? current : issue.reviewState));
    if (focus) viewport.focusRect(issue.region, animate);
  }

  // Deep link (?issue=…): focus the region once the viewer knows its size.
  useEffect(() => {
    if (focusedInitial.current || !initial || viewport.pane.width === 0) return;
    focusedInitial.current = true;
    viewport.focusRect(initial.region);
  }, [initial, viewport]);

  function step(direction: 1 | -1, animate = true) {
    const list = tabIssues(visible, tab);
    if (!list.length) return;
    const index = list.findIndex((i) => i.id === selectedId);
    const next = index === -1 ? (direction === 1 ? list[0] : list[list.length - 1]) : list[(index + direction + list.length) % list.length];
    select(next.id, true, animate);
  }

  /** After a decision, move to the next difference still waiting for review — the fast path through 40–50 regions. */
  function advanceFrom(issueId: string, animate = true) {
    const pending = visible.filter((i) => i.reviewState === "Pending" && i.id !== issueId);
    const order = visible.findIndex((i) => i.id === issueId);
    const next = pending.find((i) => visible.indexOf(i) > order) ?? pending[0];
    if (next) select(next.id, true, animate);
    else {
      setTab("All");
      select(issueId, false);
    }
  }

  function confirm(issueId: string, animate = true) {
    const issue = byId.get(issueId);
    if (!issue || !qaStore.confirm(issueId)) return;
    const updated = qaStore.getSnapshot().issues.find((i) => i.id === issueId);
    setLastAction({ kind: "confirmed", id: issueId, label: issue.label, bug: updated ? displayId(updated) : undefined });
    advanceFrom(issueId, animate);
  }

  function dismiss(issueId: string, animate = true) {
    const issue = byId.get(issueId);
    if (!issue || !qaStore.dismiss(issueId)) return;
    setLastAction({ kind: "dismissed", id: issueId, label: issue.label });
    advanceFrom(issueId, animate);
  }

  function undoLast() {
    if (!lastAction) return;
    const ok = lastAction.kind === "confirmed" ? qaStore.returnToReview(lastAction.id) : qaStore.restore(lastAction.id);
    if (ok) {
      setTab("Pending");
      select(lastAction.id);
    }
    setLastAction(null);
  }

  function drawIssue(rect: Rect) {
    const issue = qaStore.addManualIssue(comparison.id, rect);
    if (!issue) return;
    setSettings((s) => ({ ...s, addMode: false }));
    setTab("Confirmed");
    setSelectedId(issue.id);
    syncUrl(issue.id);
  }

  function exportCsv() {
    try {
      const rows = trackedIssues(visible);
      downloadText(csvFileName(comparison.projectName), issuesToCsv(rows, new Map([[comparison.id, comparison]])));
      setExportError(false);
    } catch {
      setExportError(true);
    }
  }

  // Keyboard support for the essential review controls (PRD §8). Re-registered each render so it sees current state.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='listbox'], [role='option'], [role='combobox'], [role='slider']")) return;
      const key = event.key.toLowerCase();
      const handled = () => event.preventDefault();
      if (key === "j") return handled(), step(1, false);
      if (key === "k") return handled(), step(-1, false);
      if (key === "h") return handled(), setSettings((s) => ({ ...s, showHighlights: !s.showHighlights }));
      if (key === "+" || key === "=") return handled(), viewport.zoomBy(1.25);
      if (key === "-") return handled(), viewport.zoomBy(1 / 1.25);
      if (key === "0") return handled(), viewport.fitScreen(false);
      if (key === "1") return handled(), viewport.actualSize(false);
      if (key === "escape") {
        if (settings.addMode) setSettings((s) => ({ ...s, addMode: false }));
        else select(null, false);
        return;
      }
      if (!selected || selected.reviewState !== "Pending") return;
      if (key === "c") return handled(), confirm(selected.id, false);
      if (key === "d") return handled(), dismiss(selected.id, false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const actionBanner = lastAction && (
    <div className="flex items-center justify-between gap-2 border-b border-line bg-white px-4 py-2 text-p3" role="status" data-testid="last-action">
      <span className="text-ink">
        {lastAction.kind === "confirmed" ? (
          <>
            {lastAction.label} confirmed as <strong className="font-semibold">{lastAction.bug}</strong>
          </>
        ) : (
          <>{lastAction.label} dismissed</>
        )}
      </span>
      <button type="button" onClick={undoLast} className="flex min-h-9 items-center gap-1 rounded-control px-2 font-medium text-brand hover:bg-arnique-100">
        <Undo2 aria-hidden className="size-4" />
        Undo
      </button>
    </div>
  );

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-white px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-sh7 font-semibold text-ink" data-testid="project-name">
              {comparison.projectName}
            </h1>
            {comparison.isSample && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Badge tone="warning">Sample data</Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-72">
                  These are generated example screenshots with intentional differences. The comparison and every result on this page are real.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="mt-0.5 text-p4 text-muted tabular-nums" data-testid="dimensions">
            {comparison.width} × {comparison.height} px · Compared {formatDateTime(comparison.createdAt)} · {SENSITIVITY_LABELS[comparison.sensitivity].label} sensitivity
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={`/issues?comparison=${comparison.id}`} variant="tertiary" size="m" icon={ListChecks}>
            Design Issues
          </ButtonLink>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={confirmedCount === 0 ? 0 : -1}>
                <Button variant="tertiary" size="m" icon={Download} onClick={exportCsv} disabled={confirmedCount === 0} data-testid="export-csv">
                  Export CSV
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{confirmedCount === 0 ? "Confirm at least one bug to export" : `Export ${plural(confirmedCount, "confirmed issue")} as CSV`}</TooltipContent>
          </Tooltip>
          <ButtonLink href="/" size="m" icon={Plus}>
            New Comparison
          </ButtonLink>
        </div>
      </header>

      <SummaryStrip comparison={comparison} review={review} onTab={setTab} />

      <WorkspaceNotices
        comparison={comparison}
        exportError={exportError}
        onRetryExport={exportCsv}
        onReveal={() => qaStore.updateComparison(comparison.id, { regionsRevealed: true })}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex h-[70vh] min-h-[26rem] min-w-0 flex-1 flex-col lg:h-auto">
          <Viewer
            comparison={comparison}
            issues={visible}
            selectedId={selectedId}
            viewport={viewport}
            settings={settings}
            onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            onSelect={(issueId) => select(issueId, false)}
            onDraw={drawIssue}
          />
        </div>
        <div className="flex min-h-0 flex-col lg:w-[24.5rem] lg:shrink-0">
          {actionBanner}
          <IssuePanel
            comparison={comparison}
            issues={visible}
            tab={tab}
            onTab={setTab}
            selectedId={selectedId}
            onSelect={(issueId) => (issueId === selectedId ? select(null, false) : select(issueId))}
            onStep={(direction) => step(direction)}
            onConfirm={(issueId) => confirm(issueId)}
            onDismiss={(issueId) => dismiss(issueId)}
            onReveal={() => qaStore.updateComparison(comparison.id, { regionsRevealed: true })}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryStrip({ comparison, review, onTab }: { comparison: Comparison; review: ReturnType<typeof summarizeReview>; onTab: (tab: IssueTab) => void }) {
  const [about, setAbout] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-stretch gap-x-2 gap-y-2 border-b border-line bg-white px-4 py-2 md:px-6" data-testid="summary">
        <Stat
          label="Difference"
          value={formatPercent(comparison.differencePercentage)}
          testId="stat-difference"
          hint="Share of pixels that differ between the two screenshots. It's a technical image statistic, not a design-quality score."
        />
        <Stat label="Potential regions" value={comparison.candidateCount} testId="stat-regions" onClick={() => onTab("All")} />
        <Stat label="Confirmed bugs" value={review.confirmed} testId="stat-confirmed" onClick={() => onTab("Confirmed")} tone="ruby" />
        <Stat label="Dismissed" value={review.dismissed} testId="stat-dismissed" onClick={() => onTab("Dismissed")} />
        <Stat label="To review" value={review.pending} testId="stat-pending" onClick={() => onTab("Pending")} />
        <button
          type="button"
          onClick={() => setAbout((v) => !v)}
          aria-expanded={about}
          className="ml-auto flex min-h-10 items-center gap-1.5 self-center rounded-control px-2 text-p3 font-medium text-muted hover:bg-cool hover:text-ink"
        >
          <Info aria-hidden className="size-4" />
          About these results
        </button>
      </div>
      {about && (
        <div className="border-b border-line bg-arnique-100 px-4 py-3 text-p3 text-dusk-800 md:px-6" data-testid="about-results">
          <p className="max-w-[60rem]">
            Every highlight is a <strong className="font-semibold text-ink">potential</strong> difference found by comparing pixels — nothing is a bug until you
            confirm it. Pixel comparison is sensitive to font rendering, anti-aliasing, image compression, live content (dates, carousels), animations,
            scroll position and screenshots that aren&apos;t aligned. It can show <em>where</em> things differ, but not exact CSS values such as a font size —
            check those against the Figma file.
          </p>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, hint, testId, onClick, tone }: { label: string; value: string | number; hint?: string; testId: string; onClick?: () => void; tone?: "ruby" }) {
  const body = (
    <>
      <span className="flex items-center gap-1 text-p4 text-muted">
        {label}
        {hint && <Info aria-hidden className="size-3.5" />}
      </span>
      <span className={cn("text-sh7 font-semibold tabular-nums", tone === "ruby" && Number(value) > 0 ? "text-ruby-700" : "text-ink")} data-testid={testId}>
        {value}
      </span>
    </>
  );
  const box = "flex min-w-28 flex-col items-start rounded-control px-3 py-1.5 text-left";
  if (hint) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div tabIndex={0} className={box}>
            {body}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">{hint}</TooltipContent>
      </Tooltip>
    );
  }
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(box, "transition-colors hover:bg-cool")}>
      {body}
    </button>
  ) : (
    <div className={box}>{body}</div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)]" aria-busy="true" aria-label="Loading comparison">
      <div className="flex items-center gap-4 border-b border-line bg-white px-6 py-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="ml-auto h-10 w-80" />
      </div>
      <div className="flex gap-6 border-b border-line bg-white px-6 py-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>
      <div className="flex min-h-[26rem] flex-1 gap-px">
        <Skeleton className="flex-1 rounded-none" />
        <Skeleton className="flex-1 rounded-none" />
        <div className="hidden w-[24.5rem] flex-col gap-2 bg-cool p-3 lg:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}

function MissingComparison() {
  return (
    <div className="mx-auto flex max-w-[36rem] flex-col items-start gap-4 px-6 py-20">
      <h1 className="font-serif text-l4 font-medium text-heading">This Comparison Isn&apos;t in This Browser</h1>
      <p className="text-p2 text-muted">
        Comparisons are saved only in the browser that created them, so a link from someone else won&apos;t open here. It may also have been deleted, or the
        browser&apos;s site data cleared.
      </p>
      <ButtonLink href="/" arrow>
        Start a New Comparison
      </ButtonLink>
    </div>
  );
}
