import { cn } from "@/lib/cn";
import type { Issue } from "@/lib/store/types";
import { displayId } from "@/lib/store/types";
import type { Transform } from "./useViewport";

/*
 * Region rectangles drawn in screen space, so outlines and labels stay crisp at any zoom.
 * Potential differences are dashed; confirmed bugs are solid; the selected one is heavier and labelled.
 */
export function Highlights({
  issues,
  transform: t,
  selectedId,
  showDismissed,
  interactive,
}: {
  issues: Issue[];
  transform: Transform;
  selectedId: string | null;
  showDismissed: boolean;
  interactive: boolean;
}) {
  const visible = issues.filter((i) => showDismissed || i.reviewState !== "Dismissed" || i.id === selectedId);
  // Draw the selected region last so it sits on top of overlapping ones.
  visible.sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));

  return (
    <div className={cn("absolute inset-0 z-10", !interactive && "pointer-events-none")}>
      {visible.map((issue) => {
        const r = issue.region;
        const left = r.x * t.scale + t.x;
        const top = r.y * t.scale + t.y;
        const width = Math.max(6, r.width * t.scale);
        const height = Math.max(6, r.height * t.scale);
        const selected = issue.id === selectedId;
        const id = displayId(issue);
        const state = issue.reviewState;
        return (
          <button
            key={issue.id}
            type="button"
            tabIndex={-1}
            data-issue-id={issue.id}
            data-testid={`highlight-${issue.label}`}
            data-selected={selected || undefined}
            data-state={state}
            aria-label={`${id}: ${issue.title}`}
            className={cn(
              "absolute rounded-[2px] transition-[border-color,background-color,box-shadow] duration-150",
              state === "Pending" && "border-2 border-dashed border-ruby-500 hover:bg-ruby-500/10",
              state === "Confirmed" && "border-2 border-ruby-700 bg-ruby-700/10 hover:bg-ruby-700/15",
              state === "Dismissed" && "border-2 border-dashed border-dusk-500 hover:bg-dusk-500/10",
              selected && "border-[3px] border-solid shadow-[0_0_0_1px_white,0_0_0_4px_rgb(207_19_34/0.25)]",
              selected && state !== "Dismissed" && "border-ruby-700",
            )}
            style={{ left, top, width, height }}
          >
            <span
              className={cn(
                "pointer-events-none absolute -top-[22px] -left-[2px] rounded-t-[2px] px-1.5 text-p4 leading-[20px] font-semibold whitespace-nowrap",
                state === "Dismissed" ? "bg-dusk-600 text-white" : selected || state === "Confirmed" ? "bg-ruby-700 text-white" : "bg-ruby-500 text-white",
                !selected && "opacity-90",
              )}
            >
              {id}
            </span>
          </button>
        );
      })}
    </div>
  );
}
