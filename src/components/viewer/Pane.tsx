"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { Rect } from "@/lib/engine/types";
import { cn } from "@/lib/cn";
import type { Issue } from "@/lib/store/types";
import { Highlights } from "./Highlights";
import type { Size, Transform, Viewport } from "./useViewport";

/** Style for an image layer: native size, positioned by the shared transform. */
export function layerStyle(t: Transform, image: Size): CSSProperties {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: image.width,
    height: image.height,
    maxWidth: "none",
    transformOrigin: "0 0",
    transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`,
    imageRendering: t.scale >= 2 ? "pixelated" : "auto",
  };
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  issueId: string | null;
  mode: "pan" | "draw";
}

interface PaneProps {
  label: string;
  testId: string;
  viewport: Viewport;
  image: Size;
  /** Only one pane reports its size; the others are laid out identically. */
  measure?: boolean;
  issues: Issue[];
  selectedId: string | null;
  showHighlights: boolean;
  showDismissed: boolean;
  addMode: boolean;
  onSelect: (id: string) => void;
  onDraw: (rect: Rect) => void;
  children: ReactNode;
}

const MIN_DRAWN = 8;

export function Pane({ label, testId, viewport, image, measure, issues, selectedId, showHighlights, showDismissed, addMode, onSelect, onDraw, children }: PaneProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const latest = useRef({ viewport, addMode });
  const [draft, setDraft] = useState<Rect | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    latest.current = { viewport, addMode };
  });

  const { measureRef } = viewport;
  const setNode = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      if (measure) measureRef(node);
    },
    [measure, measureRef],
  );

  // Wheel: scroll pans, ⌘/Ctrl + scroll (and trackpad pinch) zooms at the cursor. Needs a non-passive listener.
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const vp = latest.current.viewport;
      const box = node.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025));
        vp.zoomBy(factor, { x: event.clientX - box.left, y: event.clientY - box.top });
      } else {
        const unit = event.deltaMode === 1 ? 16 : 1;
        const dx = (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * unit;
        const dy = (event.shiftKey && !event.deltaX ? 0 : event.deltaY) * unit;
        vp.panBy(-dx, -dy);
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  function local(event: PointerEvent) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const p = local(event);
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-issue-id]");
    drag.current = {
      pointerId: event.pointerId,
      startX: p.x,
      startY: p.y,
      lastX: p.x,
      lastY: p.y,
      moved: false,
      issueId: target?.dataset.issueId ?? null,
      mode: addMode ? "draw" : "pan",
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const p = local(event);
    if (!d.moved && Math.hypot(p.x - d.startX, p.y - d.startY) > 4) {
      d.moved = true;
      if (d.mode === "pan") setGrabbing(true);
    }
    if (!d.moved) return;
    if (d.mode === "pan") {
      viewport.panBy(p.x - d.lastX, p.y - d.lastY);
    } else {
      setDraft({ x: Math.min(d.startX, p.x), y: Math.min(d.startY, p.y), width: Math.abs(p.x - d.startX), height: Math.abs(p.y - d.startY) });
    }
    d.lastX = p.x;
    d.lastY = p.y;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;
    setGrabbing(false);
    setDraft(null);
    if (d.mode === "draw" && d.moved) {
      const a = viewport.toImage({ x: d.startX, y: d.startY });
      const b = viewport.toImage(local(event));
      const x0 = Math.max(0, Math.round(Math.min(a.x, b.x)));
      const y0 = Math.max(0, Math.round(Math.min(a.y, b.y)));
      const x1 = Math.min(image.width, Math.round(Math.max(a.x, b.x)));
      const y1 = Math.min(image.height, Math.round(Math.max(a.y, b.y)));
      if (x1 - x0 >= MIN_DRAWN && y1 - y0 >= MIN_DRAWN) onDraw({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
      return;
    }
    if (!d.moved && d.issueId) onSelect(d.issueId);
  }

  return (
    <div
      ref={setNode}
      data-testid={testId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setGrabbing(false);
        setDraft(null);
      }}
      className={cn(
        "relative min-h-0 min-w-0 flex-1 touch-none overflow-hidden bg-dusk-300/60 select-none",
        addMode ? "cursor-crosshair" : grabbing ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      {children}
      {showHighlights && (
        <Highlights issues={issues} transform={viewport.transform} selectedId={selectedId} showDismissed={showDismissed} interactive={!addMode} />
      )}
      {draft && (
        <div aria-hidden className="pointer-events-none absolute border-2 border-dashed border-brand bg-arnique-500/15" style={{ left: draft.x, top: draft.y, width: draft.width, height: draft.height }} />
      )}
      <span className="pointer-events-none absolute top-3 left-3 z-20 rounded-control bg-white/95 px-2 py-1 text-p4 font-semibold text-ink shadow-raised">{label}</span>
    </div>
  );
}
