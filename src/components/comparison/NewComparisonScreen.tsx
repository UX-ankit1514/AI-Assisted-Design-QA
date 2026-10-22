"use client";

import { Images, ScanSearch, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Container } from "@/components/layout/Container";
import { UploadCard } from "@/components/upload/UploadCard";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { inspectImage, nameClipboardFile, type UploadedImage } from "@/lib/engine/inspect";
import { PIPELINE_ERROR_COPY, PipelineError, type PipelineStage } from "@/lib/engine/pipeline";
import { DEFAULT_SENSITIVITY, SENSITIVITY_LABELS } from "@/lib/engine/presets";
import { runComparison } from "@/lib/engine/runComparison";
import type { Sensitivity } from "@/lib/engine/types";
import { checkMatchingDimensions, type FileProblem } from "@/lib/engine/validate";
import { TEXT_LIMITS } from "@/lib/issues/sanitize";
import { cn } from "@/lib/cn";
import { qaStore } from "@/lib/store/qa-store";
import { buildComparisonRecords } from "@/lib/store/records";
import { CaptureTips } from "./CaptureTips";
import { ProgressSteps } from "./ProgressSteps";
import { RecentComparisons } from "./RecentComparisons";

type Slot = "design" | "build";

interface SlotState {
  image: UploadedImage | null;
  problem: FileProblem | null;
  busy: boolean;
}

type RunState = { kind: "idle" } | { kind: "running"; stage: PipelineStage; progress: number } | { kind: "error"; message: string };

const EMPTY_SLOT: SlotState = { image: null, problem: null, busy: false };

/* Clearly labelled sample data (PRD §17 Phase 5) — it still runs through the real comparison engine. */
const SAMPLES: Record<Slot, { url: string; name: string }> = {
  design: { url: "/samples/arnifi-home-design.png", name: "sample-arnifi-home-figma.png" },
  build: { url: "/samples/arnifi-home-build.png", name: "sample-arnifi-home-website.png" },
};
const SAMPLE_PROJECT = "Arnifi Homepage QA (sample)";

const SLOT_COPY: Record<Slot, { title: string; hint: string }> = {
  design: { title: "Original design (Figma export)", hint: "PNG, JPG or WebP · up to 50 MB · long pages up to 64 megapixels" },
  build: { title: "Developed website screenshot", hint: "Full-page screenshot, same width and height as the design" },
};

/* Screen 1 — New Comparison (PRD §7). */
export function NewComparisonScreen() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [slots, setSlots] = useState<Record<Slot, SlotState>>({ design: EMPTY_SLOT, build: EMPTY_SLOT });
  const [sensitivity, setSensitivity] = useState<Sensitivity>(DEFAULT_SENSITIVITY);
  const [isSample, setIsSample] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const design = slots.design.image;
  const build = slots.build.image;
  const running = run.kind === "running";
  const checking = slots.design.busy || slots.build.busy || sampleLoading;
  const mismatch = design && build ? checkMatchingDimensions(design, build) : null;
  const nameMissing = projectName.trim() === "";

  const missing = [nameMissing && "a project name", !design && "the design screenshot", !build && "the website screenshot"].filter(Boolean) as string[];
  const canRun = missing.length === 0 && !mismatch && !running && !checking;

  function patchSlot(slot: Slot, patch: Partial<SlotState>) {
    setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
  }

  function replaceImage(slot: Slot, image: UploadedImage | null) {
    const old = slots[slot].image;
    if (old) {
      URL.revokeObjectURL(old.url);
      previewUrls.current.delete(old.url);
    }
    if (image) previewUrls.current.add(image.url);
  }

  async function handleFile(slot: Slot, raw: File) {
    const file = nameClipboardFile(raw, slot);
    patchSlot(slot, { busy: true, problem: null });
    if (run.kind === "error") setRun({ kind: "idle" });
    const result = await inspectImage(file);
    if (result.ok) {
      replaceImage(slot, result.image);
      patchSlot(slot, { image: result.image, problem: null, busy: false });
      setIsSample(false);
    } else {
      // A rejected replacement keeps the previous valid image in place.
      patchSlot(slot, { problem: result.problem, busy: false });
    }
  }

  function removeImage(slot: Slot) {
    replaceImage(slot, null);
    patchSlot(slot, { image: null, problem: null });
    if (run.kind === "error") setRun({ kind: "idle" });
  }

  async function loadSamples() {
    setSampleLoading(true);
    setRun({ kind: "idle" });
    try {
      const files = await Promise.all(
        (["design", "build"] as const).map(async (slot) => {
          const response = await fetch(SAMPLES[slot].url);
          if (!response.ok) throw new Error("sample missing");
          const blob = await response.blob();
          return new File([blob], SAMPLES[slot].name, { type: blob.type || "image/png" });
        }),
      );
      const [d, b] = await Promise.all(files.map((file) => inspectImage(file)));
      if (!d.ok || !b.ok) throw new Error("sample unreadable");
      replaceImage("design", d.image);
      replaceImage("build", b.image);
      setSlots({ design: { image: d.image, problem: null, busy: false }, build: { image: b.image, problem: null, busy: false } });
      setProjectName((name) => (name.trim() ? name : SAMPLE_PROJECT));
      setIsSample(true);
    } catch {
      setRun({ kind: "error", message: "The sample screenshots couldn't be loaded. Reload the page and try again." });
    } finally {
      setSampleLoading(false);
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setNameTouched(true);
    if (!canRun || !design || !build) return;
    setRun({ kind: "running", stage: "decode", progress: 0 });
    try {
      const output = await runComparison(
        design.file,
        build.file,
        sensitivity,
        (stage) => setRun((r) => ({ kind: "running", stage, progress: r.kind === "running" ? r.progress : 0 })),
        (progress) => setRun((r) => (r.kind === "running" ? { ...r, progress } : r)),
      );
      const records = buildComparisonRecords({ projectName, design: design.file, build: build.file, sensitivity, isSample, output });
      await qaStore.createComparison(records);
      router.push(`/comparisons/${records.comparison.id}`);
    } catch (error) {
      setRun({ kind: "error", message: error instanceof PipelineError ? error.message : PIPELINE_ERROR_COPY.unknown });
    }
  }

  const oneUploaded = Boolean(design) !== Boolean(build);

  return (
    <div className="pb-20">
      <section className="border-b border-line bg-white">
        <Container className="py-10 md:py-12">
          <p className="text-sph5 font-semibold text-arnique-700 uppercase">Design QA</p>
          <h1 className="mt-2 max-w-[44rem] font-serif text-l3 font-medium text-heading">Compare Your Design With the Developed Website</h1>
          <p className="mt-3 max-w-[40rem] text-p1 text-muted">Upload two screenshots to identify visual differences and track design issues.</p>
          <ol className="mt-6 flex flex-col gap-2 text-p3 text-muted sm:flex-row sm:gap-6" aria-label="How it works">
            {["Upload both screenshots", "Review the highlighted differences", "Track confirmed bugs to Verified"].map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-arnique-100 text-[11px] font-semibold text-arnique-900">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <Container className="mt-8 flex flex-col gap-8">
        <form onSubmit={submit} noValidate className="rounded-panel border border-line bg-white p-5 shadow-raised md:p-8" aria-label="New comparison">
          <fieldset disabled={running} className="flex flex-col gap-8">
            <legend className="sr-only">Comparison details</legend>
            <TextField
              label="Project name"
              required
              value={projectName}
              maxLength={TEXT_LIMITS.projectName}
              placeholder="Arnifi Homepage QA"
              autoComplete="off"
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              error={nameTouched && nameMissing ? "Enter a project name" : undefined}
              className="max-w-[27.5rem]"
            />

            <div className="grid gap-6 md:grid-cols-2">
              {(["design", "build"] as const).map((slot, i) => (
                <UploadCard
                  key={slot}
                  slot={slot}
                  step={i + 1}
                  title={SLOT_COPY[slot].title}
                  hint={SLOT_COPY[slot].hint}
                  image={slots[slot].image}
                  problem={slots[slot].problem}
                  busy={slots[slot].busy}
                  disabled={running || sampleLoading}
                  isSample={isSample}
                  mismatch={Boolean(mismatch)}
                  onFile={(file) => handleFile(slot, file)}
                  onRemove={() => removeImage(slot)}
                />
              ))}
            </div>

            {mismatch && (
              <Notice tone="error" title="The screenshots need the same dimensions" role="alert">
                <span data-testid="mismatch">{mismatch.message}</span> {mismatch.action} We never resize or stretch screenshots, because that would create
                misleading differences.
              </Notice>
            )}
            {oneUploaded && !mismatch && (
              <p className="-mt-4 text-p3 text-muted" role="status">
                {design ? "Now add the developed website screenshot to compare against." : "Now add the original design screenshot to compare against."}
              </p>
            )}

            <div className="flex flex-col gap-0">
              <CaptureTips />
              <Disclosure title="Comparison settings" icon={SlidersHorizontal}>
                <fieldset>
                  <legend className="text-p3 font-medium text-ink">Sensitivity</legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {(Object.keys(SENSITIVITY_LABELS) as Sensitivity[]).map((key) => (
                      <label
                        key={key}
                        className={cn(
                          "flex cursor-pointer gap-3 rounded-card border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
                          sensitivity === key ? "border-brand bg-arnique-100" : "border-line hover:border-line-hover",
                        )}
                      >
                        <input type="radio" name="sensitivity" value={key} checked={sensitivity === key} onChange={() => setSensitivity(key)} className="mt-1 accent-[var(--color-brand)]" />
                        <span>
                          <span className="block text-p3 font-semibold text-ink">{SENSITIVITY_LABELS[key].label}</span>
                          <span className="mt-0.5 block text-p4 text-muted">{SENSITIVITY_LABELS[key].help}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </Disclosure>
            </div>
          </fieldset>

          <div className="mt-6 flex flex-col gap-4 border-t border-line pt-6">
            {run.kind === "running" && <ProgressSteps stage={run.stage} progress={run.progress} />}
            {run.kind === "error" && (
              <Notice
                tone="error"
                title="The comparison didn't finish"
                role="alert"
                action={
                  <Button size="m" variant="tertiary" onClick={() => submit()} disabled={!canRun}>
                    Try Again
                  </Button>
                }
              >
                {run.message}
              </Notice>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" size="xl" arrow icon={ScanSearch} loading={running} disabled={!canRun} className="sm:min-w-64">
                {running ? "Comparing…" : "Run Comparison"}
              </Button>
              <Button variant="tertiary" size="xl" icon={Images} onClick={loadSamples} loading={sampleLoading} disabled={running}>
                Try With Sample Screenshots
              </Button>
            </div>
            <p className="text-p4 text-muted" aria-live="polite">
              {running
                ? "Everything runs in this browser — your screenshots aren't uploaded anywhere."
                : missing.length
                  ? `Add ${listJoin(missing)} to run the comparison.`
                  : mismatch
                    ? "Replace one of the screenshots so both have the same dimensions."
                    : "Ready. The comparison runs in this browser — nothing is uploaded."}
            </p>
          </div>
        </form>

        <RecentComparisons />
      </Container>
    </div>
  );
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
