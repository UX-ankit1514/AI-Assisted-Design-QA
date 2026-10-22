import { Check, LoaderCircle } from "lucide-react";
import type { PipelineStage } from "@/lib/engine/pipeline";
import { cn } from "@/lib/cn";

export const STAGES: { id: PipelineStage; label: string }[] = [
  { id: "decode", label: "Reading screenshots" },
  { id: "normalise", label: "Normalising colour and transparency" },
  { id: "compare", label: "Comparing pixels" },
  { id: "group", label: "Grouping differences into regions" },
  { id: "prepare", label: "Preparing the workspace" },
];

/* Processing state (PRD Step 3): what is happening right now, so a long comparison never looks frozen. */
export function ProgressSteps({ stage, progress = 0 }: { stage: PipelineStage; progress?: number }) {
  const current = STAGES.findIndex((s) => s.id === stage);
  // Long pages are compared band by band, so the pixel step can report how far it has got.
  const percent = stage === "compare" ? Math.round(progress * 100) : null;
  return (
    <div role="status" aria-live="polite" data-testid="progress" className="rounded-card border border-arnique-200 bg-arnique-100 p-4">
      <p className="sr-only">
        {STAGES[current]?.label ?? "Comparing"}
        {percent != null ? `, ${percent}%` : "…"}
      </p>
      <ol className="grid gap-2 sm:grid-cols-5 sm:gap-3">
        {STAGES.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.id} aria-hidden className={cn("flex items-center gap-2 text-p4 sm:flex-col sm:items-start", active ? "font-semibold text-arnique-1000" : done ? "text-arnique-900" : "text-muted")}>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  done ? "border-brand bg-brand text-white" : active ? "border-brand bg-white text-brand" : "border-dusk-400 bg-white",
                )}
              >
                {done ? <Check className="size-3.5" /> : active ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              </span>
              <span>
                {s.label}
                {active && percent != null && <span className="font-normal tabular-nums"> · {percent}%</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
