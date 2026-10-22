import type { Issue } from "@/lib/store/types";

let n = 0;

export function makeIssue(overrides: Partial<Issue> = {}): Issue {
  n++;
  return {
    id: `issue-${n}`,
    comparisonId: "cmp-1",
    label: `R${n}`,
    bugNumber: null,
    source: "detected",
    region: { x: 10, y: 20, width: 300, height: 40 },
    title: `Possible colour difference near the top left`,
    description: "Check fill, text and border colours.",
    severity: "Untriaged",
    reviewState: "Pending",
    status: "Open",
    hint: "colour",
    density: 0.4,
    createdAt: "2026-10-22T10:00:00.000Z",
    updatedAt: "2026-10-22T10:00:00.000Z",
    confirmedAt: null,
    ...overrides,
  };
}
