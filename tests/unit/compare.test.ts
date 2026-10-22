import { describe, expect, it } from "vitest";
import { compareScreenshots, DimensionMismatchError } from "@/lib/engine/compare";
import { describeRegion, describeLocation } from "@/lib/engine/describe";
import { flattenOnWhite } from "@/lib/engine/normalize";
import { resolveOptions } from "@/lib/engine/presets";
import { groupRegions } from "@/lib/engine/regions";
import { BRAND_OFF, blank, clone, fillRect, overlaps, page, seeded, shift } from "./helpers/raster";

/* Controlled comparison fixtures from PRD §15. */

describe("compareScreenshots", () => {
  it("returns zero meaningful differences for identical screenshots (AC-03)", () => {
    const a = page();
    const result = compareScreenshots(a, clone(a));
    expect(result.diffPixelCount).toBe(0);
    expect(result.differencePercentage).toBe(0);
    expect(result.regions).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("calculates the difference percentage from differing pixels", () => {
    const a = blank(100, 100);
    const b = clone(a);
    fillRect(b, 10, 10, 10, 10, [0, 0, 0]);
    const result = compareScreenshots(a, b, { includeAA: true });
    expect(result.totalPixels).toBe(10_000);
    expect(result.diffPixelCount).toBe(100);
    expect(result.differencePercentage).toBeCloseTo(1, 6);
    expect(result.diffMask).toMatchObject({ width: 100, height: 100, scale: 1 });
    expect(result.diffMask.data.length).toBe(100 * 100 * 4);
  });

  it("highlights a changed heading-sized area (AC-04)", () => {
    const design = page();
    const build = page({ headingGlyph: 26 });
    const result = compareScreenshots(design, build);
    const heading = { x: 40, y: 96, width: 22 * 22, height: 32 };
    expect(result.regions.length).toBeGreaterThanOrEqual(1);
    expect(result.regions.length).toBeLessThanOrEqual(2);
    expect(result.regions.some((r) => overlaps(r, heading))).toBe(true);
    expect(result.warnings.find((w) => w.code === "possible-misalignment")).toBeUndefined();
  });

  it("finds a changed button colour as one colour region", () => {
    const design = page();
    const build = page({ buttonColour: BRAND_OFF });
    const result = compareScreenshots(design, build);
    expect(result.regions).toHaveLength(1);
    const [region] = result.regions;
    expect(overlaps(region, { x: 40, y: 208, width: 180, height: 44 })).toBe(true);
    expect(describeRegion(flattenOnWhite(design), flattenOnWhite(build), region).hint).toBe("colour");
  });

  it("flags a shifted section without calling the whole page misaligned", () => {
    const result = compareScreenshots(page(), page({ cardsOffsetY: 24 }));
    const cards = { x: 40, y: 300, width: 720, height: 184 };
    expect(result.regions.length).toBeGreaterThanOrEqual(1);
    expect(result.regions.every((r) => overlaps(r, cards))).toBe(true);
    expect(result.warnings.find((w) => w.code === "possible-misalignment")).toBeUndefined();
  });

  it("finds multiple separate differences as separate regions", () => {
    const design = page();
    const build = page({ buttonColour: BRAND_OFF, showIcon: false, footerLink: [9, 88, 217] });
    const result = compareScreenshots(design, build);
    const changes = [
      { x: 40, y: 208, width: 180, height: 44 },
      { x: 310, y: 320, width: 36, height: 36 },
      { x: 40, y: 590, width: 100, height: 12 },
    ];
    expect(result.regions).toHaveLength(3);
    for (const change of changes) expect(result.regions.some((r) => overlaps(r, change))).toBe(true);
  });

  it("refuses screenshots with different dimensions instead of stretching them (AC-02)", () => {
    expect(() => compareScreenshots(blank(800, 600), blank(800, 640))).toThrow(DimensionMismatchError);
  });

  it("warns about a global misalignment instead of only listing regions", () => {
    const design = page();
    const build = shift(design, 0, 12);
    const result = compareScreenshots(design, build);
    const warning = result.warnings.find((w) => w.code === "possible-misalignment");
    expect(warning).toBeDefined();
    expect(warning?.offset?.dx).toBe(0);
    expect(Math.abs((warning?.offset?.dy ?? 0) - 12)).toBeLessThanOrEqual(2);
    expect(warning?.message).toMatch(/up/);
  });

  it("ignores scattered single-pixel noise", () => {
    const design = page();
    const build = clone(design);
    const rand = seeded(7);
    for (let i = 0; i < 400; i++) {
      const x = 2 + Math.floor(rand() * 796);
      const y = 2 + Math.floor(rand() * 636);
      fillRect(build, x, y, 1, 1, [120, 120, 120]);
    }
    const result = compareScreenshots(design, build);
    expect(result.diffPixelCount).toBeGreaterThan(0);
    expect(result.regions).toEqual([]);
  });

  it("treats transparency consistently by flattening onto white", () => {
    const transparent = blank(64, 64, [0, 0, 0], 0);
    fillRect(transparent, 8, 8, 20, 20, [46, 46, 163]);
    const opaque = blank(64, 64);
    fillRect(opaque, 8, 8, 20, 20, [46, 46, 163]);
    expect(compareScreenshots(transparent, opaque).diffPixelCount).toBe(0);
  });

  it("caps the region count and says how many were left out", () => {
    const a = blank(1200, 1300);
    const b = clone(a);
    for (let i = 0; i < 132; i++) fillRect(b, 20 + (i % 11) * 105, 20 + Math.floor(i / 11) * 105, 30, 30, [0, 0, 0]);
    const result = compareScreenshots(a, b);
    expect(result.regions).toHaveLength(120);
    expect(result.warnings.find((w) => w.code === "region-limit")?.message).toMatch(/12 smaller regions were left out/);
  });
});

describe("long pages (banded comparison)", () => {
  it("gives the same answer whatever the band size", () => {
    const design = page();
    const build = page({ buttonColour: BRAND_OFF, showIcon: false, footerLink: [9, 88, 217], headingGlyph: 26 });
    const whole = compareScreenshots(design, build, {}, { bandRows: 100_000 });
    for (const bandRows of [8, 37, 101]) {
      const banded = compareScreenshots(design, build, {}, { bandRows });
      expect(banded.diffPixelCount, `bandRows ${bandRows}`).toBe(whole.diffPixelCount);
      expect(banded.regions).toEqual(whole.regions);
      expect(banded.diffMask.data).toEqual(whole.diffMask.data);
    }
  });

  it("handles a 30,000 px tall page, including a change across a band seam", () => {
    const width = 600;
    const height = 30_000;
    const design = blank(width, height);
    for (let y = 40; y < height; y += 400) fillRect(design, 40, y, 300, 24, [33, 39, 42]);
    const build = clone(design);
    fillRect(build, 400, 60, 120, 40, [46, 46, 163]); // near the top
    fillRect(build, 400, 14_980, 120, 50, [46, 46, 163]); // straddles the 15,000 px band boundary
    fillRect(build, 400, 29_900, 120, 40, [46, 46, 163]); // at the very bottom
    const progress: number[] = [];
    const result = compareScreenshots(design, build, {}, { bandRows: 1000, onProgress: (f) => progress.push(f) });

    expect(result.regions).toHaveLength(3);
    expect(result.regions[1]).toMatchObject({ y: 14_980 - 6, height: 50 + 12 });
    expect(result.regions[2].y).toBeGreaterThan(29_800);
    expect(progress.at(-1)).toBe(1);
    expect(progress).toHaveLength(30);
    // The stored mask is downscaled to stay within browser canvas limits.
    expect(result.diffMask).toMatchObject({ width: 300, height: 15_000, scale: 2 });
  });
});

describe("groupRegions", () => {
  const opts = resolveOptions("balanced");

  function maskWith(width: number, height: number, rects: [number, number, number, number][]) {
    const mask = new Uint8Array(width * height);
    for (const [x, y, w, h] of rects) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) mask[yy * width + xx] = 1;
    return mask;
  }

  it("merges nearby blobs and keeps distant ones apart", () => {
    const near = groupRegions(maskWith(400, 200, [[20, 20, 30, 20], [60, 20, 30, 20]]), 400, 200, opts);
    expect(near.regions).toHaveLength(1);
    const far = groupRegions(maskWith(400, 200, [[20, 20, 30, 20], [300, 120, 30, 20]]), 400, 200, opts);
    expect(far.regions).toHaveLength(2);
    expect(far.regions.map((r) => r.id)).toEqual(["R1", "R2"]);
  });

  it("drops regions below the minimum size", () => {
    const { regions } = groupRegions(maskWith(200, 200, [[50, 50, 3, 3]]), 200, 200, opts);
    expect(regions).toEqual([]);
  });

  it("returns tight, padded boxes clamped to the image", () => {
    const { regions } = groupRegions(maskWith(200, 200, [[0, 0, 40, 20]]), 200, 200, opts);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ x: 0, y: 0, width: 40 + opts.padding, height: 20 + opts.padding, diffPixels: 800 });
  });

  it("orders regions top to bottom, then left to right", () => {
    const { regions } = groupRegions(maskWith(600, 600, [[400, 400, 40, 40], [40, 400, 40, 40], [200, 40, 40, 40]]), 600, 600, opts);
    expect(regions.map((r) => [r.x + opts.padding, r.y + opts.padding])).toEqual([
      [200, 40],
      [40, 400],
      [400, 400],
    ]);
  });
});

describe("region wording", () => {
  it("never states CSS or px values", () => {
    const design = page();
    const builds = [page({ headingGlyph: 26 }), page({ buttonColour: BRAND_OFF }), page({ showIcon: false }), page({ cardsOffsetY: 24 })];
    for (const build of builds) {
      const result = compareScreenshots(design, build);
      for (const region of result.regions) {
        const { title, description } = describeRegion(flattenOnWhite(design), flattenOnWhite(build), region);
        expect(title).toMatch(/^Possible /);
        expect(`${title} ${description}`).not.toMatch(/\d+\s*(px|pt|rem|em)\b/i);
        expect(`${title} ${description}`).not.toMatch(/font-size|line-height:|#[0-9a-f]{3,6}\b/i);
      }
    }
  });

  it("describes a missing element", () => {
    const design = page();
    const build = page({ showIcon: false });
    const [region] = compareScreenshots(design, build).regions;
    expect(describeRegion(flattenOnWhite(design), flattenOnWhite(build), region).hint).toBe("missing-or-extra");
  });

  it("names the location in plain words", () => {
    expect(describeLocation({ x: 0, y: 0, width: 50, height: 20 }, 1000, 1000)).toBe("near the top left");
    expect(describeLocation({ x: 450, y: 480, width: 100, height: 40 }, 1000, 1000)).toBe("near the centre");
    expect(describeLocation({ x: 0, y: 900, width: 900, height: 60 }, 1000, 1000)).toBe("across the bottom");
  });
});
