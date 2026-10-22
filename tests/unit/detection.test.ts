import { readFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { compareScreenshots } from "@/lib/engine/compare";
import type { RasterImage, Rect } from "@/lib/engine/types";
import { overlaps, shift } from "./helpers/raster";

/*
 * Validation target from PRD §3.3: detect at least 80% of intentionally introduced, visually significant
 * differences in a controlled set, and produce no meaningful regions for an identical pair.
 */

const samples = path.resolve(import.meta.dirname, "../../public/samples");

function load(name: string): RasterImage {
  const png = PNG.sync.read(readFileSync(path.join(samples, name)));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length) };
}

const manifest = JSON.parse(readFileSync(path.join(samples, "manifest.json"), "utf8")) as {
  width: number;
  height: number;
  changes: { id: string; label: string; rect: Rect }[];
};

describe("sample pair detection rate", () => {
  const design = load("arnifi-home-design.png");
  const build = load("arnifi-home-build.png");

  it("matches the manifest dimensions", () => {
    expect([design.width, design.height]).toEqual([manifest.width, manifest.height]);
    expect([build.width, build.height]).toEqual([manifest.width, manifest.height]);
  });

  for (const sensitivity of ["balanced", "strict", "relaxed"] as const) {
    it(`finds at least 80% of the intentional changes (${sensitivity})`, async () => {
      const { resolveOptions } = await import("@/lib/engine/presets");
      const result = compareScreenshots(design, build, resolveOptions(sensitivity));
      const found = manifest.changes.filter((c) => result.regions.some((r) => overlaps(r, c.rect)));
      const missed = manifest.changes.filter((c) => !found.includes(c)).map((c) => c.id);
      expect(found.length / manifest.changes.length, `missed: ${missed.join(", ")}`).toBeGreaterThanOrEqual(0.8);
      // Every region should point at a real change — no unrelated noise.
      const stray = result.regions.filter((r) => !manifest.changes.some((c) => overlaps(r, c.rect)));
      expect(stray).toEqual([]);
      expect(result.warnings.find((w) => w.code === "possible-misalignment")).toBeUndefined();
    });
  }

  it("reports every one of the six changes at the default sensitivity", () => {
    const result = compareScreenshots(design, build);
    for (const change of manifest.changes) expect(result.regions.some((r) => overlaps(r, change.rect)), change.id).toBe(true);
  });

  it("produces no regions for an identical pair", () => {
    const result = compareScreenshots(design, load("arnifi-home-design.png"));
    expect(result.regions).toEqual([]);
    expect(result.differencePercentage).toBe(0);
  });

  it("warns when the whole build screenshot is shifted", () => {
    const result = compareScreenshots(design, shift(design, 0, 12));
    const warning = result.warnings.find((w) => w.code === "possible-misalignment");
    expect(warning, `regions: ${result.regions.length}, diff: ${result.differencePercentage.toFixed(2)}%`).toBeDefined();
    expect(warning?.offset).toEqual({ dx: 0, dy: 12 });
  });
});
