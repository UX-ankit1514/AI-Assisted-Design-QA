/*
 * Global misalignment check (PRD §9.4): if moving the whole build screenshot by a few pixels makes most of
 * the difference disappear, the screenshots are probably misaligned (scroll position, a taller header,
 * a different viewport) and listing dozens of "bugs" would be misleading.
 *
 * Works on downsampled luma with a coarse-to-fine search so it stays fast on 12 MP images.
 */

export interface ShiftEstimate {
  /** Build content sits this many px to the right of the design (negative = left). */
  dx: number;
  /** Build content sits this many px below the design (negative = above). */
  dy: number;
  /** Mean absolute luma difference with no shift. */
  baseError: number;
  /** Mean absolute luma difference at the best shift. */
  bestError: number;
}

interface Plane {
  data: Float32Array;
  width: number;
  height: number;
  scale: number;
}

function downsample(luma: Uint8Array, width: number, height: number, scale: number): Plane {
  const w = Math.max(1, Math.floor(width / scale));
  const h = Math.max(1, Math.floor(height / scale));
  const out = new Float32Array(w * h);
  const area = scale * scale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let yy = 0; yy < scale; yy++) {
        const row = (y * scale + yy) * width + x * scale;
        for (let xx = 0; xx < scale; xx++) sum += luma[row + xx];
      }
      out[y * w + x] = sum / area;
    }
  }
  return { data: out, width: w, height: h, scale };
}

/** Mean |A(x,y) − B(x+dx, y+dy)| over the interior, so every offset is scored on the same area. */
function shiftError(a: Plane, b: Plane, dx: number, dy: number, margin: number): number {
  const { width: w, height: h } = a;
  let sum = 0;
  let n = 0;
  for (let y = margin; y < h - margin; y++) {
    const rowA = y * w;
    const rowB = (y + dy) * w + dx;
    for (let x = margin; x < w - margin; x++) {
      sum += Math.abs(a.data[rowA + x] - b.data[rowB + x]);
      n++;
    }
  }
  return n ? sum / n : 0;
}

/** Same score at full resolution on a sparse grid — used to refine the downsampled estimate to the pixel. */
function fullResError(a: Uint8Array, b: Uint8Array, width: number, height: number, dx: number, dy: number, margin: number, stride: number): number {
  let sum = 0;
  let n = 0;
  for (let y = margin; y < height - margin; y += stride) {
    const rowA = y * width;
    const rowB = (y + dy) * width + dx;
    for (let x = margin; x < width - margin; x += stride) {
      sum += Math.abs(a[rowA + x] - b[rowB + x]);
      n++;
    }
  }
  return n ? sum / n : 0;
}

function bestShift(a: Plane, b: Plane, cx: number, cy: number, radius: number, margin: number) {
  let best = { dx: 0, dy: 0, error: Infinity };
  for (let dy = cy - radius; dy <= cy + radius; dy++) {
    if (Math.abs(dy) > margin) continue;
    for (let dx = cx - radius; dx <= cx + radius; dx++) {
      if (Math.abs(dx) > margin) continue;
      const error = shiftError(a, b, dx, dy, margin);
      // Prefer the smaller shift on ties so identical areas don't report a phantom offset.
      if (error < best.error - 1e-9 || (Math.abs(error - best.error) <= 1e-9 && Math.abs(dx) + Math.abs(dy) < Math.abs(best.dx) + Math.abs(best.dy))) {
        best = { dx, dy, error };
      }
    }
  }
  return best;
}

export function estimateGlobalShift(lumaA: Uint8Array, lumaB: Uint8Array, width: number, height: number, maxShift = 48): ShiftEstimate {
  const none = { dx: 0, dy: 0, baseError: 0, bestError: 0 };
  // Fine level: about 200k samples. Coarse level: the search radius is at most 4 samples.
  const fineScale = Math.max(1, Math.round(Math.sqrt((width * height) / 200_000)));
  const coarseScale = Math.max(fineScale, Math.ceil(maxShift / 4));
  const coarseA = downsample(lumaA, width, height, coarseScale);
  const coarseB = downsample(lumaB, width, height, coarseScale);
  const coarseMargin = Math.ceil(maxShift / coarseScale);
  if (coarseA.width <= coarseMargin * 2 + 4 || coarseA.height <= coarseMargin * 2 + 4) return none;

  const coarse = bestShift(coarseA, coarseB, 0, 0, coarseMargin, coarseMargin);

  const fineA = fineScale === coarseScale ? coarseA : downsample(lumaA, width, height, fineScale);
  const fineB = fineScale === coarseScale ? coarseB : downsample(lumaB, width, height, fineScale);
  const fineMargin = Math.ceil(maxShift / fineScale) + Math.ceil(coarseScale / fineScale);
  if (fineA.width <= fineMargin * 2 + 4 || fineA.height <= fineMargin * 2 + 4) return none;

  const ratio = coarseScale / fineScale;
  const baseError = shiftError(fineA, fineB, 0, 0, fineMargin);
  const fine = bestShift(fineA, fineB, coarse.dx * ratio, coarse.dy * ratio, Math.ceil(ratio), fineMargin);
  // The coarse search can miss tiny shifts entirely; also try a small window around zero.
  const nearZero = bestShift(fineA, fineB, 0, 0, Math.min(4, fineMargin), fineMargin);
  const best = nearZero.error < fine.error ? nearZero : fine;
  let dx = best.dx * fineScale;
  let dy = best.dy * fineScale;

  // Pixel-accurate refinement around the downsampled answer.
  if (fineScale > 1 && (dx !== 0 || dy !== 0)) {
    const margin = maxShift + fineScale * 2;
    const stride = Math.max(1, Math.round(Math.sqrt((width * height) / 150_000))) | 1;
    if (width > margin * 2 + stride && height > margin * 2 + stride) {
      let bestError = Infinity;
      const cx = dx;
      const cy = dy;
      for (let ty = cy - fineScale; ty <= cy + fineScale; ty++) {
        for (let tx = cx - fineScale; tx <= cx + fineScale; tx++) {
          const error = fullResError(lumaA, lumaB, width, height, tx, ty, margin, stride);
          if (error < bestError) {
            bestError = error;
            dx = tx;
            dy = ty;
          }
        }
      }
    }
  }

  return { dx, dy, baseError, bestError: Math.min(best.error, baseError) };
}

/** True when a shift explains most of the difference — the threshold is a tuning knob, not a rule. */
export function isLikelyMisaligned(estimate: ShiftEstimate): boolean {
  return (estimate.dx !== 0 || estimate.dy !== 0) && estimate.baseError > 0.5 && estimate.bestError <= estimate.baseError * 0.4;
}

export function describeShift({ dx, dy }: { dx: number; dy: number }): string {
  const parts: string[] = [];
  if (dy) parts.push(`${Math.abs(dy)} px ${dy > 0 ? "down" : "up"}`);
  if (dx) parts.push(`${Math.abs(dx)} px ${dx > 0 ? "right" : "left"}`);
  return parts.join(" and ");
}
