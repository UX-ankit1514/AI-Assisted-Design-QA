"use client";

import { Blend, Columns2, Eye, EyeOff, Layers, Maximize, MoveHorizontal, SquareDashedMousePointer, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Rect } from "@/lib/engine/types";
import { cn } from "@/lib/cn";
import { useImageUrl } from "@/lib/store/hooks";
import type { Comparison, Issue } from "@/lib/store/types";
import { layerStyle, Pane } from "./Pane";
import type { Viewport } from "./useViewport";

export type ViewMode = "side-by-side" | "overlay" | "mask";

export interface ViewerSettings {
  mode: ViewMode;
  showHighlights: boolean;
  showDismissed: boolean;
  addMode: boolean;
  overlayOpacity: number;
  overlayBlend: "normal" | "difference";
}

interface ViewerProps {
  comparison: Comparison;
  issues: Issue[];
  selectedId: string | null;
  viewport: Viewport;
  settings: ViewerSettings;
  onSettings: (patch: Partial<ViewerSettings>) => void;
  onSelect: (id: string) => void;
  onDraw: (rect: Rect) => void;
}

const MODES: { value: ViewMode; label: string; icon: LucideIcon }[] = [
  { value: "side-by-side", label: "Side by Side", icon: Columns2 },
  { value: "overlay", label: "Overlay", icon: Layers },
  { value: "mask", label: "Difference Mask", icon: Blend },
];

/* Main workspace viewer (PRD §7 Screen 2): side by side, overlay and difference mask, all on one transform. */
export function Viewer({ comparison, issues, selectedId, viewport, settings, onSettings, onSelect, onDraw }: ViewerProps) {
  const design = useImageUrl(comparison.referenceImage.id);
  const build = useImageUrl(comparison.implementationImage.id);
  const mask = useImageUrl(comparison.diffMaskImage.id);
  const image = { width: comparison.width, height: comparison.height };
  const t = viewport.transform;
  const style = layerStyle(t, image);
  const failed = design.failed || build.failed;

  const paneProps = {
    viewport,
    image,
    issues,
    selectedId,
    showHighlights: settings.showHighlights,
    showDismissed: settings.showDismissed,
    addMode: settings.addMode,
    onSelect,
    onDraw,
  };

  const img = (url: string | null, alt: string, extra?: React.CSSProperties, className?: string) =>
    url ? (
      // eslint-disable-next-line @next/next/no-img-element -- local blob URL, positioned by the shared transform
      <img src={url} alt={alt} draggable={false} style={{ ...style, ...extra }} className={className} />
    ) : null;

  return (
    <section aria-label="Screenshot viewer" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div role="toolbar" aria-label="Viewer controls" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-white px-3 py-2">
        <ToggleGroup
          type="single"
          variant="outline"
          value={settings.mode}
          onValueChange={(value) => value && onSettings({ mode: value as ViewMode })}
          aria-label="View mode"
        >
          {MODES.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label} className="h-10 gap-1.5 px-3 text-p3 data-[state=on]:bg-arnique-100 data-[state=on]:text-arnique-1000">
              <Icon aria-hidden className="size-4" />
              <span className="hidden xl:inline">{label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {settings.mode === "overlay" && (
          <div className="flex items-center gap-3 rounded-control border border-line px-3 py-1.5" data-testid="overlay-controls">
            <span className="text-p4 font-medium text-muted">Design</span>
            <Slider
              className="w-28"
              min={0}
              max={100}
              step={1}
              value={[settings.overlayOpacity]}
              onValueChange={([v]) => onSettings({ overlayOpacity: v })}
              aria-label="Website screenshot opacity"
            />
            <span className="text-p4 font-medium text-muted">Website</span>
            <label className="ml-1 flex items-center gap-1.5 text-p4 font-medium text-ink">
              <input
                type="checkbox"
                checked={settings.overlayBlend === "difference"}
                onChange={(e) => onSettings({ overlayBlend: e.target.checked ? "difference" : "normal" })}
                className="accent-[var(--color-brand)]"
              />
              Difference blend
            </label>
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <ToolButton
            icon={settings.showHighlights ? Eye : EyeOff}
            label={settings.showHighlights ? "Hide highlights (H)" : "Show highlights (H)"}
            pressed={settings.showHighlights}
            onClick={() => onSettings({ showHighlights: !settings.showHighlights })}
            text="Highlights"
          />
          <ToolButton
            icon={MoveHorizontal}
            label={settings.showDismissed ? "Hide dismissed regions" : "Show dismissed regions"}
            pressed={settings.showDismissed}
            onClick={() => onSettings({ showDismissed: !settings.showDismissed })}
            text="Dismissed"
            hideIcon
          />
          <ToolButton
            icon={SquareDashedMousePointer}
            label={settings.addMode ? "Stop adding issues (Esc)" : "Add an issue: drag a box on a screenshot"}
            pressed={settings.addMode}
            onClick={() => onSettings({ addMode: !settings.addMode })}
            text="Add Issue"
          />
          <span aria-hidden className="mx-1 h-6 w-px bg-line" />
          <ToolButton icon={ZoomOut} label="Zoom out (−)" onClick={() => viewport.zoomBy(1 / 1.25, undefined, true)} />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => viewport.actualSize()}
                className="h-10 min-w-14 rounded-control px-1 text-p3 font-medium text-ink tabular-nums hover:bg-cool"
                data-testid="zoom-level"
              >
                {Math.round(t.scale * 100)}%
              </button>
            </TooltipTrigger>
            <TooltipContent>Actual size, 100% (1)</TooltipContent>
          </Tooltip>
          <ToolButton icon={ZoomIn} label="Zoom in (+)" onClick={() => viewport.zoomBy(1.25, undefined, true)} />
          <ToolButton icon={Maximize} label="Fit to screen (0)" onClick={() => viewport.fitScreen()} text="Fit" />
        </div>
      </div>

      {settings.addMode && (
        <p className="border-b border-arnique-200 bg-arnique-100 px-4 py-2 text-p3 text-arnique-1000" role="status">
          Drag a box around anything the comparison missed. It becomes a confirmed bug you can describe in the sidebar. Press Esc to stop.
        </p>
      )}

      <div className="relative flex min-h-0 flex-1 gap-px bg-line">
        {failed ? (
          <div className="flex flex-1 items-center justify-center bg-cool p-8 text-center text-p3 text-muted">
            The screenshots for this comparison couldn&apos;t be loaded from this browser&apos;s storage. Start a new comparison to continue.
          </div>
        ) : settings.mode === "side-by-side" ? (
          <>
            <Pane {...paneProps} measure label="Figma design" testId="pane-design">
              {img(design.url, "Original Figma design")}
            </Pane>
            <Pane {...paneProps} label="Developed website" testId="pane-build">
              {img(build.url, "Developed website screenshot")}
            </Pane>
          </>
        ) : settings.mode === "overlay" ? (
          <Pane {...paneProps} measure label={`Overlay · website at ${settings.overlayOpacity}%`} testId="pane-overlay">
            {img(design.url, "Original Figma design")}
            {img(build.url, "Developed website screenshot, overlaid", {
              opacity: settings.overlayOpacity / 100,
              mixBlendMode: settings.overlayBlend === "difference" ? "difference" : "normal",
            })}
          </Pane>
        ) : (
          <Pane {...paneProps} measure label="Difference mask · red = changed pixels" testId="pane-mask">
            {img(design.url, "Original Figma design, dimmed", { opacity: 0.35, filter: "grayscale(1)" })}
            {img(mask.url, "Difference mask")}
          </Pane>
        )}
      </div>
    </section>
  );
}

function ToolButton({ icon: Icon, label, onClick, pressed, text, hideIcon }: { icon: LucideIcon; label: string; onClick: () => void; pressed?: boolean; text?: string; hideIcon?: boolean }): ReactNode {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={text ? undefined : label}
          aria-pressed={pressed}
          className={cn(
            "flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-control px-2 text-p3 font-medium transition-colors",
            pressed ? "bg-arnique-100 text-arnique-1000" : "text-ink hover:bg-cool",
          )}
        >
          {!hideIcon && <Icon aria-hidden className="size-4" />}
          {text && <span className={cn(!hideIcon && "hidden 2xl:inline")}>{text}</span>}
          {text && !hideIcon && <span className="sr-only 2xl:hidden">{text}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
