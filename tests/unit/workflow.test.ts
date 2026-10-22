import { describe, expect, it } from "vitest";
import {
  canChangeStatus,
  canReturnToReview,
  changeStatus,
  confirmIssue,
  dismissIssue,
  filterIssues,
  restoreIssue,
  returnToReview,
  statusOptions,
  summarizeReview,
  summarizeStatuses,
  trackedIssues,
  TransitionError,
} from "@/lib/issues/workflow";
import { displayId } from "@/lib/store/types";
import { makeIssue } from "./helpers/issues";

const NOW = "2026-10-22T12:00:00.000Z";

describe("review transitions", () => {
  it("confirming a pending difference creates an Open, Untriaged bug with a BUG id (AC-06)", () => {
    const issue = confirmIssue(makeIssue(), 7, NOW);
    expect(issue).toMatchObject({ reviewState: "Confirmed", status: "Open", severity: "Untriaged", bugNumber: 7, confirmedAt: NOW, updatedAt: NOW });
    expect(displayId(issue)).toBe("BUG-7");
  });

  it("dismissing excludes the difference from the confirmed list (AC-07)", () => {
    const dismissed = dismissIssue(makeIssue(), NOW);
    expect(dismissed.reviewState).toBe("Dismissed");
    expect(trackedIssues([dismissed])).toEqual([]);
  });

  it("only pending differences can be confirmed or dismissed", () => {
    const confirmed = confirmIssue(makeIssue(), 1, NOW);
    expect(() => confirmIssue(confirmed, 2, NOW)).toThrow(TransitionError);
    expect(() => dismissIssue(confirmed, NOW)).toThrow(TransitionError);
  });

  it("restores dismissed differences to review", () => {
    expect(restoreIssue(dismissIssue(makeIssue(), NOW), NOW).reviewState).toBe("Pending");
    expect(() => restoreIssue(makeIssue(), NOW)).toThrow(TransitionError);
  });

  it("returns an open bug to review and keeps its number when confirmed again", () => {
    const confirmed = confirmIssue(makeIssue(), 4, NOW);
    expect(canReturnToReview(confirmed)).toBe(true);
    const pending = returnToReview(confirmed, NOW);
    expect(pending.reviewState).toBe("Pending");
    expect(confirmIssue(pending, 9, NOW).bugNumber).toBe(4);
    const inProgress = changeStatus(confirmed, "In Progress", NOW);
    expect(canReturnToReview(inProgress)).toBe(false);
    expect(() => returnToReview(inProgress, NOW)).toThrow(TransitionError);
  });
});

describe("status transitions", () => {
  const open = confirmIssue(makeIssue(), 1, NOW);

  it("follows Open → In Progress → Fixed → Verified", () => {
    const inProgress = changeStatus(open, "In Progress", NOW);
    const fixed = changeStatus(inProgress, "Fixed", NOW);
    const verified = changeStatus(fixed, "Verified", NOW);
    expect([inProgress.status, fixed.status, verified.status]).toEqual(["In Progress", "Fixed", "Verified"]);
  });

  it("never verifies an issue that hasn't been marked Fixed", () => {
    expect(canChangeStatus("Open", "Verified")).toBe(false);
    expect(canChangeStatus("In Progress", "Verified")).toBe(false);
    expect(() => changeStatus(open, "Verified", NOW)).toThrow(TransitionError);
  });

  it("allows reopening fixed and verified issues", () => {
    expect(canChangeStatus("Fixed", "Open")).toBe(true);
    expect(canChangeStatus("Verified", "Open")).toBe(true);
    expect(canChangeStatus("Verified", "Fixed")).toBe(false);
  });

  it("offers only valid next statuses, in workflow order", () => {
    expect(statusOptions("Open")).toEqual(["Open", "In Progress", "Fixed"]);
    expect(statusOptions("Fixed")).toEqual(["Open", "In Progress", "Fixed", "Verified"]);
    expect(statusOptions("Verified")).toEqual(["Open", "Verified"]);
  });

  it("refuses a status on an unconfirmed issue", () => {
    expect(() => changeStatus(makeIssue(), "In Progress", NOW)).toThrow(TransitionError);
  });
});

describe("summaries and filters (AC-08)", () => {
  const issues = [
    makeIssue(),
    dismissIssue(makeIssue(), NOW),
    confirmIssue(makeIssue(), 1, NOW),
    changeStatus(confirmIssue(makeIssue(), 2, NOW), "In Progress", NOW),
    changeStatus(changeStatus(confirmIssue(makeIssue({ comparisonId: "cmp-2" }), 3, NOW), "Fixed", NOW), "Verified", NOW),
    makeIssue({ source: "manual", reviewState: "Confirmed", bugNumber: 4, status: "Fixed" }),
  ];

  it("counts confirmed bugs by status", () => {
    expect(summarizeStatuses(issues)).toEqual({ total: 4, open: 1, inProgress: 1, fixed: 1, verified: 1 });
  });

  it("counts review states; manual issues aren't detected candidates", () => {
    expect(summarizeReview(issues)).toEqual({ candidates: 5, pending: 1, confirmed: 4, dismissed: 1 });
  });

  it("filters by comparison, review state and status", () => {
    expect(filterIssues(issues, { comparisonId: "cmp-2" })).toHaveLength(1);
    expect(filterIssues(issues, { reviewState: "Pending" })).toHaveLength(1);
    expect(trackedIssues(issues, { status: "Open" }).map((i) => i.bugNumber)).toEqual([1]);
    expect(trackedIssues(issues).map((i) => i.bugNumber)).toEqual([4, 3, 2, 1]);
  });
});
