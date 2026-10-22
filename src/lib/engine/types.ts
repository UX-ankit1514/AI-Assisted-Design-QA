/** Decoded RGBA pixels, 4 bytes per pixel, row-major. */
export interface RasterImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/**
 * Pixels read on demand. Long landing pages are compared one horizontal band at a time through this,
 * so a 1440 × 30,000 screenshot never has to sit fully expanded in memory more than once.
 */
export interface ImageSource {
  width: number;
  height: number;
  /** RGBA for the rectangle, row-major, 4 bytes per pixel. Callers must not modify the result. */
  readRect(x: number, y: number, width: number, height: number): Uint8ClampedArray | Uint8Array;
}

/** The difference mask as an image. Very long pages get a downscaled mask (`scale` > 1) to stay within canvas limits. */
export interface MaskImage {
  width: number;
  height: number;
  /** Screenshot pixels per mask pixel. */
  scale: number;
  data: Uint8ClampedArray;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rectangular group of differing pixels — a *candidate* issue, never a confirmed one. */
export interface Region extends Rect {
  /** Stable label within one comparison: R1, R2… in reading order. */
  id: string;
  /** Differing pixels inside the box (after noise reduction). */
  diffPixels: number;
  /** diffPixels ÷ box area, 0–1. */
  density: number;
}

export type Sensitivity = "relaxed" | "balanced" | "strict";

/**
 * Tuning parameters. These are implementation knobs (PRD §9.3 Stage D), not quality rules —
 * the presets in presets.ts are the supported combinations.
 */
export interface CompareOptions {
  /** pixelmatch per-pixel colour distance threshold, 0–1. Smaller = more sensitive. */
  threshold: number;
  /** Count anti-aliased pixels as differences. Off by default: font smoothing would flood the results. */
  includeAA: boolean;
  /** Side of the square tiles the mask is divided into, in px. */
  tileSize: number;
  /** A tile is "active" when it holds at least this many differing pixels. */
  minTilePixels: number;
  /** Active tiles separated by up to this many empty tiles are merged into one region. */
  mergeGap: number;
  /** Regions with fewer differing pixels are dropped as noise. */
  minRegionPixels: number;
  /** Regions with a smaller bounding box (px²) are dropped as noise. */
  minRegionArea: number;
  /** Breathing room added around each box so the highlight doesn't sit on the changed pixels. */
  padding: number;
  /** Hard cap on the number of regions returned; the rest are reported in a warning. */
  maxRegions: number;
}

export type WarningCode = "possible-misalignment" | "broad-difference" | "region-limit";

export interface EngineWarning {
  code: WarningCode;
  message: string;
  /** For possible-misalignment: the offset that best lines the build up with the design, in px. */
  offset?: { dx: number; dy: number };
}

export type RegionHint = "colour" | "missing-or-extra" | "typography" | "layout";

export interface RegionDescription {
  hint: RegionHint;
  title: string;
  description: string;
}

export interface ComparisonResult {
  width: number;
  height: number;
  totalPixels: number;
  diffPixelCount: number;
  /** Share of differing pixels, 0–100. A technical image statistic, not a design-quality score. */
  differencePercentage: number;
  /** Mask image: differing pixels opaque Ruby, everything else transparent. */
  diffMask: MaskImage;
  regions: Region[];
  warnings: EngineWarning[];
}
