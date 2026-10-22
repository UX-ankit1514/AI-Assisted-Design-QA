"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Rect } from "@/lib/engine/types";

/*
 * One zoom/pan transform shared by every pane, so the design and the website stay aligned while you
 * inspect them (PRD §7 "synchronised viewing controls"). Coordinates: screen = image × scale + offset.
 */

export interface Transform {
  scale: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Low enough to fit a 40,000 px landing page on one screen. */
export const MIN_SCALE = 0.01;
export const MAX_SCALE = 8;
const GUTTER = 16;
const OVERSCROLL = 96;
const FOCUS_MAX_SCALE = 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useViewport(image: Size) {
  const [pane, setPane] = useState<Size>({ width: 0, height: 0 });
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const paneRef = useRef<Size>({ width: 0, height: 0 });
  const transformRef = useRef(transform);
  const frame = useRef(0);
  const observer = useRef<ResizeObserver | null>(null);

  /** Keeps at least part of the image on screen; centres an axis that fits entirely. */
  const settle = useCallback(
    (t: Transform, size: Size = paneRef.current): Transform => {
      const scale = clamp(t.scale, MIN_SCALE, MAX_SCALE);
      const w = image.width * scale;
      const h = image.height * scale;
      const x = w + GUTTER * 2 <= size.width ? (size.width - w) / 2 : clamp(t.x, size.width - w - OVERSCROLL, OVERSCROLL);
      const y = h + GUTTER * 2 <= size.height ? (size.height - h) / 2 : clamp(t.y, size.height - h - OVERSCROLL, OVERSCROLL);
      return { scale, x, y };
    },
    [image.width, image.height],
  );

  const apply = useCallback(
    (next: Transform) => {
      cancelAnimationFrame(frame.current);
      const settled = settle(next);
      transformRef.current = settled;
      setTransform(settled);
    },
    [settle],
  );

  const animateTo = useCallback(
    (target: Transform) => {
      const to = settle(target);
      const from = transformRef.current;
      cancelAnimationFrame(frame.current);
      if (prefersReducedMotion()) {
        transformRef.current = to;
        setTransform(to);
        return;
      }
      const start = performance.now();
      const duration = 240;
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const e = 1 - Math.pow(1 - p, 3);
        const t = { scale: from.scale + (to.scale - from.scale) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
        transformRef.current = t;
        setTransform(t);
        if (p < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [settle],
  );

  const fitWidthTransform = useCallback(
    (size: Size = paneRef.current): Transform => {
      const scale = Math.min(1, (size.width - GUTTER * 2) / image.width);
      return { scale, x: GUTTER, y: GUTTER };
    },
    [image.width],
  );

  const fitScreenTransform = useCallback(
    (size: Size = paneRef.current): Transform => {
      const scale = Math.min((size.width - GUTTER * 2) / image.width, (size.height - GUTTER * 2) / image.height);
      return { scale, x: (size.width - image.width * scale) / 2, y: (size.height - image.height * scale) / 2 };
    },
    [image.width, image.height],
  );

  /** Callback ref for the pane that defines the shared size (all panes are the same size). */
  const measureRef = useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      if (!node) return;
      let first = paneRef.current.width === 0;
      observer.current = new ResizeObserver(([entry]) => {
        const size = { width: entry.contentRect.width, height: entry.contentRect.height };
        if (size.width === 0 || size.height === 0) return;
        paneRef.current = size;
        setPane(size);
        if (first) {
          first = false;
          const t = settle(fitWidthTransform(size), size);
          transformRef.current = t;
          setTransform(t);
        } else {
          const t = settle(transformRef.current, size);
          transformRef.current = t;
          setTransform(t);
        }
      });
      observer.current.observe(node);
    },
    [settle, fitWidthTransform],
  );

  useEffect(() => () => {
    observer.current?.disconnect();
    cancelAnimationFrame(frame.current);
  }, []);

  const zoomAt = useCallback(
    (nextScale: number, anchor?: { x: number; y: number }, animate = false) => {
      const current = transformRef.current;
      const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const a = anchor ?? { x: paneRef.current.width / 2, y: paneRef.current.height / 2 };
      const next = { scale, x: a.x - ((a.x - current.x) * scale) / current.scale, y: a.y - ((a.y - current.y) * scale) / current.scale };
      if (animate) animateTo(next);
      else apply(next);
    },
    [apply, animateTo],
  );

  const zoomBy = useCallback((factor: number, anchor?: { x: number; y: number }, animate = false) => zoomAt(transformRef.current.scale * factor, anchor, animate), [zoomAt]);

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const t = transformRef.current;
      apply({ scale: t.scale, x: t.x + dx, y: t.y + dy });
    },
    [apply],
  );

  /** Zooms and pans so `rect` (image px) fills the pane comfortably — used when an issue is selected. */
  const focusRect = useCallback(
    (rect: Rect, animate = true) => {
      const size = paneRef.current;
      if (!size.width) return;
      const pad = Math.min(160, Math.max(48, size.width * 0.12));
      const fit = Math.min((size.width - pad * 2) / Math.max(rect.width, 1), (size.height - pad * 2) / Math.max(rect.height, 1));
      const scale = clamp(Math.min(fit, FOCUS_MAX_SCALE), MIN_SCALE, MAX_SCALE);
      const target = { scale, x: size.width / 2 - (rect.x + rect.width / 2) * scale, y: size.height / 2 - (rect.y + rect.height / 2) * scale };
      if (animate) animateTo(target);
      else apply(target);
    },
    [animateTo, apply],
  );

  const toScreen = useCallback((r: Rect, t: Transform = transformRef.current): Rect => ({ x: r.x * t.scale + t.x, y: r.y * t.scale + t.y, width: r.width * t.scale, height: r.height * t.scale }), []);

  const toImage = useCallback(
    (p: { x: number; y: number }) => {
      const t = transformRef.current;
      return { x: (p.x - t.x) / t.scale, y: (p.y - t.y) / t.scale };
    },
    [],
  );

  return {
    pane,
    transform,
    measureRef,
    zoomBy,
    zoomAt,
    panBy,
    focusRect,
    toScreen,
    toImage,
    fitScreen: (animate = true) => (animate ? animateTo(fitScreenTransform()) : apply(fitScreenTransform())),
    fitWidth: () => animateTo(fitWidthTransform()),
    actualSize: (animate = true) => zoomAt(1, undefined, animate),
  };
}

export type Viewport = ReturnType<typeof useViewport>;
