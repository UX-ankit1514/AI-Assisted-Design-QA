import type { Issue, IssueStatus, ReviewState, Severity } from "@/lib/store/types";
import { STATUSES } from "@/lib/store/types";

/*
 * Review and status rules (PRD Steps 5–7).
 * Review:  Pending → Confirmed | Dismissed · Dismissed → Pending (restore) · Confirmed & Open → Pending (return to review)
 * Status:  Open ↔ In Progress → Fixed → Verified. A fix is never verified automatically — Verified can only
 *          follow Fixed, after a designer checks it. Fixed and Verified can be reopened.
 */

const NEXT_STATUS: Record<IssueStatus, readonly IssueStatus[]> = {
  Open: ["In Progress", "Fixed"],
  "In Progress": ["Open", "Fixed"],
  Fixed: ["Verified", "In Progress", "Open"],
  Verified: ["Open"],
};

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

export function canChangeStatus(from: IssueStatus, to: IssueStatus): boolean {
  return from === to || NEXT_STATUS[from].includes(to);
}

/** Options for a status picker: the current status first, then valid moves, in workflow order. */
export function statusOptions(current: IssueStatus): IssueStatus[] {
  return STATUSES.filter((s) => s === current || NEXT_STATUS[current].includes(s));
}

export function changeStatus(issue: Issue, to: IssueStatus, now: string): Issue {
  if (issue.reviewState !== "Confirmed") throw new TransitionError("Only confirmed issues have a status.");
  if (!canChangeStatus(issue.status, to)) throw new TransitionError(`An issue can't move from ${issue.status} to ${to}.`);
  if (issue.status === to) return issue;
  return { ...issue, status: to, updatedAt: now };
}

export function confirmIssue(issue: Issue, bugNumber: number, now: string): Issue {
  if (issue.reviewState !== "Pending") throw new TransitionError("Only pending differences can be confirmed.");
  return {
    ...issue,
    reviewState: "Confirmed",
    status: "Open",
    // A returning issue keeps its number so BUG ids never repeat or change meaning.
    bugNumber: issue.bugNumber ?? bugNumber,
    confirmedAt: issue.confirmedAt ?? now,
    updatedAt: now,
  };
}

export function dismissIssue(issue: Issue, now: string): Issue {
  if (issue.reviewState !== "Pending") throw new TransitionError("Only pending differences can be dismissed.");
  return { ...issue, reviewState: "Dismissed", updatedAt: now };
}

export function restoreIssue(issue: Issue, now: string): Issue {
  if (issue.reviewState !== "Dismissed") throw new TransitionError("Only dismissed differences can be restored.");
  return { ...issue, reviewState: "Pending", updatedAt: now };
}

export function returnToReview(issue: Issue, now: string): Issue {
  if (issue.reviewState !== "Confirmed" || issue.status !== "Open" || issue.source === "manual") {
    throw new TransitionError("Only open, detected issues can go back to review.");
  }
  return { ...issue, reviewState: "Pending", status: "Open", updatedAt: now };
}

export function canReturnToReview(issue: Issue): boolean {
  return issue.reviewState === "Confirmed" && issue.status === "Open" && issue.source !== "manual";
}

export interface IssueEdits {
  title?: string;
  description?: string;
  severity?: Severity;
}

export interface StatusSummary {
  total: number;
  open: number;
  inProgress: number;
  fixed: number;
  verified: number;
}

/** Counts for the Bug Tracker — confirmed issues only. */
export function summarizeStatuses(issues: readonly Issue[]): StatusSummary {
  const summary: StatusSummary = { total: 0, open: 0, inProgress: 0, fixed: 0, verified: 0 };
  for (const issue of issues) {
    if (issue.reviewState !== "Confirmed") continue;
    summary.total++;
    if (issue.status === "Open") summary.open++;
    else if (issue.status === "In Progress") summary.inProgress++;
    else if (issue.status === "Fixed") summary.fixed++;
    else summary.verified++;
  }
  return summary;
}

export interface ReviewSummary {
  candidates: number;
  pending: number;
  confirmed: number;
  dismissed: number;
}

/** Counts for the workspace summary strip. Manual issues are confirmed bugs but not detected candidates. */
export function summarizeReview(issues: readonly Issue[]): ReviewSummary {
  const summary: ReviewSummary = { candidates: 0, pending: 0, confirmed: 0, dismissed: 0 };
  for (const issue of issues) {
    if (issue.source === "detected") summary.candidates++;
    if (issue.reviewState === "Pending") summary.pending++;
    else if (issue.reviewState === "Confirmed") summary.confirmed++;
    else summary.dismissed++;
  }
  return summary;
}

export interface IssueFilter {
  comparisonId?: string | null;
  reviewState?: ReviewState | null;
  status?: IssueStatus | null;
}

export function filterIssues(issues: readonly Issue[], filter: IssueFilter): Issue[] {
  return issues.filter(
    (i) =>
      (!filter.comparisonId || i.comparisonId === filter.comparisonId) &&
      (!filter.reviewState || i.reviewState === filter.reviewState) &&
      (!filter.status || i.status === filter.status),
  );
}

/** Confirmed issues, newest bug first — the Bug Tracker list. */
export function trackedIssues(issues: readonly Issue[], filter: Omit<IssueFilter, "reviewState"> = {}): Issue[] {
  return filterIssues(issues, { ...filter, reviewState: "Confirmed" }).sort((a, b) => (b.bugNumber ?? 0) - (a.bugNumber ?? 0));
}
