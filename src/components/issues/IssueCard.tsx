"use client";

import { ArrowUpRight, Check, RotateCcw, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatRegionShort } from "@/lib/format";
import { TEXT_LIMITS } from "@/lib/issues/sanitize";
import { canReturnToReview } from "@/lib/issues/workflow";
import { cn } from "@/lib/cn";
import { qaStore } from "@/lib/store/qa-store";
import { displayId, type Comparison, type Issue } from "@/lib/store/types";
import { IdChip, ReviewChip, StatusChip } from "./badges";
import { CropPreview } from "./CropPreview";
import { SeveritySelect, StatusSelect } from "./IssueSelects";

interface IssueCardProps {
  issue: Issue;
  comparison: Comparison;
  selected: boolean;
  onSelect: (id: string) => void;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
}

/* One potential issue (PRD Step 5). Collapsed in the list; expanded with crops, editing and actions when selected. */
export function IssueCard({ issue, comparison, selected, onSelect, onConfirm, onDismiss }: IssueCardProps) {
  const ref = useRef<HTMLLIElement>(null);
  const id = displayId(issue);
  const confirmed = issue.reviewState === "Confirmed";
  const image = { width: comparison.width, height: comparison.height };

  useEffect(() => {
    if (!selected) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [selected]);

  return (
    <li
      ref={ref}
      data-testid={`issue-${issue.label}`}
      data-selected={selected || undefined}
      className={cn(
        "rounded-card border bg-white transition-colors",
        selected ? "border-arnique-600 shadow-raised" : "border-line hover:border-line-hover",
        issue.reviewState === "Dismissed" && !selected && "bg-cool/60",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(issue.id)}
        aria-expanded={selected}
        aria-label={`${id}: ${issue.title}`}
        className="flex w-full items-start gap-3 rounded-card p-3 text-left"
      >
        <CropPreview
          imageId={comparison.implementationImage.id}
          image={image}
          region={issue.region}
          width={64}
          height={48}
          alt=""
          className={cn(issue.reviewState === "Dismissed" && "opacity-60")}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <IdChip id={id} confirmed={confirmed} />
            {confirmed ? <StatusChip status={issue.status} /> : <ReviewChip state={issue.reviewState} />}
          </span>
          <span className={cn("mt-1 line-clamp-2 text-p3 font-medium", issue.reviewState === "Dismissed" ? "text-muted line-through decoration-dusk-400" : "text-ink")}>
            {issue.title}
          </span>
        </span>
      </button>

      {selected && <IssueDetail issue={issue} comparison={comparison} onConfirm={onConfirm} onDismiss={onDismiss} />}
    </li>
  );
}

function IssueDetail({ issue, comparison, onConfirm, onDismiss }: Omit<IssueCardProps, "selected" | "onSelect">) {
  const image = { width: comparison.width, height: comparison.height };
  const confirmed = issue.reviewState === "Confirmed";

  return (
    <div className="flex flex-col gap-4 border-t border-line p-3 pt-4" data-testid="issue-detail">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["Design", comparison.referenceImage.id],
            ["Website", comparison.implementationImage.id],
          ] as const
        ).map(([label, imageId]) => (
          <figure key={label} className="flex min-w-0 flex-col gap-1">
            <CropPreview imageId={imageId} image={image} region={issue.region} width={160} height={108} alt={`${label} crop of ${displayId(issue)}`} className="w-full" />
            <figcaption className="text-p4 font-medium text-muted">{label}</figcaption>
          </figure>
        ))}
      </div>

      <TitleField key={`t:${issue.title}`} issue={issue} />
      <DescriptionField key={`d:${issue.description}`} issue={issue} />

      {issue.reviewState === "Pending" && (
        <div className="flex flex-col gap-2">
          <p className="text-p4 text-muted">This is a potential difference until you review it.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="m" icon={Check} onClick={() => onConfirm(issue.id)} data-testid="confirm-bug">
              Confirm Bug
            </Button>
            <Button size="m" variant="tertiary" icon={X} onClick={() => onDismiss(issue.id)} data-testid="dismiss">
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {confirmed && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-w-0 flex-col gap-1 text-p4 font-medium text-muted">
              Severity
              <SeveritySelect issue={issue} />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-p4 font-medium text-muted">
              Status
              <StatusSelect issue={issue} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href={`/issues?comparison=${comparison.id}`}
              className="flex min-h-10 items-center gap-1 text-p3 font-medium text-brand underline-offset-4 hover:underline"
            >
              View in Design Issues
              <ArrowUpRight aria-hidden className="size-4" />
            </Link>
            {canReturnToReview(issue) && (
              <button type="button" onClick={() => qaStore.returnToReview(issue.id)} className="flex min-h-10 items-center gap-1 text-p3 font-medium text-muted hover:text-ink">
                <Undo2 aria-hidden className="size-4" />
                Return to Review
              </button>
            )}
          </div>
        </div>
      )}

      {issue.reviewState === "Dismissed" && (
        <div className="flex items-center justify-between gap-3 rounded-control bg-cool px-3 py-2">
          <p className="text-p3 text-muted">Dismissed — not treated as a bug.</p>
          <Button size="m" variant="tertiary" icon={RotateCcw} onClick={() => qaStore.restore(issue.id)}>
            Restore
          </Button>
        </div>
      )}

      <p className="text-p4 text-muted tabular-nums">
        {issue.source === "manual" ? "Added manually" : "Found by pixel comparison"} · {formatRegionShort(issue.region)}
      </p>
    </div>
  );
}

/* Inline editing (PRD Step 6): saved when the field loses focus; Esc reverts. */
function TitleField({ issue }: { issue: Issue }) {
  const [value, setValue] = useState(issue.title);
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-p4 font-medium text-muted">
        Title
      </label>
      <input
        id={id}
        value={value}
        maxLength={TEXT_LIMITS.title}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => qaStore.edit(issue.id, { title: value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValue(issue.title);
            e.stopPropagation();
          }
        }}
        className="h-10 rounded-control border-[1.5px] border-line bg-white px-3 text-p3 font-medium text-ink hover:border-line-hover focus:border-focus focus:outline-none"
        data-testid="issue-title"
      />
    </div>
  );
}

function DescriptionField({ issue }: { issue: Issue }) {
  const [value, setValue] = useState(issue.description);
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-p4 font-medium text-muted">
        Description
      </label>
      <textarea
        id={id}
        value={value}
        rows={3}
        maxLength={TEXT_LIMITS.description}
        placeholder="What's wrong and what it should look like"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => qaStore.edit(issue.id, { description: value })}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue(issue.description);
            e.stopPropagation();
          }
        }}
        className="resize-y rounded-control border-[1.5px] border-line bg-white px-3 py-2 text-p3 text-ink placeholder:text-dusk-500 hover:border-line-hover focus:border-focus focus:outline-none"
        data-testid="issue-description"
      />
    </div>
  );
}
