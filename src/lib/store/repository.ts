import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Comparison, Issue } from "./types";

/*
 * Local persistence (PRD §12.3). Everything stays in this browser: IndexedDB when available, otherwise an
 * in-memory store for the current tab (the UI then says that nothing survives a refresh).
 */

export interface StoredBlob {
  id: string;
  blob: Blob;
}

export interface QaRepository {
  readonly kind: "indexeddb" | "memory";
  listComparisons(): Promise<Comparison[]>;
  listIssues(): Promise<Issue[]>;
  /** Saves a new comparison with its images and candidate issues in one transaction. */
  createComparison(comparison: Comparison, images: StoredBlob[], issues: Issue[]): Promise<void>;
  putComparison(comparison: Comparison): Promise<void>;
  /** Removes the comparison, its issues and its images. */
  deleteComparison(comparison: Comparison): Promise<void>;
  putIssues(issues: Issue[]): Promise<void>;
  getImage(id: string): Promise<Blob | undefined>;
  getCounter(name: string): Promise<number>;
  setCounter(name: string, value: number): Promise<void>;
}

interface QaSchema extends DBSchema {
  comparisons: { key: string; value: Comparison };
  issues: { key: string; value: Issue; indexes: { byComparison: string } };
  images: { key: string; value: StoredBlob };
  meta: { key: string; value: number };
}

export const DB_NAME = "designsync-qa";
const DB_VERSION = 1;

export class IdbRepository implements QaRepository {
  readonly kind = "indexeddb" as const;

  private constructor(private readonly db: IDBPDatabase<QaSchema>) {}

  static async open(name = DB_NAME): Promise<IdbRepository> {
    const db = await openDB<QaSchema>(name, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("comparisons", { keyPath: "id" });
        const issues = db.createObjectStore("issues", { keyPath: "id" });
        issues.createIndex("byComparison", "comparisonId");
        db.createObjectStore("images", { keyPath: "id" });
        db.createObjectStore("meta");
      },
    });
    return new IdbRepository(db);
  }

  async listComparisons() {
    const all = await this.db.getAll("comparisons");
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listIssues() {
    return this.db.getAll("issues");
  }

  async createComparison(comparison: Comparison, images: StoredBlob[], issues: Issue[]) {
    const tx = this.db.transaction(["comparisons", "images", "issues"], "readwrite");
    await Promise.all([
      tx.objectStore("comparisons").put(comparison),
      ...images.map((image) => tx.objectStore("images").put(image)),
      ...issues.map((issue) => tx.objectStore("issues").put(issue)),
      tx.done,
    ]);
  }

  async putComparison(comparison: Comparison) {
    await this.db.put("comparisons", comparison);
  }

  async deleteComparison(comparison: Comparison) {
    const tx = this.db.transaction(["comparisons", "images", "issues"], "readwrite");
    const issueKeys = await tx.objectStore("issues").index("byComparison").getAllKeys(comparison.id);
    const imageIds = [comparison.referenceImage.id, comparison.implementationImage.id, comparison.diffMaskImage.id];
    await Promise.all([
      tx.objectStore("comparisons").delete(comparison.id),
      ...issueKeys.map((key) => tx.objectStore("issues").delete(key)),
      ...imageIds.map((id) => tx.objectStore("images").delete(id)),
      tx.done,
    ]);
  }

  async putIssues(issues: Issue[]) {
    const tx = this.db.transaction("issues", "readwrite");
    await Promise.all([...issues.map((issue) => tx.store.put(issue)), tx.done]);
  }

  async getImage(id: string) {
    return (await this.db.get("images", id))?.blob;
  }

  async getCounter(name: string) {
    return (await this.db.get("meta", name)) ?? 0;
  }

  async setCounter(name: string, value: number) {
    await this.db.put("meta", value, name);
  }
}

export class MemoryRepository implements QaRepository {
  readonly kind = "memory" as const;
  private comparisons = new Map<string, Comparison>();
  private issues = new Map<string, Issue>();
  private images = new Map<string, Blob>();
  private counters = new Map<string, number>();

  async listComparisons() {
    return [...this.comparisons.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listIssues() {
    return [...this.issues.values()];
  }

  async createComparison(comparison: Comparison, images: StoredBlob[], issues: Issue[]) {
    this.comparisons.set(comparison.id, comparison);
    for (const image of images) this.images.set(image.id, image.blob);
    for (const issue of issues) this.issues.set(issue.id, issue);
  }

  async putComparison(comparison: Comparison) {
    this.comparisons.set(comparison.id, comparison);
  }

  async deleteComparison(comparison: Comparison) {
    this.comparisons.delete(comparison.id);
    for (const [id, issue] of this.issues) if (issue.comparisonId === comparison.id) this.issues.delete(id);
    for (const id of [comparison.referenceImage.id, comparison.implementationImage.id, comparison.diffMaskImage.id]) this.images.delete(id);
  }

  async putIssues(issues: Issue[]) {
    for (const issue of issues) this.issues.set(issue.id, issue);
  }

  async getImage(id: string) {
    return this.images.get(id);
  }

  async getCounter(name: string) {
    return this.counters.get(name) ?? 0;
  }

  async setCounter(name: string, value: number) {
    this.counters.set(name, value);
  }
}

/** Opens IndexedDB, falling back to memory when it's missing, blocked or too slow to answer. */
export async function openRepository(timeoutMs = 4000): Promise<QaRepository> {
  if (typeof indexedDB === "undefined") return new MemoryRepository();
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("IndexedDB did not open in time")), timeoutMs);
    });
    const repo = await Promise.race([IdbRepository.open(), timeout]);
    clearTimeout(timer);
    return repo;
  } catch {
    return new MemoryRepository();
  }
}
