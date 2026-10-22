import type { EngineWarning, Rect, RegionHint, Sensitivity } from "@/lib/engine/types";

/* Data model (PRD §11). */

export const SEVERITIES = ["Untriaged", "Low", "Medium", "High"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const REVIEW_STATES = ["Pending", "Confirmed", "Dismissed"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const STATUSES = ["Open", "In Progress", "Fixed", "Verified"] as const;
export type IssueStatus = (typeof STATUSES)[number];

export interface StoredImage {
  /** Key of the blob in the images store. */
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface Comparison {
  id: string;
  projectName: string;
  referenceImage: StoredImage;
  implementationImage: StoredImage;
  /** PNG of the difference mask, so the workspace doesn't recompute on reload. */
  diffMaskImage: StoredImage;
  width: number;
  height: number;
  differencePercentage: number;
  diffPixelCount: number;
  /** Total detected regions (PRD candidateCount). */
  candidateCount: number;
  sensitivity: Sensitivity;
  warnings: EngineWarning[];
  /**
   * False while a likely misalignment hides the candidate regions. Issue cards are only created once the
   * person chooses to review them anyway (PRD §9.4: don't generate dozens of misleading bugs).
   */
  regionsRevealed: boolean;
  /** Built from the bundled sample screenshots — labelled as sample data everywhere. */
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  comparisonId: string;
  /** R1…Rn for detected regions, M1…Mn for manually added issues. */
  label: string;
  /** Global bug number once confirmed: BUG-<n>. Kept if the issue goes back to review, so numbers never repeat. */
  bugNumber: number | null;
  source: "detected" | "manual";
  region: Rect;
  title: string;
  description: string;
  severity: Severity;
  reviewState: ReviewState;
  status: IssueStatus;
  hint: RegionHint | null;
  /** Share of changed pixels inside the region, 0–1 (detected issues only). */
  density: number | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
}

export function bugId(issue: Pick<Issue, "bugNumber">): string | null {
  return issue.bugNumber == null ? null : `BUG-${issue.bugNumber}`;
}

/** The identifier people see: BUG-n once confirmed, the region label before that. */
export function displayId(issue: Pick<Issue, "bugNumber" | "label" | "reviewState">): string {
  return issue.reviewState === "Confirmed" && issue.bugNumber != null ? `BUG-${issue.bugNumber}` : issue.label;
}

/** Reads a status from a URL parameter, ignoring anything that isn't a known status. */
export function parseStatus(value: unknown): IssueStatus | undefined {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value) ? (value as IssueStatus) : undefined;
}
