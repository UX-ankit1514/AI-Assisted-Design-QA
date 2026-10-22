"use client";

import { ArrowRight, History, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDateTime, formatPercent } from "@/lib/format";
import { summarizeReview } from "@/lib/issues/workflow";
import { useQaState } from "@/lib/store/hooks";
import { qaStore } from "@/lib/store/qa-store";

/* Local persistence of past comparisons (PRD P1). */
export function RecentComparisons() {
  const { ready, comparisons, issues, persistence } = useQaState();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof summarizeReview>>();
    for (const c of comparisons) map.set(c.id, summarizeReview(issues.filter((i) => i.comparisonId === c.id)));
    return map;
  }, [comparisons, issues]);

  if (!ready) {
    return (
      <section aria-label="Recent comparisons" className="flex flex-col gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
      </section>
    );
  }
  if (comparisons.length === 0) return null;

  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="recent-heading" className="flex items-center gap-2 text-sh7 font-semibold text-ink">
            <History aria-hidden className="size-5 text-muted" />
            Recent comparisons
          </h2>
          <p className="mt-1 text-p4 text-muted">
            {persistence === "indexeddb" ? "Saved in this browser only. Clearing site data removes them." : "Kept until you refresh or close this tab."}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-2" data-testid="recent-list">
        {comparisons.map((c) => {
          const count = counts.get(c.id);
          const hidden = !c.regionsRevealed;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-line bg-white p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/comparisons/${c.id}`} className="truncate text-p2 font-semibold text-ink underline-offset-4 hover:text-brand hover:underline">
                    {c.projectName}
                  </Link>
                  {c.isSample && <Badge tone="warning">Sample data</Badge>}
                </div>
                <p className="mt-0.5 text-p4 text-muted tabular-nums">
                  {formatDateTime(c.createdAt)} · {c.width} × {c.height} px · {formatPercent(c.differencePercentage)} different
                </p>
              </div>
              <p className="text-p3 text-muted tabular-nums">
                {hidden ? (
                  "Check alignment"
                ) : c.candidateCount === 0 && !count?.confirmed ? (
                  "No differences"
                ) : (
                  <>
                    <span className="font-semibold text-ink">{count?.confirmed ?? 0}</span> confirmed · <span className="font-semibold text-ink">{count?.pending ?? 0}</span> to review
                  </>
                )}
              </p>
              {confirmDelete === c.id ? (
                <div className="flex items-center gap-2" role="group" aria-label={`Delete ${c.projectName}?`}>
                  <span className="text-p3 text-ink">Delete it and its issues?</span>
                  <button
                    type="button"
                    onClick={() => {
                      qaStore.deleteComparison(c.id);
                      setConfirmDelete(null);
                    }}
                    className="min-h-10 rounded-cta bg-ruby-700 px-3 text-p3 font-medium text-white hover:bg-ruby-800"
                  >
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(null)} className="min-h-10 rounded-cta px-3 text-p3 font-medium text-ink hover:bg-cool">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Link href={`/comparisons/${c.id}`} className="flex min-h-10 items-center gap-1.5 rounded-control px-3 text-p3 font-medium text-brand hover:bg-arnique-100">
                    Open
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(c.id)}
                    aria-label={`Delete ${c.projectName}`}
                    className="flex size-10 items-center justify-center rounded-control text-muted hover:bg-ruby-100 hover:text-ruby-700"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
