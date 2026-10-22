import { compareScreenshots, type CompareStage } from "./compare";
import { encodePng, openBitmapSource, type OpenedSource } from "./decode";
import { describeRegion } from "./describe";
import { resolveOptions } from "./presets";
import type { EngineWarning, Region, RegionDescription, Sensitivity } from "./types";
import { checkMatchingDimensions } from "./validate";

/*
 * The whole Run Comparison job (PRD Step 3), shared by the worker and the main-thread fallback:
 * decode → verify dimensions → normalise → compare → group → describe → encode the mask.
 */

export type PipelineStage = "decode" | CompareStage | "prepare";

export type DescribedRegion = Region & RegionDescription;

export interface PipelineOutput {
  width: number;
  height: number;
  diffPixelCount: number;
  differencePercentage: number;
  regions: DescribedRegion[];
  warnings: EngineWarning[];
  maskPng: Blob;
}

export type PipelineErrorCode = "decode-design" | "decode-build" | "dimension-mismatch" | "out-of-memory" | "unknown";

export class PipelineError extends Error {
  constructor(
    readonly code: PipelineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

export const PIPELINE_ERROR_COPY: Record<PipelineErrorCode, string> = {
  "decode-design": "We couldn't read the design screenshot. Export the frame from Figma again as PNG and replace it.",
  "decode-build": "We couldn't read the website screenshot. Capture it again and replace it.",
  "dimension-mismatch": "The screenshots have different dimensions, so they can't be compared pixel by pixel.",
  "out-of-memory": "The browser ran out of memory comparing these screenshots. Close other tabs and try again, or export at 1x instead of 2x.",
  unknown: "Something went wrong while comparing. Try again — if it keeps happening, reload the page.",
};

/** Lets the browser paint progress between heavy synchronous steps when running on the main thread. */
const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function processComparison(
  design: Blob,
  build: Blob,
  sensitivity: Sensitivity,
  onStage: (stage: PipelineStage) => void = () => {},
  onProgress: (fraction: number) => void = () => {},
): Promise<PipelineOutput> {
  onStage("decode");
  await nextTick();
  let reference: OpenedSource | null = null;
  let implementation: OpenedSource | null = null;
  try {
    reference = await openBitmapSource(design).catch(() => {
      throw new PipelineError("decode-design", PIPELINE_ERROR_COPY["decode-design"]);
    });
    implementation = await openBitmapSource(build).catch(() => {
      throw new PipelineError("decode-build", PIPELINE_ERROR_COPY["decode-build"]);
    });
    const a = reference.source;
    const b = implementation.source;

    const mismatch = checkMatchingDimensions(a, b);
    if (mismatch) throw new PipelineError("dimension-mismatch", `${mismatch.message} ${mismatch.action}`);

    const result = compareScreenshots(a, b, resolveOptions(sensitivity), { onStage, onProgress });

    onStage("prepare");
    await nextTick();
    const regions = result.regions.map((region) => ({ ...region, ...describeRegion(a, b, region) }));
    const maskPng = await encodePng(result.diffMask.data, result.diffMask.width, result.diffMask.height);

    return {
      width: result.width,
      height: result.height,
      diffPixelCount: result.diffPixelCount,
      differencePercentage: result.differencePercentage,
      regions,
      warnings: result.warnings,
      maskPng,
    };
  } catch (error) {
    if (error instanceof PipelineError) throw error;
    if (error instanceof RangeError) throw new PipelineError("out-of-memory", PIPELINE_ERROR_COPY["out-of-memory"]);
    throw new PipelineError("unknown", PIPELINE_ERROR_COPY.unknown);
  } finally {
    reference?.close();
    implementation?.close();
  }
}
