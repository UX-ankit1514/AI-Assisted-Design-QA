import pixelmatch from "pixelmatch";
import { describeShift, estimateGlobalShift, isLikelyMisaligned } from "./alignment";
import { flattenPixels, lumaAt } from "./normalize";
import { resolveOptions } from "./presets";
import { groupRegions } from "./regions";
import { toSource } from "./sources";
import type { CompareOptions, ComparisonResult, EngineWarning, ImageSource, MaskImage, RasterImage } from "./types";

export class DimensionMismatchError extends Error {
  constructor(
    readonly design: { width: number; height: number },
    readonly build: { width: number; height: number },
  ) {
    super(`Screenshot dimensions differ: ${design.width}×${design.height} vs ${build.width}×${build.height}.`);
    this.name = "DimensionMismatchError";
  }
}

/** Ruby-600 — the mask colour drawn over the dimmed design in "Difference Mask" mode. */
const MASK_COLOUR: [number, number, number] = [245, 34, 45];

/** Pixels per band. Keeps memory flat however long the page is. */
const BAND_PIXELS = 4_000_000;
/**
 * Rows of context above and below each band. pixelmatch's anti-aliasing check looks two pixels away,
 * so with this overlap a banded comparison gives exactly the same answer as a single pass.
 */
const BAND_CONTEXT = 2;
/** Canvas-safe size for the stored mask; longer pages get a downscaled mask. */
const MASK_MAX_SIDE = 16_384;
const MASK_MAX_PIXELS = 24_000_000;

export type CompareStage = "normalise" | "compare" | "group";

export interface CompareHooks {
  onStage?: (stage: CompareStage) => void;
  /** 0–1 while pixels are being compared. */
  onProgress?: (fraction: number) => void;
  /** Rows per band; normally derived from the image width. Exposed for tests. */
  bandRows?: number;
}

/**
 * Compares two screenshots pixel by pixel (PRD §12.4). Deterministic and local: no network, no AI.
 * Both images must have identical dimensions — they are never resized to force a match.
 * Works band by band, so long landing pages are handled with flat memory use.
 */
export function compareScreenshots(
  reference: RasterImage | ImageSource,
  implementation: RasterImage | ImageSource,
  options: Partial<CompareOptions> = {},
  hooks: CompareHooks = {},
): ComparisonResult {
  const design = toSource(reference);
  const build = toSource(implementation);
  if (design.width !== build.width || design.height !== build.height) {
    throw new DimensionMismatchError(design, build);
  }
  const opts = { ...resolveOptions(), ...options };
  const { width, height } = design;
  const totalPixels = width * height;

  // Stages B + C — normalise and compare, one band at a time.
  hooks.onStage?.("normalise");
  const mask = new Uint8Array(totalPixels);
  const lumaA = new Uint8Array(totalPixels);
  const lumaB = new Uint8Array(totalPixels);
  const bandRows = Math.max(8, Math.round(hooks.bandRows ?? BAND_PIXELS / width));
  const output = new Uint8ClampedArray(width * Math.min(height, bandRows + BAND_CONTEXT * 2) * 4);
  let diffPixelCount = 0;

  hooks.onStage?.("compare");
  for (let y0 = 0; y0 < height; y0 += bandRows) {
    const y1 = Math.min(height, y0 + bandRows);
    const top = Math.max(0, y0 - BAND_CONTEXT);
    const rows = Math.min(height, y1 + BAND_CONTEXT) - top;
    const a = flattenPixels(design.readRect(0, top, width, rows));
    const b = flattenPixels(build.readRect(0, top, width, rows));
    const out = output.subarray(0, width * rows * 4);
    out.fill(0);
    // In mask mode pixelmatch paints only counted (non anti-aliasing) differences, opaque.
    pixelmatch(a, b, out, width, rows, { threshold: opts.threshold, includeAA: opts.includeAA, diffMask: true, diffColor: MASK_COLOUR });

    const first = (y0 - top) * width;
    const last = (y1 - top) * width;
    const offset = top * width;
    for (let p = first; p < last; p++) {
      const i = p * 4;
      if (out[i + 3] === 255) {
        mask[offset + p] = 1;
        diffPixelCount++;
      }
      lumaA[offset + p] = lumaAt(a, i);
      lumaB[offset + p] = lumaAt(b, i);
    }
    hooks.onProgress?.(y1 / height);
  }
  const differencePercentage = (diffPixelCount / totalPixels) * 100;

  // Stage D — group into candidate regions.
  hooks.onStage?.("group");
  const { regions, droppedForLimit } = groupRegions(mask, width, height, opts);

  const warnings: EngineWarning[] = [];
  const coverage = regions.reduce((sum, r) => sum + r.width * r.height, 0) / totalPixels;
  if (diffPixelCount > 0 && differencePercentage >= 0.5 && (regions.length >= 3 || coverage >= 0.2 || differencePercentage >= 3)) {
    const estimate = estimateGlobalShift(lumaA, lumaB, width, height);
    if (isLikelyMisaligned(estimate)) {
      const offset = { dx: estimate.dx, dy: estimate.dy };
      warnings.push({
        code: "possible-misalignment",
        offset,
        message: `Most of the differences disappear if the website screenshot is moved about ${describeShift({ dx: -offset.dx, dy: -offset.dy })}. The screenshots may be misaligned — a different scroll position, viewport or a taller element above.`,
      });
    } else if (differencePercentage >= 25) {
      warnings.push({
        code: "broad-difference",
        message: "These screenshots differ across most of the image. Check that both show the same page, in the same state and at the same viewport.",
      });
    }
  }
  if (droppedForLimit > 0) {
    warnings.push({
      code: "region-limit",
      message: `Showing the ${regions.length} largest regions. ${droppedForLimit} smaller ${droppedForLimit === 1 ? "region was" : "regions were"} left out — try the Relaxed sensitivity or compare a smaller section.`,
    });
  }

  return { width, height, totalPixels, diffPixelCount, differencePercentage, diffMask: maskImage(mask, width, height), regions, warnings };
}

/** Paints the 0/1 mask as an image, shrinking it for very long pages (any changed pixel marks its block). */
export function maskImage(mask: Uint8Array, width: number, height: number): MaskImage {
  let scale = 1;
  while (Math.ceil(width / scale) > MASK_MAX_SIDE || Math.ceil(height / scale) > MASK_MAX_SIDE || Math.ceil(width / scale) * Math.ceil(height / scale) > MASK_MAX_PIXELS) {
    scale++;
  }
  const mw = Math.ceil(width / scale);
  const mh = Math.ceil(height / scale);
  const data = new Uint8ClampedArray(mw * mh * 4);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const maskRow = ((y / scale) | 0) * mw;
    for (let x = 0; x < width; x++) {
      if (!mask[row + x]) continue;
      const i = (maskRow + ((x / scale) | 0)) * 4;
      data[i] = MASK_COLOUR[0];
      data[i + 1] = MASK_COLOUR[1];
      data[i + 2] = MASK_COLOUR[2];
      data[i + 3] = 255;
    }
  }
  return { width: mw, height: mh, scale, data };
}
