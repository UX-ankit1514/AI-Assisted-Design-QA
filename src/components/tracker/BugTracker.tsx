"use client";

import { ArrowLeft, ArrowUpRight, Download, ListChecks, Pencil } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { IdChip } from "@/components/issues/badges";
import { CropPreview } from "@/components/issues/CropPreview";
import { SeveritySelect, StatusSelect } from "@/components/issues/IssueSelects";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/Skeleton";
import { downloadText } from "@/lib/download";
import { formatDate, formatDateTime, plural } from "@/lib/format";
import { csvFileName, issuesToCsv } from "@/lib/issues/csv";
import { TEXT_LIMITS } from "@/lib/issues/sanitize";
import { summarizeStatuses, trackedIssues } from "@/lib/issues/workflow";
import { cn } from "@/lib/cn";
import { useQaState } from "@/lib/store/hooks";
import { qaStore } from "@/lib/store/qa-store";
import { visibleIssues } from "@/lib/store/records";
import { displayId, type Comparison, type Issue, type IssueStatus } from "@/lib/store/types";
import { STATUS_STYLE } from "@/components/issues/badges";

const ALL = "all";

/* Screen 3 — Bug Tracker, "Design Issues" (PRD §7): confirmed issues only, tracked to Verified. */
export function BugTracker({ initialComparisonId, initialStatus }: { initialComparisonId?: string; initialStatus?: IssueStatus }) {
  const { ready, comparisons, issues } = useQaState();
  const [comparisonId, setComparisonId] = useState<string>(initialComparisonId ?? ALL);
  const [status, setStatus] = useState<IssueStatus | null>(initialStatus ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState(false);

  const byId = useMemo(() => new Map(comparisons.map((c) => [c.id, c])), [comparisons]);
  const activeComparison = comparisonId === ALL ? null : byId.get(comparisonId) ?? null;
  const scope = activeComparison ? activeComparison.id : null;

  const confirmed = useMemo(() => trackedIssues(visibleIssues(issues, comparisons)), [issues, comparisons]);
  const scoped = useMemo(() => (scope ? confirmed.filter((i) => i.comparisonId === scope) : confirmed), [confirmed, scope]);
  const summary = summarizeStatuses(scoped);
  const rows = status ? scoped.filter((i) => i.status === status) : scoped;

  const syncUrl = useCallback((cid: string, st: IssueStatus | null) => {
    const params = new URLSearchParams();
    if (cid !== ALL) params.set("comparison", cid);
    if (st) params.set("status", st);
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `/issues${query ? `?${query}` : ""}`);
  }, []);

  function chooseComparison(cid: string) {
    setComparisonId(cid);
    syncUrl(cid, status);
  }

  function chooseStatus(st: IssueStatus | null) {
    setStatus(st);
    syncUrl(comparisonId, st);
  }

  function exportCsv() {
    try {
      downloadText(csvFileName(activeComparison?.projectName ?? "all-projects"), issuesToCsv(rows, byId));
      setExportError(false);
    } catch {
      setExportError(true);
    }
  }

  const tiles: { label: string; value: number; status: IssueStatus | null }[] = [
    { label: "Total confirmed", value: summary.total, status: null },
    { label: "Open", value: summary.open, status: "Open" },
    { label: "In Progress", value: summary.inProgress, status: "In Progress" },
    { label: "Fixed", value: summary.fixed, status: "Fixed" },
    { label: "Verified", value: summary.verified, status: "Verified" },
  ];

  const latest = comparisons[0];

  return (
    <div className="pb-20">
      <section className="border-b border-line bg-white">
        <Container className="flex flex-wrap items-end gap-x-8 gap-y-4 py-8">
          <div className="min-w-0 flex-1">
            {activeComparison && (
              <Link
                href={`/comparisons/${activeComparison.id}`}
                className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-p3 font-medium text-brand underline-offset-4 hover:underline"
                data-testid="return-to-comparison"
              >
                <ArrowLeft aria-hidden className="size-4" />
                Return to Comparison
              </Link>
            )}
            <h1 className="font-serif text-l4 font-medium text-heading">Design Issues</h1>
            <p className="mt-2 max-w-[40rem] text-p2 text-muted">
              Confirmed bugs from your comparisons. Developers move them to Fixed; a designer checks each fix and marks it Verified.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-p4 font-medium text-muted">
              Project
              <Select value={activeComparison ? comparisonId : ALL} onValueChange={chooseComparison}>
                <SelectTrigger className="h-10 w-64 bg-white text-p3" aria-label="Filter by project" data-testid="project-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All projects</SelectItem>
                  {comparisons.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.projectName} · {formatDate(c.createdAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button variant="tertiary" size="m" icon={Download} onClick={exportCsv} disabled={rows.length === 0} data-testid="tracker-export">
              Export CSV{rows.length ? ` (${rows.length})` : ""}
            </Button>
          </div>
        </Container>
      </section>

      <Container className="mt-6 flex flex-col gap-6">
        {exportError && (
          <Notice
            tone="error"
            role="alert"
            title="The CSV couldn't be downloaded"
            action={
              <Button size="m" variant="tertiary" onClick={exportCsv}>
                Try Again
              </Button>
            }
          >
            Your browser blocked the download. Check that downloads are allowed for this site, then try again.
          </Notice>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" role="group" aria-label="Filter by status" data-testid="status-summary">
          {tiles.map((tile) => {
            const active = status === tile.status;
            return (
              <button
                key={tile.label}
                type="button"
                aria-pressed={active}
                onClick={() => chooseStatus(tile.status)}
                data-testid={`summary-${tile.status ?? "Total"}`}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-card border bg-white p-4 text-left transition-[border-color,box-shadow]",
                  active ? "border-brand shadow-raised" : "border-line hover:border-line-hover",
                  tile.status === null && "col-span-2 sm:col-span-1",
                )}
              >
                <span className="flex items-center gap-1.5 text-p4 font-medium text-muted">
                  {tile.status && <span aria-hidden className={cn("size-2 rounded-full", STATUS_STYLE[tile.status].dot)} />}
                  {tile.label}
                </span>
                <span className="text-sh6 font-semibold text-ink tabular-nums" data-testid={`count-${tile.status ?? "Total"}`}>
                  {ready ? tile.value : "–"}
                </span>
              </button>
            );
          })}
        </div>

        {!ready ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full bg-white" />
            ))}
          </div>
        ) : confirmed.length === 0 ? (
          <div className="flex flex-col items-start rounded-card border border-line bg-white p-8" role="status" data-testid="tracker-empty">
            <span aria-hidden className="mb-4 flex size-10 items-center justify-center rounded-tile bg-arnique-200 text-arnique-900">
              <ListChecks className="size-5" />
            </span>
            <p className="text-sh7 font-semibold text-ink">No confirmed issues yet. Review the highlighted differences to add bugs.</p>
            <p className="mt-1 text-p3 text-muted">Confirmed bugs from every comparison in this browser appear here.</p>
            <div className="mt-5">
              {latest ? (
                <ButtonLink href={`/comparisons/${latest.id}`} arrow>
                  Review {latest.projectName}
                </ButtonLink>
              ) : (
                <ButtonLink href="/" arrow>
                  Start a Comparison
                </ButtonLink>
              )}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-6" role="status">
            <p className="text-p2 font-semibold text-ink">
              No {status ? `${status.toLowerCase()} ` : ""}issues{activeComparison ? ` in ${activeComparison.projectName}` : ""}.
            </p>
            <Button
              size="m"
              variant="tertiary"
              onClick={() => {
                chooseStatus(null);
              }}
            >
              Show All Statuses
            </Button>
          </div>
        ) : (
          <section aria-label={`${plural(rows.length, "issue")}`}>
            <div aria-hidden className="hidden grid-cols-[7.5rem_minmax(0,1fr)_9.5rem_9.5rem_7rem_5.5rem] gap-4 px-4 pb-2 text-sh8 font-semibold text-muted lg:grid">
              <span>Preview</span>
              <span>Issue</span>
              <span>Severity</span>
              <span>Status</span>
              <span>Updated</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="flex flex-col gap-2" data-testid="tracker-list">
              {rows.map((issue) => (
                <TrackerRow
                  key={issue.id}
                  issue={issue}
                  comparison={byId.get(issue.comparisonId)}
                  editing={editingId === issue.id}
                  onEdit={() => setEditingId(editingId === issue.id ? null : issue.id)}
                  onDone={() => setEditingId(null)}
                />
              ))}
            </ul>
          </section>
        )}
      </Container>
    </div>
  );
}

function TrackerRow({ issue, comparison, editing, onEdit, onDone }: { issue: Issue; comparison?: Comparison; editing: boolean; onEdit: () => void; onDone: () => void }) {
  const id = displayId(issue);
  const href = `/comparisons/${issue.comparisonId}?issue=${issue.id}`;
  return (
    <li className="rounded-card border border-line bg-white" data-testid={`row-${id}`}>
      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-3 p-4 lg:grid-cols-[7.5rem_minmax(0,1fr)_9.5rem_9.5rem_7rem_5.5rem] lg:items-center">
        {comparison ? (
          <Link href={href} aria-label={`Open ${id} in its comparison`} className="row-span-2 rounded-control lg:row-span-1">
            <CropPreview
              imageId={comparison.implementationImage.id}
              image={{ width: comparison.width, height: comparison.height }}
              region={issue.region}
              width={120}
              height={80}
              alt=""
              className="max-lg:h-16 max-lg:w-24"
            />
          </Link>
        ) : (
          <div className="row-span-2 h-16 w-24 rounded-control bg-cool lg:row-span-1" />
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <IdChip id={id} confirmed />
            {comparison?.isSample && <Badge tone="warning">Sample</Badge>}
          </div>
          <p className="mt-1 text-p3 font-semibold text-ink" data-testid="row-title">
            {issue.title}
          </p>
          <p className="mt-0.5 truncate text-p4 text-muted">
            {comparison?.projectName ?? "Deleted comparison"} · {issue.source === "manual" ? "added manually" : `region ${issue.label}`} · created {formatDate(issue.createdAt)}
          </p>
          {issue.description && !editing && <p className="mt-1 line-clamp-2 text-p4 text-dusk-800">{issue.description}</p>}
        </div>

        <div className="col-span-2 grid grid-cols-2 gap-3 lg:col-span-1 lg:contents">
          <label className="flex flex-col gap-1 text-p4 font-medium text-muted lg:block">
            <span className="lg:sr-only">Severity</span>
            <SeveritySelect issue={issue} size="sm" />
          </label>
          <label className="flex flex-col gap-1 text-p4 font-medium text-muted lg:block">
            <span className="lg:sr-only">Status</span>
            <StatusSelect issue={issue} size="sm" />
          </label>
        </div>

        <p className="text-p4 text-muted tabular-nums max-lg:hidden" title={formatDateTime(issue.updatedAt)}>
          {formatDate(issue.updatedAt)}
        </p>

        <div className="col-span-2 flex items-center justify-end gap-1 lg:col-span-1">
          <button
            type="button"
            onClick={onEdit}
            aria-expanded={editing}
            aria-label={`Edit ${id}`}
            className={cn("flex size-10 items-center justify-center rounded-control transition-colors", editing ? "bg-arnique-100 text-arnique-1000" : "text-muted hover:bg-cool hover:text-ink")}
          >
            <Pencil aria-hidden className="size-4" />
          </button>
          <Link href={href} aria-label={`View ${id} in its comparison`} className="flex size-10 items-center justify-center rounded-control text-muted hover:bg-cool hover:text-ink">
            <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
      {editing && <EditIssue issue={issue} onDone={onDone} />}
    </li>
  );
}

function EditIssue({ issue, onDone }: { issue: Issue; onDone: () => void }) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);
  return (
    <form
      className="flex flex-col gap-3 border-t border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        qaStore.edit(issue.id, { title, description });
        onDone();
      }}
      data-testid="edit-form"
    >
      <label className="flex flex-col gap-1 text-p4 font-medium text-muted">
        Title
        <input
          value={title}
          maxLength={TEXT_LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-10 rounded-control border-[1.5px] border-line bg-white px-3 text-p3 text-ink hover:border-line-hover focus:border-focus focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-p4 font-medium text-muted">
        Description
        <textarea
          value={description}
          rows={3}
          maxLength={TEXT_LIMITS.description}
          onChange={(e) => setDescription(e.target.value)}
          className="resize-y rounded-control border-[1.5px] border-line bg-white px-3 py-2 text-p3 text-ink hover:border-line-hover focus:border-focus focus:outline-none"
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="m">
          Save Changes
        </Button>
        <Button size="m" variant="tertiary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
