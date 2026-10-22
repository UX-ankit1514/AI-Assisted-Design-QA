import { toSource } from "./sources";
import type { ImageSource, RasterImage, Rect, RegionDescription, RegionHint } from "./types";

/*
 * Deterministic, honest wording for a candidate region (PRD Step 5). It names *where* the difference is and
 * suggests *what to check*, based only on what the pixels can support. It never states CSS or Figma values —
 * a screenshot cannot tell us a font is 44px instead of 56px.
 */

const MAX_SAMPLES = 160_000;
/** Pixels read from the source per call when sampling a large region. */
const READ_CHUNK = 1_000_000;
const INK_DELTA = 24;

interface CropStats {
  ink: number;
  edges: Uint8Array;
}

/** Luma of a pixel composited onto white, matching the comparison's normalisation. */
function luma(data: Uint8ClampedArray | Uint8Array, i: number): number {
  const k = data[i + 3] / 255;
  const v = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
  return v * k + 255 * (1 - k);
}

function cropStats(source: ImageSource, r: Rect, stride: number): CropStats {
  const cols = Math.ceil(r.width / stride);
  const rows = Math.ceil(r.height / stride);
  const values = new Float32Array(cols * rows);
  const histogram = new Uint32Array(64);
  // Read the region in horizontal chunks (a multiple of the stride tall) so huge regions stay cheap.
  const chunkRows = Math.max(stride, Math.floor(READ_CHUNK / r.width / stride) * stride);
  for (let cy = 0; cy < r.height; cy += chunkRows) {
    const h = Math.min(chunkRows, r.height - cy);
    const data = source.readRect(r.x, r.y + cy, r.width, h);
    for (let ly = 0; ly < h; ly += stride) {
      const row = (cy + ly) / stride;
      for (let col = 0; col < cols; col++) {
        const v = luma(data, (ly * r.width + col * stride) * 4);
        values[row * cols + col] = v;
        histogram[(v / 4) | 0]++;
      }
    }
  }
  // The most common brightness is taken as the background of this crop.
  let mode = 0;
  for (let b = 1; b < 64; b++) if (histogram[b] > histogram[mode]) mode = b;
  const background = mode * 4 + 2;

  let inkCount = 0;
  const edges = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const p = row * cols + col;
      const v = values[p];
      if (Math.abs(v - background) > INK_DELTA) inkCount++;
      const right = col + 1 < cols ? values[p + 1] : v;
      const down = row + 1 < rows ? values[p + cols] : v;
      if (Math.abs(right - v) > INK_DELTA || Math.abs(down - v) > INK_DELTA) edges[p] = 1;
    }
  }
  return { ink: inkCount / values.length, edges };
}

function edgeOverlap(a: Uint8Array, b: Uint8Array): number {
  let both = 0;
  let either = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) either++;
    if (a[i] && b[i]) both++;
  }
  return either === 0 ? 1 : both / either;
}

export function classifyRegion(design: RasterImage | ImageSource, build: RasterImage | ImageSource, r: Rect): RegionHint {
  const stride = Math.max(1, Math.ceil(Math.sqrt((r.width * r.height) / MAX_SAMPLES)));
  const a = cropStats(toSource(design), r, stride);
  const b = cropStats(toSource(build), r, stride);

  const lo = Math.min(a.ink, b.ink);
  const hi = Math.max(a.ink, b.ink);
  if (hi > 0.02 && lo < hi * 0.35) return "missing-or-extra";
  if (edgeOverlap(a.edges, b.edges) >= 0.6) return "colour";
  if (r.height <= 96 && r.width / r.height >= 2.5) return "typography";
  return "layout";
}

const HINT_COPY: Record<RegionHint, { title: string; check: string }> = {
  colour: {
    title: "Possible colour difference",
    check: "The shapes here line up with the design, but the colours don't. Check fill, text and border colours.",
  },
  "missing-or-extra": {
    title: "Possible missing or extra element",
    check: "Something appears in one screenshot but not the other. Check for a missing or added element, icon or text.",
  },
  typography: {
    title: "Possible text or spacing difference",
    check: "This line of content differs from the design. Check the font size, weight and line height, and the spacing around it.",
  },
  layout: {
    title: "Possible size or position difference",
    check: "This area differs from the design. Check the size, position and spacing of the elements here.",
  },
};

/** "near the upper left", "across the top", "near the centre". */
export function describeLocation(r: Rect, imageWidth: number, imageHeight: number): string {
  const cx = (r.x + r.width / 2) / imageWidth;
  const cy = (r.y + r.height / 2) / imageHeight;
  const v = cy < 0.15 ? "top" : cy < 0.4 ? "upper" : cy < 0.6 ? "middle" : cy < 0.85 ? "lower" : "bottom";
  if (r.width > imageWidth * 0.6) {
    return v === "top" || v === "bottom" ? `across the ${v}` : `across the ${v} area`;
  }
  const h = cx < 0.33 ? "left" : cx > 0.67 ? "right" : "centre";
  if (v === "middle" && h === "centre") return "near the centre";
  return `near the ${v} ${h}`;
}

export function describeRegion(design: RasterImage | ImageSource, build: RasterImage | ImageSource, r: Rect & { density: number }): RegionDescription {
  const hint = classifyRegion(design, build, r);
  const copy = HINT_COPY[hint];
  const share = Math.max(1, Math.round(r.density * 100));
  return {
    hint,
    title: `${copy.title} ${describeLocation(r, design.width, design.height)}`,
    description: `${copy.check} About ${share}% of the pixels in the highlighted area changed.`,
  };
}
