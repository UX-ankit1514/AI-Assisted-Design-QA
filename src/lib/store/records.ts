import type { PipelineOutput } from "@/lib/engine/pipeline";
import type { Sensitivity } from "@/lib/engine/types";
import { newId, nowIso } from "@/lib/ids";
import { cleanProjectName } from "@/lib/issues/sanitize";
import type { NewComparison } from "./qa-store";
import type { Comparison, Issue } from "./types";

interface FileLike {
  name: string;
  type: string;
  size: number;
}

export interface ComparisonInput {
  projectName: string;
  design: Blob & FileLike;
  build: Blob & FileLike;
  sensitivity: Sensitivity;
  isSample: boolean;
  output: Omit<PipelineOutput, "maskPng"> & { maskPng: Blob };
}

/** Turns an engine result into the stored comparison plus one Pending issue per detected region. */
export function buildComparisonRecords({ projectName, design, build, sensitivity, isSample, output }: ComparisonInput): NewComparison {
  const id = newId();
  const now = nowIso();
  const referenceImage = { id: newId(), name: design.name, type: design.type, size: design.size };
  const implementationImage = { id: newId(), name: build.name, type: build.type, size: build.size };
  const diffMaskImage = { id: newId(), name: "difference-mask.png", type: "image/png", size: output.maskPng.size };
  const misaligned = output.warnings.some((w) => w.code === "possible-misalignment");

  const comparison: Comparison = {
    id,
    projectName: cleanProjectName(projectName) || "Untitled comparison",
    referenceImage,
    implementationImage,
    diffMaskImage,
    width: output.width,
    height: output.height,
    differencePercentage: output.differencePercentage,
    diffPixelCount: output.diffPixelCount,
    candidateCount: output.regions.length,
    sensitivity,
    warnings: output.warnings,
    regionsRevealed: !misaligned,
    isSample,
    createdAt: now,
    updatedAt: now,
  };

  const issues: Issue[] = output.regions.map((r) => ({
    id: newId(),
    comparisonId: id,
    label: r.id,
    bugNumber: null,
    source: "detected",
    region: { x: r.x, y: r.y, width: r.width, height: r.height },
    title: r.title,
    description: r.description,
    severity: "Untriaged",
    reviewState: "Pending",
    status: "Open",
    hint: r.hint,
    density: r.density,
    createdAt: now,
    updatedAt: now,
    confirmedAt: null,
  }));

  return {
    comparison,
    issues,
    images: [
      { id: referenceImage.id, blob: design },
      { id: implementationImage.id, blob: build },
      { id: diffMaskImage.id, blob: output.maskPng },
    ],
  };
}

/** Issues hidden while a likely misalignment is unresolved (PRD §9.4). */
export function visibleIssues(issues: readonly Issue[], comparisons: readonly Comparison[]): Issue[] {
  const hidden = new Set(comparisons.filter((c) => !c.regionsRevealed).map((c) => c.id));
  return hidden.size ? issues.filter((i) => i.source === "manual" || !hidden.has(i.comparisonId)) : (issues as Issue[]);
}
