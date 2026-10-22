import type { CompareOptions, Sensitivity } from "./types";

// Long landing pages can carry 50+ genuine differences, so the cap is generous.
const shared = { includeAA: false, mergeGap: 1, padding: 6, maxRegions: 120 } as const;

/* Sensitivity presets (PRD §18: "configurable sensitivity and region filtering"). */
export const SENSITIVITY_PRESETS: Record<Sensitivity, CompareOptions> = {
  relaxed: { ...shared, threshold: 0.15, tileSize: 20, minTilePixels: 8, minRegionPixels: 40, minRegionArea: 256 },
  balanced: { ...shared, threshold: 0.1, tileSize: 16, minTilePixels: 6, minRegionPixels: 24, minRegionArea: 144 },
  strict: { ...shared, threshold: 0.05, tileSize: 12, minTilePixels: 2, minRegionPixels: 6, minRegionArea: 36 },
};

export const SENSITIVITY_LABELS: Record<Sensitivity, { label: string; help: string }> = {
  relaxed: { label: "Relaxed", help: "Ignores tiny changes and subtle colour shifts. Best for JPG screenshots or busy pages." },
  balanced: { label: "Balanced", help: "Recommended for most Figma exports and browser screenshots." },
  strict: { label: "Strict", help: "Flags even tiny changes. Expect more regions to review." },
};

export const DEFAULT_SENSITIVITY: Sensitivity = "balanced";

export function resolveOptions(sensitivity: Sensitivity = DEFAULT_SENSITIVITY, overrides: Partial<CompareOptions> = {}): CompareOptions {
  return { ...SENSITIVITY_PRESETS[sensitivity], ...overrides };
}
