import type { CompareOptions, Rect, Region } from "./types";

/*
 * Stage D — group difference regions (PRD §9.3).
 *   1. drop isolated pixels (no differing neighbour) — single-pixel rendering noise
 *   2. divide the mask into square tiles and count differing pixels per tile
 *   3. tiles with enough pixels are "active"
 *   4. merge active tiles that touch or sit within `mergeGap` tiles of each other
 *   5. tighten each group's box to its real pixels, drop groups below the minimums, pad, merge overlaps
 *   6. sort in reading order, cap the count, label R1…Rn
 * The output is a handful of reviewable boxes — never one issue per pixel.
 */

export type GroupOptions = Pick<CompareOptions, "tileSize" | "minTilePixels" | "mergeGap" | "minRegionPixels" | "minRegionArea" | "padding" | "maxRegions">;

export interface GroupResult {
  regions: Region[];
  /** Regions left out because of `maxRegions`. */
  droppedForLimit: number;
}

interface Box extends Rect {
  diffPixels: number;
}

const MAX_BOXES_BEFORE_MERGE = 1500;

function hasDiffNeighbour(mask: Uint8Array, x: number, y: number, width: number, height: number): boolean {
  const x0 = x > 0 ? x - 1 : x;
  const x1 = x < width - 1 ? x + 1 : x;
  const y0 = y > 0 ? y - 1 : y;
  const y1 = y < height - 1 ? y + 1 : y;
  for (let yy = y0; yy <= y1; yy++) {
    const row = yy * width;
    for (let xx = x0; xx <= x1; xx++) {
      if ((xx !== x || yy !== y) && mask[row + xx]) return true;
    }
  }
  return false;
}

function intersectsOrTouches(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
    diffPixels: a.diffPixels + b.diffPixels,
  };
}

/** Merges boxes until none overlap or touch. */
export function mergeOverlapping(input: Box[]): Box[] {
  const boxes = input.slice();
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (intersectsOrTouches(boxes[i], boxes[j])) {
          boxes[i] = union(boxes[i], boxes[j]);
          boxes.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return boxes;
}

export function groupRegions(mask: Uint8Array, width: number, height: number, opts: GroupOptions): GroupResult {
  const T = Math.max(1, Math.round(opts.tileSize));
  const tw = Math.ceil(width / T);
  const th = Math.ceil(height / T);
  const tiles = tw * th;
  const count = new Int32Array(tiles);
  const minX = new Int32Array(tiles).fill(width);
  const minY = new Int32Array(tiles).fill(height);
  const maxX = new Int32Array(tiles).fill(-1);
  const maxY = new Int32Array(tiles).fill(-1);

  // 1 + 2: denoise and count per tile, remembering each tile's pixel bounds for tight boxes later.
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const tRow = ((y / T) | 0) * tw;
    for (let x = 0; x < width; x++) {
      if (!mask[row + x] || !hasDiffNeighbour(mask, x, y, width, height)) continue;
      const t = tRow + ((x / T) | 0);
      count[t]++;
      if (x < minX[t]) minX[t] = x;
      if (x > maxX[t]) maxX[t] = x;
      if (y < minY[t]) minY[t] = y;
      if (y > maxY[t]) maxY[t] = y;
    }
  }

  // 3 + 4: connected components over active tiles, bridging gaps of up to `mergeGap` tiles.
  const minTile = Math.max(1, opts.minTilePixels);
  const reach = Math.max(0, Math.round(opts.mergeGap)) + 1;
  const visited = new Uint8Array(tiles);
  const stack = new Int32Array(tiles);
  let boxes: Box[] = [];

  for (let start = 0; start < tiles; start++) {
    if (visited[start] || count[start] < minTile) continue;
    let sp = 0;
    stack[sp++] = start;
    visited[start] = 1;
    let bx0 = width, by0 = height, bx1 = -1, by1 = -1, pixels = 0;

    while (sp > 0) {
      const t = stack[--sp];
      pixels += count[t];
      if (minX[t] < bx0) bx0 = minX[t];
      if (minY[t] < by0) by0 = minY[t];
      if (maxX[t] > bx1) bx1 = maxX[t];
      if (maxY[t] > by1) by1 = maxY[t];
      if (count[t] < minTile) continue; // edge tiles are absorbed but don't spread the group

      const tx = t % tw;
      const ty = (t / tw) | 0;
      for (let dy = -reach; dy <= reach; dy++) {
        const ny = ty + dy;
        if (ny < 0 || ny >= th) continue;
        for (let dx = -reach; dx <= reach; dx++) {
          const nx = tx + dx;
          if (nx < 0 || nx >= tw) continue;
          const n = ny * tw + nx;
          if (visited[n] || count[n] === 0) continue;
          const near = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
          // Active tiles join across the gap; weak neighbouring tiles join only when adjacent, so a
          // change's faint edges stay inside its box without chaining unrelated noise together.
          if (count[n] >= minTile || near) {
            visited[n] = 1;
            stack[sp++] = n;
          }
        }
      }
    }

    // 5: minimum size filters on the tight box.
    const w = bx1 - bx0 + 1;
    const h = by1 - by0 + 1;
    if (pixels < opts.minRegionPixels || w * h < opts.minRegionArea) continue;
    boxes.push({ x: bx0, y: by0, width: w, height: h, diffPixels: pixels });
  }

  if (boxes.length > MAX_BOXES_BEFORE_MERGE) {
    boxes.sort((a, b) => b.diffPixels - a.diffPixels);
    boxes = boxes.slice(0, MAX_BOXES_BEFORE_MERGE);
  }

  // Pad, clamp to the image, then merge boxes that now overlap.
  const pad = Math.max(0, Math.round(opts.padding));
  const padded = boxes.map((b) => {
    const x = Math.max(0, b.x - pad);
    const y = Math.max(0, b.y - pad);
    return {
      x,
      y,
      width: Math.min(width, b.x + b.width + pad) - x,
      height: Math.min(height, b.y + b.height + pad) - y,
      diffPixels: b.diffPixels,
    };
  });
  let merged = mergeOverlapping(padded);

  // 6: cap, then reading order.
  let droppedForLimit = 0;
  if (merged.length > opts.maxRegions) {
    droppedForLimit = merged.length - opts.maxRegions;
    merged = merged.sort((a, b) => b.diffPixels - a.diffPixels).slice(0, opts.maxRegions);
  }
  merged.sort((a, b) => a.y - b.y || a.x - b.x);

  const regions: Region[] = merged.map((b, i) => ({
    id: `R${i + 1}`,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    diffPixels: b.diffPixels,
    density: b.diffPixels / Math.max(1, b.width * b.height),
  }));

  return { regions, droppedForLimit };
}
