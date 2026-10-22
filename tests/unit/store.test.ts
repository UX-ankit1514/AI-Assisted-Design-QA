import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IdbRepository, MemoryRepository, openRepository } from "@/lib/store/repository";
import { QaStore } from "@/lib/store/qa-store";
import { buildComparisonRecords, visibleIssues } from "@/lib/store/records";
import type { PipelineOutput } from "@/lib/engine/pipeline";

function fakeFile(name: string, bytes = 8) {
  return Object.assign(new Blob([new Uint8Array(bytes)], { type: "image/png" }), { name });
}

function output(overrides: Partial<PipelineOutput> = {}): PipelineOutput {
  return {
    width: 800,
    height: 640,
    diffPixelCount: 1200,
    differencePercentage: 0.23,
    maskPng: new Blob([new Uint8Array(4)], { type: "image/png" }),
    warnings: [],
    regions: [
      { id: "R1", x: 34, y: 90, width: 500, height: 50, diffPixels: 900, density: 0.36, hint: "typography", title: "Possible text or spacing difference near the top left", description: "Check the font size." },
      { id: "R2", x: 34, y: 202, width: 192, height: 56, diffPixels: 300, density: 0.03, hint: "colour", title: "Possible colour difference near the upper left", description: "Check fill colours." },
    ],
    ...overrides,
  };
}

function records(name = "Arnifi Homepage QA", out = output()) {
  return buildComparisonRecords({ projectName: name, design: fakeFile("design.png"), build: fakeFile("build.png"), sensitivity: "balanced", isSample: false, output: out });
}

describe("comparison records", () => {
  it("creates one Pending, Untriaged issue per detected region", () => {
    const { comparison, issues, images } = records();
    expect(comparison).toMatchObject({ projectName: "Arnifi Homepage QA", width: 800, height: 640, candidateCount: 2, regionsRevealed: true });
    expect(issues.map((i) => [i.label, i.reviewState, i.status, i.severity, i.bugNumber])).toEqual([
      ["R1", "Pending", "Open", "Untriaged", null],
      ["R2", "Pending", "Open", "Untriaged", null],
    ]);
    expect(images).toHaveLength(3);
  });

  it("creates no issues for identical screenshots (AC-03)", () => {
    const { comparison, issues } = records("Same", output({ regions: [], diffPixelCount: 0, differencePercentage: 0 }));
    expect(comparison.candidateCount).toBe(0);
    expect(issues).toEqual([]);
  });

  it("hides candidate regions while a misalignment is unresolved", () => {
    const { comparison, issues } = records("Shifted", output({ warnings: [{ code: "possible-misalignment", message: "", offset: { dx: 0, dy: 12 } }] }));
    expect(comparison.regionsRevealed).toBe(false);
    expect(visibleIssues(issues, [comparison])).toEqual([]);
    expect(visibleIssues(issues, [{ ...comparison, regionsRevealed: true }])).toHaveLength(2);
  });
});

describe("QaStore", () => {
  it("confirms, tracks and persists an issue end to end", async () => {
    const repo = new MemoryRepository();
    const store = new QaStore(async () => repo);
    const input = records();
    await store.createComparison(input);
    const [first, second] = input.issues;

    expect(store.confirm(first.id)).toBe(true);
    expect(store.confirm(first.id)).toBe(false); // double click
    expect(store.dismiss(second.id)).toBe(true);
    expect(store.setStatus(first.id, "Verified")).toBe(false); // not fixed yet
    expect(store.setStatus(first.id, "Fixed")).toBe(true);
    expect(store.setStatus(first.id, "Verified")).toBe(true);
    store.edit(first.id, { title: "  Hero heading looks smaller\u0000 ", severity: "High" });

    const state = store.getSnapshot();
    const saved = state.issues.find((i) => i.id === first.id)!;
    expect(saved).toMatchObject({ reviewState: "Confirmed", status: "Verified", bugNumber: 1, title: "Hero heading looks smaller", severity: "High" });
    expect(state.issues.find((i) => i.id === second.id)!.reviewState).toBe("Dismissed");

    // A fresh store over the same repository sees the same data — what a reload does.
    await new Promise((r) => setTimeout(r, 0));
    const reloaded = new QaStore(async () => repo);
    await reloaded.init();
    expect(reloaded.getSnapshot().issues.find((i) => i.id === first.id)).toMatchObject({ status: "Verified", severity: "High" });
    expect(reloaded.getSnapshot().comparisons).toHaveLength(1);
  });

  it("never reuses bug numbers, even after a comparison is deleted", async () => {
    const repo = new MemoryRepository();
    const store = new QaStore(async () => repo);
    const a = records("A");
    await store.createComparison(a);
    store.confirm(a.issues[0].id);
    store.confirm(a.issues[1].id);
    store.deleteComparison(a.comparison.id);
    const b = records("B");
    await store.createComparison(b);
    store.confirm(b.issues[0].id);
    expect(store.getSnapshot().issues.find((i) => i.id === b.issues[0].id)!.bugNumber).toBe(3);
    const manual = store.addManualIssue(b.comparison.id, { x: 1, y: 2, width: 30, height: 40 });
    expect(manual).toMatchObject({ label: "M1", bugNumber: 4, reviewState: "Confirmed", status: "Open", source: "manual" });
  });

  it("shows a warning when a save fails, but keeps the change on screen", async () => {
    const repo = new MemoryRepository();
    repo.putIssues = async () => {
      throw new Error("quota");
    };
    const store = new QaStore(async () => repo);
    const input = records();
    await store.createComparison(input);
    store.dismiss(input.issues[0].id);
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getSnapshot().saveError).toMatch(/couldn't save/);
    expect(store.getSnapshot().issues[0].reviewState).toBe("Dismissed");
  });
});

describe("IndexedDB repository", () => {
  it("round-trips comparisons, issues, images and the bug counter, and deletes in cascade", async () => {
    const repo = await IdbRepository.open(`test-${Math.random()}`);
    const { comparison, issues, images } = records();
    await repo.createComparison(comparison, images, issues);
    expect(await repo.listComparisons()).toHaveLength(1);
    expect(await repo.listIssues()).toHaveLength(2);
    expect(await repo.getImage(comparison.referenceImage.id)).toBeDefined();
    await repo.setCounter("bugCounter", 5);
    expect(await repo.getCounter("bugCounter")).toBe(5);

    await repo.deleteComparison(comparison);
    expect(await repo.listComparisons()).toEqual([]);
    expect(await repo.listIssues()).toEqual([]);
    expect(await repo.getImage(comparison.referenceImage.id)).toBeUndefined();
  });

  it("falls back to memory when IndexedDB is unavailable", async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error simulate a browser without IndexedDB
    delete globalThis.indexedDB;
    try {
      expect((await openRepository()).kind).toBe("memory");
    } finally {
      globalThis.indexedDB = original;
    }
  });
});
